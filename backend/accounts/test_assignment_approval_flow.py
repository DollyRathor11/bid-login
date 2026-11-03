from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from .models import GemBidAssignment, User
from .views.GemAssignments import complete_user_assignment_for_bid, user_visible_assignments


class AssignmentApprovalFlowTests(SimpleTestCase):
    def test_submission_or_analysis_cannot_complete_unapproved_assignment(self):
        with patch("accounts.views.GemAssignments._approved_bid_nos", return_value=set()), patch("accounts.views.GemAssignments.GemBidAssignment.objects") as assignments:
            self.assertEqual(complete_user_assignment_for_bid("GEM/2026/B/123"), 0)
            assignments.select_related.assert_not_called()
            assignments.filter.assert_not_called()

    def test_admin_approval_completes_assignment_and_records_correct_reason(self):
        user = User(id=17, username="owner", role="user")
        row = GemBidAssignment(id=10, assigned_to=user, status="assigned")
        with patch("accounts.views.GemAssignments._approved_bid_nos", return_value={"GEM/2026/B/123"}), patch("accounts.views.GemAssignments.GemBidAssignment.objects") as assignments, patch("accounts.views.GemAssignments.GemBidAssignmentHistory.objects.bulk_create") as history, patch("accounts.views.GemAssignments.transaction.atomic"):
            assignments.select_related.return_value.filter.return_value = [row]
            self.assertEqual(complete_user_assignment_for_bid("GEM/2026/B/123"), 1)
            self.assertTrue(assignments.filter.return_value.update.call_args.kwargs["hidden_for_user"])
            self.assertEqual(history.call_args.args[0][0].action, "auto_completed_after_admin_approval")

    def test_legacy_auto_hidden_unapproved_bids_can_return_but_approved_stay_hidden(self):
        user = User(id=17, username="owner", role="user")
        from types import SimpleNamespace
        rows = [SimpleNamespace(opportunity=SimpleNamespace(bid_no=number)) for number in ("PENDING", "APPROVED")]
        queryset = MagicMock()
        queryset.annotate.return_value = queryset
        queryset.filter.return_value = queryset
        queryset.exclude.return_value = queryset
        queryset.__iter__.return_value = iter(rows)
        with patch("accounts.views.GemAssignments.GemBidAssignment.objects.select_related", return_value=queryset), patch("accounts.views.GemAssignments._approved_bid_nos", return_value={"APPROVED"}):
            visible = user_visible_assignments(user)
            self.assertEqual([row.opportunity.bid_no for row in visible], ["PENDING"])
            visibility = next(call.args[0] for call in queryset.filter.call_args_list if call.args)
            self.assertIn("auto_completed_after_bid_submission", str(visibility))
            self.assertIn("hidden_for_user", str(visibility))
            queryset.filter.assert_any_call(assigned_to=user)
