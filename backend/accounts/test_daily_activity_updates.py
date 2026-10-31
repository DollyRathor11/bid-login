import json
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import RequestFactory, SimpleTestCase
from django.utils import timezone

from .views.DailyActivity import daily_activity


class DailyActivityUpdateTests(SimpleTestCase):
    def test_old_bids_reviewed_today_appear_today_in_all_panels(self):
        now = timezone.now()
        bids = [SimpleNamespace(status="complete", review_status=status,
                                created_at=now - timedelta(days=60), updated_at=now)
                for status in ("approved", "re-analyze", "bid_rejected")]
        model = Mock()
        queryset = model.objects.exclude.return_value
        queryset.filter.return_value = bids
        for role in ("admin", "analyser", "user"):
            with self.subTest(role=role), patch("accounts.views.DailyActivity._require_role", return_value=(SimpleNamespace(role=role, username="test"), None)), patch("accounts.views.DailyActivity._model", return_value=model), patch("accounts.views.DailyActivity._filter_user", return_value=queryset):
                response = daily_activity(RequestFactory().get("/", {"product": "desktop"}))
                self.assertEqual(response.status_code, 200)
                rows = json.loads(response.content)
                today = next(row for row in rows if row["date"] == timezone.localdate(now).isoformat())
                self.assertEqual((today["approved"], today["reAnalyze"], today["rejected"], today["total"]), (1, 1, 1, 3))
                self.assertEqual(sum(row["total"] for row in rows), 3)
                self.assertIn("updated_at__date__gte", queryset.filter.call_args.kwargs)
