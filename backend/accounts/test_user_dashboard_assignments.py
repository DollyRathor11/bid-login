import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import RequestFactory, SimpleTestCase

from .views.UserDashboard import user_dashboard
from .views.ProductDashboard import admin_post_bid_summary


class UserDashboardAssignmentTests(SimpleTestCase):
    def test_admin_selected_user_counts_match_user_dashboard(self):
        user = SimpleNamespace(id=17, username="selected", role="user")
        other = SimpleNamespace(id=18, username="other", role="user")
        rows = [SimpleNamespace(assigned_to=actor, opportunity=SimpleNamespace(product_type=product))
                for actor, product in ((user, "desktop"), (user, "printer"), (other, "desktop"))]
        model = Mock()
        model._meta.fields = []
        model.objects.filter.return_value.exclude.return_value.iterator.return_value = iter(())
        with patch("accounts.views.UserDashboard._require_role", return_value=(user, None)), patch("accounts.views.UserDashboard._model", return_value=model), patch("accounts.views.UserDashboard.user_visible_assignments", return_value=rows[:2]), patch("accounts.views.Gem._require_role", return_value=(SimpleNamespace(role="admin"), None)), patch("accounts.views.GemAssignments.user_visible_assignments", return_value=rows), patch("accounts.models.User.objects.filter") as managers:
            managers.return_value.count.return_value = 1
            for product in ("all", "desktop", "printer", "workstation", "aio", "toner"):
                request = RequestFactory().get("/", {"product": product})
                own = json.loads(user_dashboard(request).content)
                summary = json.loads(admin_post_bid_summary(request).content)
                self.assertEqual(own["assigned"], summary["assigned_by_user"].get(user.username, 0))
                self.assertEqual(summary["assigned_total"], sum(summary["assigned_by_user"].values()))

    def test_count_matches_visible_list_and_selected_product(self):
        user = SimpleNamespace(id=17, username="user", role="user")
        visible = [SimpleNamespace(opportunity=SimpleNamespace(product_type=product))
                   for product in ("desktop", "desktop", "printer", "aio")]
        model = Mock()
        model._meta.fields = []
        model.objects.filter.return_value.exclude.return_value.iterator.return_value = iter(())
        with patch("accounts.views.UserDashboard._require_role", return_value=(user, None)), patch("accounts.views.UserDashboard._model", return_value=model), patch("accounts.views.UserDashboard.user_visible_assignments", return_value=visible) as get_visible:
            for product, expected in (("all", 4), ("desktop", 2), ("printer", 1), ("aio", 1), ("toner", 0), ("workstation", 0)):
                with self.subTest(product=product):
                    response = user_dashboard(RequestFactory().get("/", {"product": product, "user_id": "999"}))
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(json.loads(response.content)["assigned"], expected)
                    get_visible.assert_called_with(user)

    def test_assignments_removed_from_list_are_removed_from_card(self):
        user = SimpleNamespace(id=17, username="user", role="user")
        model = Mock()
        model._meta.fields = []
        model.objects.filter.return_value.exclude.return_value.iterator.return_value = iter(())
        assignment = SimpleNamespace(opportunity=SimpleNamespace(product_type="desktop"))
        with patch("accounts.views.UserDashboard._require_role", return_value=(user, None)), patch("accounts.views.UserDashboard._model", return_value=model), patch("accounts.views.UserDashboard.user_visible_assignments", side_effect=[[assignment], []]):
            request = RequestFactory().get("/", {"product": "desktop"})
            self.assertEqual(json.loads(user_dashboard(request).content)["assigned"], 1)
            self.assertEqual(json.loads(user_dashboard(request).content)["assigned"], 0)
