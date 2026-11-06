import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import RequestFactory, SimpleTestCase

from .approval_prices import FIELDS, unpriced_main_component, epbg_price_error


class MainSpecPriceTests(SimpleTestCase):
    def test_epbg_must_be_explicit_and_blank_cannot_reuse_saved_zero(self):
        for value in (None, "", " ", "%"):
            with self.subTest(value=value):
                self.assertEqual(epbg_price_error({"epbg": value}, SimpleNamespace(epbg="0"))["field"], "epbg")
        self.assertEqual(epbg_price_error({}, SimpleNamespace())["field"], "epbg")
        for product in FIELDS:
            for reanalysis in (False, True):
                self.assertEqual(unpriced_main_component(product, {"epbg": ""}, SimpleNamespace(epbg="0"), validate_hdd=reanalysis)["field"], "epbg")

    def test_epbg_zero_and_na_do_not_require_price(self):
        for value in (0, "0", "0%", "0.00", "NA", "N/A", "not applicable"):
            self.assertIsNone(epbg_price_error({"epbg": value, "epbg_price": ""}, SimpleNamespace(epbg=0)))

    def test_positive_epbg_requires_finite_positive_price_in_all_products(self):
        for product in FIELDS:
            for value in ("5", "2.5%", "10"):
                for price in (None, "", 0, -1, "NaN", "Infinity", "bad"):
                    with self.subTest(product=product, value=value, price=price):
                        result = unpriced_main_component(product, {"epbg": value, "epbg_price": price}, SimpleNamespace(epbg=0))
                        self.assertEqual(result["field"], "epbg_price")
                self.assertIsNone(unpriced_main_component(product, {"epbg": value, "epbg_price": 100}, SimpleNamespace(epbg=0)))

    def test_invalid_epbg_percentage_is_rejected(self):
        for value in ("NaN", "Infinity", "-1", "bad"):
            self.assertEqual(epbg_price_error({"epbg": value}, SimpleNamespace(epbg=0))["field"], "epbg")

    def test_every_selected_main_spec_requires_positive_finite_price(self):
        for product, fields in FIELDS.items():
            for field in fields:
                price_field = "screen_price" if field == "screen_size" else field + "_price"
                for price in (None, "", " ", 0, "0.00", -1, "bad", "NaN", "Infinity"):
                    with self.subTest(product=product, field=field, price=price):
                        result = unpriced_main_component(product, {field: "Chosen component", price_field: price}, SimpleNamespace(epbg=0))
                        self.assertEqual(result["field"], price_field)
                self.assertIsNone(unpriced_main_component(product, {field: "Chosen component", price_field: 100}, SimpleNamespace(epbg=0)))

    def test_none_and_optional_descriptions_do_not_require_prices(self):
        for product in FIELDS:
            self.assertIsNone(unpriced_main_component(product, {**{field: "None" for field in FIELDS[product]}, "gp": "Optional text", "software1": "Optional software"}, SimpleNamespace(epbg=0)))

    def test_integrated_aio_board_keeps_existing_zero_price_exception(self):
        self.assertIsNone(unpriced_main_component("aio", {"motherboard": "Integrated Board", "motherboard_price": 0}, SimpleNamespace(epbg=0)))
        self.assertIsNotNone(unpriced_main_component("aio", {"motherboard": "Standalone Board", "motherboard_price": 0}, SimpleNamespace(epbg=0)))

    def test_saved_prices_and_model_aliases(self):
        bid = SimpleNamespace(graphic_card="GPU", graphic_card_price=100, epbg=0)
        self.assertIsNone(unpriced_main_component("workstation", {}, bid))
        self.assertIsNotNone(unpriced_main_component("workstation", {"graphics": "GPU", "graphics_price": ""}, bid))
        self.assertIsNotNone(unpriced_main_component("workstation", {"graphics": "Different GPU"}, bid))
        self.assertIsNone(unpriced_main_component("workstation", {"graphics": "Different GPU", "graphics_price": 200}, bid))

    def test_reanalysis_hdd_price_is_required_only_for_yes(self):
        for product in FIELDS:
            self.assertEqual(unpriced_main_component(product, {"hddreturnable": "Yes", "hddreturnable_price": ""}, SimpleNamespace(epbg=0), validate_hdd=True)["field"], "hddreturnable_price")
            self.assertIsNone(unpriced_main_component(product, {"hddreturnable": "None"}, SimpleNamespace(epbg=0), validate_hdd=True))
            self.assertIsNone(unpriced_main_component(product, {"hddreturnable": "Yes", "hddreturnable_price": 100}, SimpleNamespace(epbg=0), validate_hdd=True))

    def test_reanalysis_endpoints_reject_missing_main_prices_without_saving(self):
        from .views.Desktop import admin_review_desktop_bid
        from .views.Workstation import admin_review_workstation_bid
        from .views.Aio import admin_review_aio_bid
        for product, view, method in (("Desktop", admin_review_desktop_bid, "patch"), ("Workstation", admin_review_workstation_bid, "patch"), ("Aio", admin_review_aio_bid, "post")):
            with self.subTest(product=product):
                bid = SimpleNamespace(save=Mock())
                payload = {"status": "re-analyze", "motherboard": "Selected motherboard", "motherboard_price": ""}
                request = getattr(RequestFactory(), method)("/", json.dumps(payload), content_type="application/json")
                model_name = "AioBid" if product == "Aio" else product + "Bid"
                with patch(f"accounts.views.{product}.{model_name}.objects") as manager:
                    manager.get.return_value = bid
                    manager.filter.return_value.first.return_value = bid
                    if product == "Aio":
                        with patch("accounts.views.Aio._ensure_table"):
                            response = view(request, 1)
                    elif product == "Desktop":
                        with patch("accounts.views.Desktop._pincode_restriction_error", return_value=None):
                            response = view(request, 1)
                    else:
                        response = view(request, 1)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(json.loads(response.content)["field"], "motherboard_price")
                bid.save.assert_not_called()

    def test_all_three_admin_endpoints_reject_missing_prices_before_saving(self):
        from .views.Desktop import admin_review_desktop_bid
        from .views.Workstation import admin_review_workstation_bid
        from .views.Aio import admin_review_aio_bid
        for product, view, method in (("Desktop", admin_review_desktop_bid, "patch"), ("Workstation", admin_review_workstation_bid, "patch"), ("Aio", admin_review_aio_bid, "post")):
            for field in ("motherboard", "cabinet") if product != "Aio" else ("motherboard", "screen_size"):
                with self.subTest(product=product, field=field):
                    bid = SimpleNamespace(save=Mock(), motherboard="None")
                    price_field = "screen_price" if field == "screen_size" else field + "_price"
                    payload = {"status": "approved", "local_content": "50", "total_price": 100, field: "Selected", price_field: ""}
                    request = getattr(RequestFactory(), method)("/", json.dumps(payload), content_type="application/json")
                    model_name = "AioBid" if product == "Aio" else product + "Bid"
                    with patch(f"accounts.views.{product}.{model_name}.objects") as manager:
                        manager.get.return_value = bid
                        manager.filter.return_value.first.return_value = bid
                        if product == "Aio":
                            with patch("accounts.views.Aio._ensure_table"):
                                response = view(request, 1)
                        elif product == "Desktop":
                            with patch("accounts.views.Desktop._pincode_restriction_error", return_value=None):
                                response = view(request, 1)
                        else:
                            response = view(request, 1)
                    self.assertEqual(response.status_code, 400, response.content)
                    self.assertEqual(json.loads(response.content)["field"], price_field)
                    bid.save.assert_not_called()
