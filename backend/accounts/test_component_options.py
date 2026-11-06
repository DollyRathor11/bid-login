import json

from django.test import TestCase

from .models import ComponentOption, ComponentRate, ComponentRateHistory, User
from .views.Gem import _extension_token


class ComponentOptionsTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create(username="components-admin", email="components-admin@example.com", password="unused", role="admin")
        self.headers = {"HTTP_AUTHORIZATION": f"Bearer {_extension_token(self.admin)}"}

    def add(self, **changes):
        data = {"product": "aio", "group": "Screen Size", "name": "32 inch"}
        return self.client.post("/api/component-options/", {**data, **changes}, content_type="application/json", **self.headers)

    def test_added_component_persists_and_is_product_scoped(self):
        self.assertEqual(self.add().status_code, 201)
        row = ComponentOption.objects.get()
        self.assertEqual((row.product, row.category, row.group, row.name), ("aio", "screen_size", "Screen Size", "32 inch"))
        self.assertEqual(self.client.get("/api/component-options/?product=aio").json()["options"][0]["name"], "32 inch")
        self.assertEqual(self.client.get("/api/component-options/?product=desktop").json()["options"], [])

    def test_only_admin_can_add(self):
        response = self.client.post("/api/component-options/", {}, content_type="application/json")
        self.assertEqual(response.status_code, 401)
        self.admin.role = "user"
        self.admin.save()
        self.headers = {"HTTP_AUTHORIZATION": f"Bearer {_extension_token(self.admin)}"}
        self.assertEqual(self.add().status_code, 403)
        self.assertFalse(ComponentOption.objects.exists())

    def test_duplicate_rejected_without_replacing_saved_option(self):
        self.assertEqual(self.add().status_code, 201)
        self.assertEqual(self.add(name=" 32   INCH ").status_code, 409)
        self.assertEqual(ComponentOption.objects.count(), 1)

    def test_invalid_groups_names_and_families_rejected(self):
        for changes in ({"product": "printer"}, {"group": "Cabinet"}, {"name": "None"}, {"name": "x" * 101}, {"group": "Processor", "name": "Unknown CPU"}):
            with self.subTest(changes=changes):
                self.assertEqual(self.add(**changes).status_code, 400)
        self.assertFalse(ComponentOption.objects.exists())

    def test_non_object_json_rejected(self):
        response = self.client.post("/api/component-options/", json.dumps([]), content_type="application/json", **self.headers)
        self.assertEqual(response.status_code, 400)

    def test_new_component_price_is_available_in_component_rates(self):
        self.assertEqual(self.add(price="4500.50").status_code, 201)
        rate = ComponentRate.objects.get(product="aio", category="screen_size", component_name="32 inch")
        self.assertEqual(str(rate.price), "4500.50")
        self.assertEqual(ComponentRateHistory.objects.get().price, rate.price)
        rates = self.client.get("/api/component-rates/?product=aio").json()["rates"]
        self.assertEqual(rates[0]["price"], 4500.50)
        self.assertEqual(self.add(price="9000").status_code, 409)
        rate.refresh_from_db()
        self.assertEqual(str(rate.price), "4500.50")

    def test_invalid_price_does_not_save_component(self):
        for price in ("", "NaN", "Infinity", "-1", "1.001", "1000000000000", None):
            with self.subTest(price=price):
                self.assertEqual(self.add(price=price).status_code, 400)
        self.assertFalse(ComponentOption.objects.exists())
        self.assertFalse(ComponentRate.objects.exists())

    def test_new_component_can_have_zero_price(self):
        self.assertEqual(self.add(price="0").status_code, 201)
        self.assertEqual(ComponentRate.objects.get().price, 0)

    def test_lowercase_processor_names_save_with_dropdown_family_spelling(self):
        for product, group, name, expected in (
            ("desktop", "Processor", "intel core i10 512", "Intel core i10 512"),
            ("aio", "Processor", "amd ryzen test", "AMD ryzen test"),
            ("workstation", "Intel Xeon Processor", "intel xeon test", "Intel Xeon test"),
            ("workstation", "AMD Threadripper Processor", "amd threadripper test", "AMD Threadripper test"),
        ):
            with self.subTest(product=product, name=name):
                response = self.add(product=product, group=group, name=name, price="234")
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.json()["option"]["name"], expected)
                self.assertEqual(ComponentRate.objects.get(product=product, component_name=expected).price, 234)
