import json
from unittest.mock import patch

from django.test import RequestFactory, TestCase

from .catalogue_custom_specs import normalize_custom_specs
from .models import CatalogueProduct
from .views.Desktop import _catalogue_product_data, update_catalogue_product


class CatalogueCustomSpecsTests(TestCase):
    def test_save_reload_and_remove_fields_for_one_product(self):
        first = CatalogueProduct.objects.create(model_no="CUSTOM-ONE", category="Desktop", extra_specs={"_gem_sections": [["Processor", [["Number", "i5"]]]], "Imported Field": "Keep"})
        second = CatalogueProduct.objects.create(model_no="CUSTOM-TWO", category="Desktop", extra_specs={})
        factory = RequestFactory()
        for rows in ([{"label": "Warranty", "value": "3 Years"}], []):
            request = factory.post("/", {"extra_specs": json.dumps({"_custom_specs": rows})})
            with patch("accounts.views.Desktop._extract_motherboard_features_from_text"):
                response = update_catalogue_product(request, first.id)
            self.assertEqual(response.status_code, 200, response.content)
            first.refresh_from_db()
            data = _catalogue_product_data(first, request)
            self.assertEqual(data["extra_specs"]["_custom_specs"], rows)
            self.assertEqual(first.extra_specs["Imported Field"], "Keep")
            self.assertTrue(first.extra_specs["_gem_sections"])
        second.refresh_from_db()
        self.assertEqual(second.extra_specs, {})

    def test_invalid_or_duplicate_names_are_rejected(self):
        for rows in ([{"label": "Warranty", "value": ""}], [{"label": "Warranty", "value": "3"}, {"label": "warranty", "value": "5"}], {}):
            with self.assertRaises(ValueError):
                normalize_custom_specs(rows)
        self.assertEqual(normalize_custom_specs([{"label": "", "value": ""}]), [])
