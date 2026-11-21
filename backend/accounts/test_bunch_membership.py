from unittest.mock import patch

from django.db import connection
from django.test import RequestFactory, TestCase

from .bunch_membership import exclude_bunch_bids
from .models import DesktopBid, PrinterBid, UpsBid, User, WorkstationBid
from .views.Aio import AioBid, list_aio_bids
from .views.Desktop import list_desktop_bids
from .views.Printer import list_printer_bids
from .views.Toner import TonerBid, list_toner_bids
from .views.Workstation import list_workstation_bids


class BunchMembershipTests(TestCase):
    @classmethod
    def setUpClass(cls):
        # Legacy AIO/Toner tables are provisioned by their views rather than
        # migrations. Provision them only in the isolated test database.
        tables = connection.introspection.table_names()
        with connection.schema_editor() as editor:
            for model in (AioBid, TonerBid):
                if model._meta.db_table not in tables:
                    editor.create_model(model)
        super().setUpClass()

    def test_cross_product_bunch_excluded_but_singles_remain(self):
        paired = DesktopBid.objects.create(date="2026-11-18", bid_no=" GEM/123 ", status="complete")
        single = DesktopBid.objects.create(date="2026-11-18", bid_no="GEM/SINGLE", status="complete")
        AioBid.objects.create(bid_no="gem/123", status="complete")
        self.assertEqual(list(exclude_bunch_bids(DesktopBid.objects.all()).values_list("pk", flat=True)), [single.pk])
        self.assertTrue(DesktopBid.objects.filter(pk=paired.pk).exists())

    def test_draft_counterpart_does_not_hide_submitted_bid(self):
        bid = DesktopBid.objects.create(date="2026-11-18", bid_no="GEM/123", status="complete")
        AioBid.objects.create(bid_no="GEM/123", status="draft")
        self.assertTrue(exclude_bunch_bids(DesktopBid.objects.all()).filter(pk=bid.pk).exists())

    def test_duplicate_same_product_is_not_a_bunch(self):
        DesktopBid.objects.create(date="2026-11-18", bid_no="GEM/123", status="complete")
        DesktopBid.objects.create(date="2026-11-18", bid_no="GEM/123", status="complete")
        self.assertEqual(exclude_bunch_bids(DesktopBid.objects.all()).count(), 2)

    def test_submitted_ups_makes_existing_product_a_bunch(self):
        user = User.objects.create(username="ups-test", email="ups@test.invalid", password="unused", role="user")
        DesktopBid.objects.create(date="2026-11-18", bid_no="GEM/123", status="complete")
        UpsBid.objects.create(bid_no="gem/123", user=user, ups_type="line_interactive", status="complete")
        self.assertFalse(exclude_bunch_bids(DesktopBid.objects.all()).exists())

    def test_mixed_workflow_statuses_stay_in_bunch(self):
        DesktopBid.objects.create(date="2026-11-18", bid_no="GEM/123", status="complete", review_status="approved")
        AioBid.objects.create(bid_no="GEM/123", status="re-analyze")
        self.assertFalse(exclude_bunch_bids(DesktopBid.objects.filter(review_status="approved")).exists())

    def test_printer_and_multifunction_are_distinct(self):
        PrinterBid.objects.create(date="2026-11-18", bid_no="GEM/123", status="complete", printer_type="Printer")
        PrinterBid.objects.create(date="2026-11-18", bid_no="GEM/123", status="complete", printer_type="Multifunction Printer")
        self.assertFalse(exclude_bunch_bids(PrinterBid.objects.all()).exists())

    def test_every_individual_analyser_list_excludes_bunch_admin_unchanged(self):
        products = [
            (DesktopBid, list_desktop_bids, "accounts.views.Desktop._bid_data"),
            (WorkstationBid, list_workstation_bids, "accounts.views.Workstation._workstation_bid_data"),
            (PrinterBid, list_printer_bids, "accounts.views.Printer._printer_bid_data"),
            (AioBid, list_aio_bids, "accounts.views.Aio._json"),
            (TonerBid, list_toner_bids, "accounts.views.Toner._json"),
        ]
        for model, _, _ in products:
            model.objects.create(bid_no="GEM/BUNCH", date="2026-11-18", status="analyzed" if model in (AioBid, TonerBid) else "complete", **({"review_status": "reviewed"} if model not in (AioBid, TonerBid) else {}))
        for model, view, serializer in products:
            with self.subTest(product=model.__name__), patch(serializer, side_effect=lambda bid, *a, **kw: {"bid_no": bid.bid_no}), patch("accounts.views.Aio._ensure_table"), patch("accounts.views.Toner._ensure_table"):
                request = RequestFactory().get("/", {"role": "analyser", "status": "reviewed" if model not in (AioBid, TonerBid) else "approved"})
                # Use an approved state in all products to test the same tab.
                model.objects.filter(bid_no="GEM/BUNCH").update(**({"status": "approved"} if model in (AioBid, TonerBid) else {"review_status": "approved"}))
                request.GET = request.GET.copy()
                request.GET["status"] = "approved"
                response = view(request)
                self.assertEqual(response.status_code, 200, response.content)
                self.assertEqual(response.content, b"[]")
                admin_request = RequestFactory().get("/", {"role": "admin", "status": "approved"})
                response = view(admin_request)
                self.assertEqual(response.status_code, 200, response.content)
                self.assertIn(b"GEM/BUNCH", response.content)
