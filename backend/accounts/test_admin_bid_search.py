import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.http import JsonResponse
from django.test import RequestFactory, SimpleTestCase

from .views.AdminBidSearch import admin_bid_search, bid_stage


class AdminBidSearchTests(SimpleTestCase):
    def test_workflow_stages_keep_rejection_separate(self):
        for review, expected in [("pending", ("Pending analysis", "Analyser")),
                                 ("reviewed", ("Pending approval", "Admin")),
                                 ("approved", ("Approved", "Approved")),
                                 ("re-analyze", ("Re-Analyze", "Analyser")),
                                 ("bid_rejected", ("Rejected", "Rejected"))]:
            with self.subTest(review=review):
                self.assertEqual(bid_stage(SimpleNamespace(status="complete", review_status=review)), expected)
        self.assertEqual(bid_stage(SimpleNamespace(status="rejected")), ("Re-Analyze", "Analyser"))
        self.assertEqual(bid_stage(SimpleNamespace(status="draft")), ("Draft", "User"))

    @patch("accounts.views.AdminBidSearch._require_role")
    def test_denies_non_admin_before_search(self, role):
        role.return_value = (None, JsonResponse({"error": "Forbidden"}, status=403))
        self.assertEqual(admin_bid_search(RequestFactory().get("/", {"q": "GEM"})).status_code, 403)

    @patch("accounts.views.AdminBidSearch._require_role", return_value=(None, None))
    def test_rejects_empty_search(self, role):
        self.assertEqual(admin_bid_search(RequestFactory().get("/")).status_code, 400)

    @patch("accounts.views.AdminBidSearch._require_role", return_value=(None, None))
    @patch("accounts.views.AdminBidSearch.GemBidOpportunity")
    @patch("accounts.views.AdminBidSearch._model")
    def test_search_returns_assignee_and_approval_without_dashboard_filters(self, model, opportunities, role):
        assignment = SimpleNamespace(assigned_to=SimpleNamespace(username="Mayur"), get_status_display=lambda: "Assigned")
        opportunity = SimpleNamespace(bid_no="GEM/123", assignment=assignment)
        opportunities.objects.filter.return_value.select_related.return_value.__getitem__.return_value = [opportunity]
        bid = SimpleNamespace(pk=1, bid_no="GEM/123", status="complete", review_status="reviewed", user=SimpleNamespace(username="Mayur"), analyser_username="Rishabh")
        queryset = Mock()
        queryset.filter.return_value.select_related.return_value.order_by.return_value = [bid]
        model.return_value.objects = queryset
        response = admin_bid_search(RequestFactory().get("/", {"q": "GEM/123", "user": "Other", "product": "toner"}))
        rows = json.loads(response.content)["results"]
        self.assertEqual(len(rows), 5)
        self.assertEqual(rows[0]["assigned_user"], "Mayur")
        self.assertEqual(rows[0]["analyser"], "Rishabh")
        self.assertEqual(rows[0]["stage"], "Admin")
