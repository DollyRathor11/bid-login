from django.test import SimpleTestCase

from .views.GemOpportunityRules import classify_opportunity_item


class GemOpportunityProductRulesTests(SimpleTestCase):
    def test_accepts_exact_single_categories(self):
        cases = {
            "Entry and Mid Level Desktop Computer (Q2)": "desktop",
            "High End Desktop Computer (Q2)": "desktop",
            "All in One PC (V2) (Q2)": "aio",
            "Fixed Computer Workstation (Q2)": "workstation",
            "Toner Cartridges / Ink Cartridges (Q2)": "toner",
            "A4 and Legal Size Multifunction Printer (MFP) (Q2)": "printer",
        }
        for item, product_type in cases.items():
            with self.subTest(item=item):
                result = classify_opportunity_item(item)
                self.assertIsNotNone(result)
                self.assertEqual(result["product_type"], product_type)

    def test_accepts_known_pdf_text_clipping_for_approved_categories(self):
        for item in [
            "Entry and Mid Level Desktop Com",
            "A4 and Legal Size Multifunction P (MFP)",
            "A4 an Multifunction Printer (MFP)",
        ]:
            with self.subTest(item=item):
                self.assertIsNotNone(classify_opportunity_item(item))

    def test_keeps_bunch_whose_every_category_is_approved_or_ups(self):
        cases = {
            "All in One PC (V2) (Q2), Entry and Mid Level Desktop Computer (Q2), "
            "A4 and Legal Size Multifunction Printer (MFP) (Q2)": "aio",
            "All in One PC (V2), Line Interactive UPS with AVR (V2)": "aio",
            "Line Interactive UPS with AVR (V2), A4 and Legal Size Multifunction Printer (MFP)": "printer",
            "All in One PC (V2) (Q2), Online UPS (?10 KVA) With Battery Conforming To IS 16242 (Part 1) (Q2)": "aio",
            "All in One PC (V2) (Q2), Online UPS (<=10 KVA) With Battery Conforming To IS 16242 (Part 1) (Q2)": "aio",
            "Online UPS (≤10 KVA) Without Battery Conforming To IS 16242 (Part 1), Fixed Computer Workstation": "workstation",
        }
        for item, product_type in cases.items():
            with self.subTest(item=item):
                result = classify_opportunity_item(item)
                self.assertIsNotNone(result)
                self.assertTrue(result["is_bunch"])
                self.assertEqual(result["product_type"], product_type)

    def test_rejects_bunch_with_any_other_item_or_only_ups(self):
        for item in [
            "Interactive Panels with CPU (Q2) , Entry and Mid Level Desktop Computer (Q2)",
            "Laptop (Q2), Line Interactive UPS With AVR (V2) (Q2)",
            "All in One PC (V2) (Q2), Line Intractive UPS With AVR (Q2)",
            "All in One PC (V2) (Q2), Online UPS (V2) (Q2)",
            "All in One PC (V2) (Q2), Online UPS (Q2)",
            "A3 Size Multifunction Printer (MFP), A4 and Legal Size Multifunction Printer (MFP)",
            "Line Interactive UPS With AVR (V2) (Q2), "
            "Online UPS (≤10 KVA) With Battery Conforming To IS 16242 (Part 1) (Q2)",
        ]:
            with self.subTest(item=item):
                self.assertIsNone(classify_opportunity_item(item))

    def test_ups_alone_is_not_received(self):
        self.assertIsNone(classify_opportunity_item("Line Interactive UPS with AVR (V2) (Q2)"))
        self.assertIsNone(classify_opportunity_item("Online UPS (≤10 KVA) With Battery Conforming To IS 16242 (Part 1) (Q2)"))

    def test_rejects_pac_only_after_q_marker(self):
        self.assertIsNone(classify_opportunity_item(
            "A4 and Legal Size Multifunction Printer (MFP) (Q2) ( PAC Only )"
        ))

