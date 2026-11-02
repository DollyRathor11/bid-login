import json
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import RequestFactory, SimpleTestCase
from django.utils import timezone

from .views.AnalyserDashboard import analyser_dashboard
from .views.DailyActivity import daily_activity


class SnapshotQuery:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, **filters):
        rows = self.rows
        if "analyser_username" in filters:
            rows = [row for row in rows if row.analyser_username == filters["analyser_username"]]
        return SnapshotQuery(rows)

    def iterator(self):
        return iter(self.rows)

    def __iter__(self):
        return iter(self.rows)


class AnalyserDashboardTests(SimpleTestCase):
    def setUp(self):
        self.now = timezone.now()
        self.actor = SimpleNamespace(role="analyser", username="first")
        self.rows = [SimpleNamespace(status="complete", review_status=status, analyser_username=name,
                                     created_at=self.now, updated_at=self.now)
                     for name, status in (("first", "reviewed"), ("first", "approved"),
                                          ("first", "re-analyze"), ("first", "bid_rejected"),
                                          ("second", "approved"), ("", "pending"))]
        self.rows.append(SimpleNamespace(status="draft", review_status="pending", analyser_username="first", created_at=self.now, updated_at=self.now))
        self.model = Mock()
        self.model.objects.exclude.side_effect = lambda **kw: SnapshotQuery([row for row in self.rows if row.status != kw["status"]])

    def test_own_cards_and_monthly_counts_ignore_spoofed_identity_for_all_products(self):
        for product in ("desktop", "aio", "workstation", "printer", "toner"):
            for username, expected in (("first", (4, 1, 1, 1, 1)), ("second", (1, 0, 1, 0, 0))):
                self.actor.username = username
                with self.subTest(product=product, username=username), patch("accounts.views.AnalyserDashboard._require_role", return_value=(self.actor, None)), patch("accounts.views.AnalyserDashboard._model", return_value=self.model):
                    request = RequestFactory().get("/", {"product": product, "year": self.now.year, "analyser": "someone-else", "user": "someone-else"})
                    response = analyser_dashboard(request)
                    self.assertEqual(response.status_code, 200)
                    data = json.loads(response.content)
                    keys = ("total", "pending", "approved", "reAnalyze", "rejected")
                    self.assertEqual(tuple(data["stats"][key] for key in keys), expected)
                    self.assertEqual(tuple(sum(month[key] for month in data["monthly"]) for key in keys), expected)

    def test_daily_activity_is_scoped_to_authenticated_analyser(self):
        for username, expected in (("first", 4), ("second", 1)):
            self.actor.username = username
            with patch("accounts.views.DailyActivity._require_role", return_value=(self.actor, None)), patch("accounts.views.DailyActivity._model", return_value=self.model):
                result = daily_activity(RequestFactory().get("/", {"product": "desktop", "analyser": "someone-else"}))
                rows = json.loads(result.content)
                self.assertEqual(sum(row["total"] for row in rows), expected)

    def test_analyser_role_is_required(self):
        response = analyser_dashboard(RequestFactory().get("/", {"product": "desktop"}))
        self.assertEqual(response.status_code, 401)

    def test_invalid_product_and_year(self):
        with patch("accounts.views.AnalyserDashboard._require_role", return_value=(self.actor, None)):
            for params in ({"product": "other"}, {"year": "bad"}, {"year": "0"}):
                self.assertEqual(analyser_dashboard(RequestFactory().get("/", params)).status_code, 400)
