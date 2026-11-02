import json
from unittest.mock import Mock, patch

from django.http import JsonResponse
from django.test import RequestFactory, SimpleTestCase

from .views.Workstation import admin_review_workstation_bid


class WorkstationApprovalValidationTests(SimpleTestCase):
    def request_approval(self, payload):
        bid = Mock(hdd_non_return="Yes", hdd_non_return_price=0, model_number="model")
        request = RequestFactory().patch("/", json.dumps(payload), content_type="application/json")
        with patch("accounts.views.Workstation.WorkstationBid.objects.get", return_value=bid), patch("accounts.views.model_duplicates.guard_new_model", return_value=JsonResponse({"validated": True})) as guard:
            response = admin_review_workstation_bid(request, 1)
        bid.save.assert_not_called()
        return response, guard

    def test_approval_requires_valid_local_content(self):
        for content in (None, "", " ", "abc", "NaN", "Infinity", "-1", "101"):
            with self.subTest(content=content):
                response, guard = self.request_approval({"status": "approved", "local_content": content, "hddreturnable": "None"})
                self.assertEqual(response.status_code, 400)
                self.assertIn("Local Content", json.loads(response.content)["error"])
                guard.assert_not_called()

    def test_hdd_yes_requires_positive_finite_price(self):
        for price in (None, "", " ", 0, "0.00", -1, "abc", "NaN", "Infinity"):
            with self.subTest(price=price):
                response, guard = self.request_approval({"status": "approved", "local_content": "50", "hddreturnable": "Yes", "hddreturnable_price": price})
                self.assertEqual(response.status_code, 400)
                self.assertIn("HDD Return", json.loads(response.content)["error"])
                guard.assert_not_called()

    def test_valid_values_and_no_hdd_return_pass_validation(self):
        for content, option, price in ((0, "None", ""), ("50%", "Yes", "250"), (100, "Yes", "0.50")):
            with self.subTest(content=content, option=option):
                response, guard = self.request_approval({"status": "approved", "local_content": content, "hddreturnable": option, "hddreturnable_price": price})
                self.assertEqual(response.status_code, 200)
                guard.assert_called_once()

    def test_reanalyse_does_not_require_approval_fields(self):
        response, guard = self.request_approval({"status": "re-analyze"})
        self.assertEqual(response.status_code, 200)
        guard.assert_called_once()
