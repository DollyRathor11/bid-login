from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from .dashboard_metrics import dashboard_assignments, dashboard_status


class DashboardMetricsTests(SimpleTestCase):
    def test_reanalysis_and_rejection_remain_distinct_for_every_workflow(self):
        for review, expected in (("pending", "pending"), ("reviewed", "pending"), ("approved", "approved"), ("re-analyze", "reAnalyze"), ("bid_rejected", "rejected")):
            with self.subTest(review=review):
                self.assertEqual(dashboard_status(SimpleNamespace(status="complete", review_status=review)), expected)
        for status, expected in (("submitted", "pending"), ("complete", "pending"), ("analyzed", "pending"), ("approved", "approved"), ("rejected", "reAnalyze"), ("re-analyze", "reAnalyze"), ("bid_rejected", "rejected")):
            with self.subTest(status=status):
                self.assertEqual(dashboard_status(SimpleNamespace(status=status)), expected)

    @patch("accounts.dashboard_metrics.GemBidAssignment.objects")
    def test_assignment_total_does_not_depend_on_role_visibility(self, manager):
        rows = manager.all.return_value
        self.assertIs(dashboard_assignments(), rows)
        rows.filter.assert_not_called()
        for product in ("desktop", "aio", "workstation", "printer", "toner"):
            dashboard_assignments(product)
            rows.filter.assert_called_with(opportunity__product_type=product)
