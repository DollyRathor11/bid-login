import json
import tempfile
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import fitz
from django.core import signing
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from .models import UpsBid, User
from .ups_specs import SCHEMAS, specs_fields
from .views.BunchBids import bunch_status, eligible_groups
from .views.Ups import validate_file, validate_metadata, validate_specs
from .views.UpsDocuments import personalize


def valid_specs(ups_type="line_interactive", large=False):
    specs = {"capacity_range": "above_10" if large else "up_to_10"} if ups_type == "online_with_battery" else {}
    for field in specs_fields(ups_type, specs):
        if field["required"]:
            specs[field["key"]] = field["options"][0]
    return specs


class UpsValidationTests(SimpleTestCase):
    def test_all_three_categories_and_both_battery_ranges(self):
        for category in SCHEMAS:
            with self.subTest(category=category):
                validate_specs(category, valid_specs(category))
        validate_specs("online_with_battery", valid_specs("online_with_battery", large=True))

    def test_without_battery_cannot_retain_battery_fields(self):
        specs = valid_specs("online_without_battery")
        specs["battery_type"] = "SMF"
        with self.assertRaises(ValueError):
            validate_specs("online_without_battery", specs)

    def test_missing_rating_rejected(self):
        for field in ("rating",):
            specs = valid_specs("online_with_battery")
            specs.pop(field)
            with self.assertRaises(ValueError):
                validate_specs("online_with_battery", specs)

    def test_capacity_range_not_required(self):
        specs = valid_specs("online_with_battery")
        specs.pop("capacity_range")
        validate_specs("online_with_battery", specs)

    def test_buyer_exact_values_are_allowed(self):
        specs = valid_specs()
        specs["rating"] = "2.5 KVA as required by buyer"
        validate_specs("line_interactive", specs)

    def test_multiselect_requires_a_list(self):
        specs = valid_specs()
        specs["protections"] = "Overload"
        with self.assertRaises(ValueError):
            validate_specs("line_interactive", specs)

    def test_invalid_pincode_quantity_and_date_range_rejected(self):
        base = {"bid_no": "GEM/UPS/123", "dept_name": "Test", "organization": "Test", "address": "Test", "pincode": "226020", "qty": 1}
        for change in ({"pincode": "123"}, {"qty": 0}, {"qty": "1.5"}, {"start_date": "2026-11-17", "end_date": "2026-11-16"}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_metadata({**base, **change})

    def test_upload_rejects_disguised_pdf(self):
        with self.assertRaises(ValueError):
            validate_file(SimpleUploadedFile("bad.pdf", b"not a PDF", content_type="application/pdf"))

    def test_grouping_normalizes_case_and_outer_spaces_but_requires_different_products(self):
        rows = [{"bid_no": " GEM/123 ", "product": "desktop"}, {"bid_no": "gem/123", "product": "aio"},
                {"bid_no": "GEM/456", "product": "printer"}, {"bid_no": "GEM/456", "product": "printer"},
                {"bid_no": "GEM/789", "product": "ups"}]
        groups = eligible_groups(rows)
        self.assertEqual(set(groups), {"gem/123", "gem/789"})
        self.assertEqual(len(groups["gem/123"]), 2)

    def test_mixed_group_is_not_approved_early(self):
        self.assertEqual(bunch_status([{"status": "approved"}, {"status": "pending"}]), "pending")
        self.assertEqual(bunch_status([{"status": "approved"}, {"status": "approved"}]), "approved")
        self.assertEqual(bunch_status([{"status": "approved"}, {"status": "re-analyze"}]), "re-analyze")

    def test_printer_and_multifunction_are_distinct_products(self):
        rows = [{"bid_no": "GEM/123", "product": "printer", "product_kind": "printer"}, {"bid_no": "GEM/123", "product": "printer", "product_kind": "multifunction_printer"}]
        self.assertEqual(len(eligible_groups(rows)["gem/123"]), 2)

    def test_document_personalization_removes_previous_buyer_and_bid(self):
        with fitz.open() as document:
            page = document.new_page()
            page.insert_text((72, 110), "To,\nOLD BUYER\nOLD ORGANIZATION\nOLD ADDRESS\n\nTender No: GEM/2026/B/OLD Dated: 01-01-2026")
            page.insert_text((72, 300), "Subject: General Certificate\nOriginal declaration stays here.")
            bid = SimpleNamespace(dept_name="UPS DEPARTMENT", organization="UPS ORGANIZATION", address="NEW ADDRESS", pincode="226020", bid_no="GEM/UPS/NEW", start_date="2026-11-17")
            personalize(document, bid)
            result = page.get_text()
            self.assertIn("GEM/UPS/NEW", result)
            self.assertIn("UPS DEPARTMENT", result)
            self.assertNotIn("OLD BUYER", result)
            self.assertNotIn("GEM/2026/B/OLD", result)
            self.assertIn("Original declaration stays here.", result)


class UpsWorkflowTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create(username="ups-owner", email="ups-owner@test.invalid", password="unused", role="user")
        self.other = User.objects.create(username="ups-other", email="ups-other@test.invalid", password="unused", role="user")
        self.analyser = User.objects.create(username="ups-analyser", email="ups-analyser@test.invalid", password="unused", role="analyser")
        self.admin = User.objects.create(username="ups-admin", email="ups-admin@test.invalid", password="unused", role="admin")
        self.payload = {"bid_no": "GEM/UPS/123", "dept_name": "Test Department", "organization": "Test Organization", "address": "Test Address", "pincode": "226020", "qty": 2, "ups_type": "line_interactive", "specs": valid_specs()}

    def client_for(self, user):
        token = signing.dumps({"user_id": user.pk, "role": user.role}, salt="gem-api-auth")
        return Client(HTTP_AUTHORIZATION=f"Bearer {token}")

    def create_bid(self):
        response = self.client_for(self.owner).post("/api/ups-bids/create/", data=json.dumps(self.payload), content_type="application/json")
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()["id"]

    def submit_bid(self, bid_id):
        response = self.client_for(self.owner).post(f"/api/ups-bids/{bid_id}/documents/", {"selected_general_docs": '["manufacturer_auth"]'})
        self.assertEqual(response.status_code, 200, response.content)

    def review(self, user, bid_id, data):
        return self.client_for(user).post(f"/api/ups-bids/{bid_id}/review/", data=json.dumps(data), content_type="application/json")

    def send_admin(self, bid_id, **data):
        saved = self.review(self.analyser, bid_id, {"action": "save_analysis", **data})
        self.assertEqual(saved.status_code, 200, saved.content)
        return self.review(self.analyser, bid_id, {"action": "send_admin", "selected_analyser_docs": ["warranty", "technical_compliance", "data_sheet"]})

    def test_submit_analyse_approve_and_lock(self):
        bid_id = self.create_bid()
        self.submit_bid(bid_id)
        denied = self.review(self.admin, bid_id, {"action": "approved", "unit_price": "5000", "local_content": "40"})
        self.assertEqual(denied.status_code, 409)
        response = self.send_admin(bid_id, model_number="UPS-001")
        self.assertEqual(response.status_code, 200, response.content)
        for action in ("approved", "re-analyze"):
            self.assertEqual(self.review(self.admin, bid_id, {"action": action, "local_content": "40"}).status_code, 400)
        response = self.review(self.admin, bid_id, {"action": "approved", "unit_price": "5000", "local_content": "0", "epbg": "0", "approved_price": "5000"})
        self.assertEqual(response.status_code, 200, response.content)
        bid = UpsBid.objects.get(pk=bid_id)
        self.assertEqual((bid.status, bid.analyser_username, bid.admin_username), ("approved", self.analyser.username, self.admin.username))
        self.assertEqual(bid.local_content, Decimal(0))
        self.assertEqual(self.review(self.analyser, bid_id, {"action": "send_admin", "model_number": "CHANGED"}).status_code, 409)

    def test_admin_pricing_validation_and_persisted_changes(self):
        bid_id = self.create_bid()
        self.submit_bid(bid_id)
        self.assertEqual(self.send_admin(bid_id).status_code, 200)
        base = {"local_content": "0", "approved_price": "5100"}
        for action in ("approved", "re-analyze"):
            for epbg in ("", "5"):
                response = self.review(self.admin, bid_id, {**base, "action": action, "epbg": epbg})
                self.assertEqual(response.status_code, 400, response.content)
                self.assertEqual(UpsBid.objects.get(pk=bid_id).status, "analyzed")
        for local in ("", "101", "-1"):
            response = self.review(self.admin, bid_id, {**base, "action": "approved", "epbg": "0", "local_content": local})
            self.assertEqual(response.status_code, 400)
        response = self.review(self.admin, bid_id, {**base, "action": "approved", "epbg": "5", "epbg_price": "100", "freight_price": "50", "margin": "200", "dept_name": "Updated department"})
        self.assertEqual(response.status_code, 200, response.content)
        bid = UpsBid.objects.get(pk=bid_id)
        self.assertEqual(bid.dept_name, "Updated department")
        self.assertEqual(Decimal(bid.admin_pricing["approved_price"]), Decimal("5100"))
        updated = self.review(self.admin, bid_id, {"action": "approved", "epbg": "0", "margin": "0"})
        self.assertEqual(updated.status_code, 200, updated.content)
        self.assertEqual(Decimal(updated.json()["approved_price"]), Decimal("5100"))

    def test_reject_requires_reason_but_not_pricing(self):
        bid_id = self.create_bid()
        self.submit_bid(bid_id)
        self.assertEqual(self.send_admin(bid_id).status_code, 200)
        self.assertEqual(self.review(self.admin, bid_id, {"action": "bid_rejected"}).status_code, 400)
        response = self.review(self.admin, bid_id, {"action": "bid_rejected", "note": "Wrong specifications"})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(UpsBid.objects.get(pk=bid_id).admin_note, "Wrong specifications")

    def test_user_model_number_is_saved_and_available_to_staff(self):
        self.payload["model_number"] = "UPS-USER-100"
        bid_id = self.create_bid()
        self.assertEqual(UpsBid.objects.get(pk=bid_id).model_number, "UPS-USER-100")
        self.submit_bid(bid_id)
        response = self.client_for(self.analyser).get(f"/api/ups-bids/{bid_id}/")
        self.assertEqual(response.json()["model_number"], "UPS-USER-100")
        self.assertEqual(self.send_admin(bid_id, model_number="UPS-REVIEW-200").status_code, 200)
        response = self.client_for(self.admin).get(f"/api/ups-bids/{bid_id}/")
        self.assertEqual(response.json()["model_number"], "UPS-REVIEW-200")

    def test_analyser_can_send_ups_without_model_or_price(self):
        bid_id = self.create_bid()
        self.submit_bid(bid_id)
        response = self.send_admin(bid_id)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(UpsBid.objects.get(pk=bid_id).status, "analyzed")

    def test_next_saves_specs_but_does_not_send_to_admin(self):
        bid_id = self.create_bid()
        self.submit_bid(bid_id)
        specs = {**self.payload["specs"], "rating": "0.8"}
        saved = self.review(self.analyser, bid_id, {"action": "save_analysis", "specs": specs})
        self.assertEqual(saved.status_code, 200, saved.content)
        bid = UpsBid.objects.get(pk=bid_id)
        self.assertEqual(bid.status, "complete")
        self.assertEqual(bid.specs["rating"], "0.8")
        self.assertIsNotNone(bid.analysis_saved_at)
        self.assertEqual(bid.selected_analyser_docs, [])
        denied = self.review(self.admin, bid_id, {"action": "approved", "unit_price": "5000", "local_content": "40"})
        self.assertEqual(denied.status_code, 409)

    def test_document_submission_cannot_skip_next_or_use_invalid_documents(self):
        bid_id = self.create_bid()
        self.submit_bid(bid_id)
        response = self.review(self.analyser, bid_id, {"action": "send_admin", "selected_analyser_docs": ["warranty"]})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(UpsBid.objects.get(pk=bid_id).status, "complete")
        self.assertEqual(self.review(self.analyser, bid_id, {"action": "save_analysis"}).status_code, 200)
        for docs in (None, "warranty", ["unknown"], ["manufacturer_auth"]):
            with self.subTest(docs=docs):
                response = self.review(self.analyser, bid_id, {"action": "send_admin", "selected_analyser_docs": docs})
                self.assertEqual(response.status_code, 400)
        self.assertEqual(UpsBid.objects.get(pk=bid_id).status, "complete")

    def test_final_documents_are_persisted_and_sent_only_at_final_submit(self):
        bid_id = self.create_bid()
        self.submit_bid(bid_id)
        self.assertEqual(self.review(self.analyser, bid_id, {"action": "save_analysis"}).status_code, 200)
        response = self.review(self.analyser, bid_id, {"action": "send_admin", "selected_analyser_docs": ["warranty", "data_sheet", "warranty"]})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["selected_analyser_docs"], ["warranty", "data_sheet"])
        self.assertEqual(UpsBid.objects.get(pk=bid_id).status, "analyzed")

    def test_analyser_pdfs_use_saved_ups_specs_and_preview_does_not_submit(self):
        bid_id = self.create_bid()
        self.submit_bid(bid_id)
        client = self.client_for(self.analyser)
        url = f"/api/ups-bids/{bid_id}/generate-docs/"
        response = client.post(url, json.dumps({"doc_type": "data_sheet"}), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.review(self.analyser, bid_id, {"action": "save_analysis"}).status_code, 200)
        with tempfile.TemporaryDirectory() as temporary, override_settings(MEDIA_ROOT=temporary):
            for doc in ("warranty", "technical_compliance", "data_sheet"):
                with self.subTest(doc=doc):
                    response = client.post(url, json.dumps({"doc_type": doc}), content_type="application/json")
                    self.assertEqual(response.status_code, 200, response.content)
                    files = list((Path(temporary) / "generated" / "ups").glob(f"*_{doc}_*.pdf"))
                    self.assertEqual(len(files), 1)
                    with fitz.open(files[0]) as pdf:
                        text = "\n".join(page.get_text() for page in pdf)
                    self.assertIn(self.payload["bid_no"], text)
                    self.assertIn("Line Interactive UPS", text)
                    self.assertIn("Standard Warranty for the UPS", text)
            self.assertEqual(UpsBid.objects.get(pk=bid_id).status, "complete")
            denied = self.client_for(self.owner).post(url, json.dumps({"doc_type": "warranty"}), content_type="application/json")
            self.assertEqual(denied.status_code, 403)

    def test_admin_local_content_preview_does_not_change_saved_bid(self):
        bid_id = self.create_bid()
        self.submit_bid(bid_id)
        url = f"/api/ups-bids/{bid_id}/generate-docs/"
        admin = self.client_for(self.admin)
        self.assertEqual(admin.post(url, json.dumps({"doc_type": "make_in_india", "local_content": ""}), content_type="application/json").status_code, 400)
        self.assertEqual(self.client_for(self.owner).post(url, json.dumps({"doc_type": "make_in_india", "local_content": "40"}), content_type="application/json").status_code, 403)
        with tempfile.TemporaryDirectory() as temporary, override_settings(MEDIA_ROOT=temporary):
            response = admin.post(url, json.dumps({"doc_type": "make_in_india", "local_content": "40"}), content_type="application/json")
            self.assertEqual(response.status_code, 200, response.content)
            files = list((Path(temporary) / "generated" / "ups").glob("*.pdf"))
            with fitz.open(files[0]) as document:
                self.assertIn("Local Content: 40%", document[0].get_text())
            self.assertIsNone(UpsBid.objects.get(pk=bid_id).local_content)

    def test_ownership_roles_and_documents_enforced(self):
        bid_id = self.create_bid()
        self.assertEqual(Client().get("/api/ups-bids/schema/").status_code, 401)
        self.assertEqual(self.client_for(self.other).get(f"/api/ups-bids/{bid_id}/").status_code, 404)
        self.assertEqual(self.client_for(self.other).post(f"/api/ups-bids/{bid_id}/documents/", {"selected_general_docs": '["manufacturer_auth"]'}).status_code, 404)
        response = self.client_for(self.owner).post(f"/api/ups-bids/{bid_id}/documents/", {"selected_general_docs": "[]"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(UpsBid.objects.get(pk=bid_id).status, "draft")
        self.assertEqual(self.client_for(self.owner).get("/api/bunch-bids/").status_code, 403)
        self.assertEqual(self.review(self.owner, bid_id, {"action": "send_admin", "model_number": "UPS"}).status_code, 403)

    def test_reanalysis_returns_to_original_analyser_and_reject_is_final(self):
        bid_id = self.create_bid()
        self.submit_bid(bid_id)
        self.assertEqual(self.send_admin(bid_id, model_number="UPS-001").status_code, 200)
        self.assertEqual(self.review(self.admin, bid_id, {"action": "re-analyze", "unit_price": "5000", "epbg": "0", "note": "Check backup"}).status_code, 200)
        self.assertIsNone(UpsBid.objects.get(pk=bid_id).analysis_saved_at)
        self.assertEqual(self.send_admin(bid_id, model_number="UPS-002").status_code, 200)
        self.assertEqual(self.review(self.admin, bid_id, {"action": "bid_rejected", "note": "Does not meet specification"}).status_code, 200)
        self.assertEqual(UpsBid.objects.get(pk=bid_id).status, "bid_rejected")

    @patch("accounts.views.BunchBids._model")
    def test_bunch_api_combines_existing_product_with_ups(self, model):
        bid_id = self.create_bid()
        self.submit_bid(bid_id)
        legacy_bid = SimpleNamespace(pk=987, bid_no="gem/ups/123 ", dept_name="Desktop Dept", qty=1, user=self.owner,
                                     analyser_username="Other Analyser", model_number="DT-1", status="complete", review_status="approved", updated_at=timezone.now(), upload_document=None)
        def legacy_model(product):
            queryset = Mock()
            queryset.select_related.return_value = queryset
            queryset.filter.return_value = queryset
            queryset.iterator.return_value = iter([legacy_bid] if product == "desktop" else [])
            manager = Mock()
            manager.exclude.return_value = queryset
            return SimpleNamespace(objects=manager)
        model.side_effect = legacy_model
        response = self.client_for(self.admin).get("/api/bunch-bids/", {"q": "GEM/UPS/123", "status": "approved"})
        self.assertEqual(response.status_code, 200, response.content)
        groups = response.json()["results"]
        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["products"], ["desktop"])
        self.assertEqual(groups[0]["status"], "approved")
        self.assertEqual({r["status"] for r in groups[0]["items"]}, {"approved"})

    @patch("accounts.views.BunchBids.PRODUCTS", ())
    def test_admin_bunch_hides_ups_until_final_analyser_submission(self):
        bid_id = self.create_bid()
        self.submit_bid(bid_id)
        query = {"bid_no": self.payload["bid_no"]}
        admin = self.client_for(self.admin)
        analyser = self.client_for(self.analyser)
        self.assertEqual(admin.get("/api/bunch-bids/", query).json()["count"], 0)
        self.assertEqual(analyser.get("/api/bunch-bids/", query).json()["count"], 1)
        self.assertEqual(self.review(self.analyser, bid_id, {"action": "save_analysis"}).status_code, 200)
        self.assertEqual(admin.get("/api/bunch-bids/", query).json()["count"], 0)
        self.assertEqual(self.send_admin(bid_id).status_code, 200)
        data = admin.get("/api/bunch-bids/", query).json()
        self.assertEqual(data["count"], 1)
        self.assertTrue(data["results"][0]["items"][0]["can_review"])
        self.assertEqual(analyser.get("/api/bunch-bids/", {**query, "status": "pending"}).json()["count"], 0)

    def test_document_endpoint_uses_templates_without_overwriting_them(self):
        bid_id = self.create_bid()
        with tempfile.TemporaryDirectory() as temporary, override_settings(MEDIA_ROOT=temporary):
            folder = Path(temporary) / "templates"
            folder.mkdir()
            with fitz.open() as template:
                for _ in range(4):
                    page = template.new_page()
                    page.insert_text((72, 110), "To,\nOLD BUYER\nOLD ORGANIZATION\nOLD ADDRESS\n\nTender No: GEM/OLD Dated: 01-01-2026")
                template.save(folder / "documents.pdf")
            original = (folder / "documents.pdf").read_bytes()
            client = self.client_for(self.owner)
            response = client.post(f"/api/ups-bids/{bid_id}/generate-docs/", json.dumps({"doc_type": "manufacturer_auth"}), content_type="application/json")
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(original, (folder / "documents.pdf").read_bytes())
            files = list((Path(temporary) / "generated" / "ups").glob("*.pdf"))
            self.assertEqual(len(files), 1)
            with fitz.open(files[0]) as document:
                self.assertEqual(len(document), 3)
                self.assertIn(self.payload["bid_no"], document[0].get_text())
            denied = self.client_for(self.other).post(f"/api/ups-bids/{bid_id}/generate-docs/", json.dumps({"doc_type": "manufacturer_auth"}), content_type="application/json")
            self.assertEqual(denied.status_code, 404)
