import json

from django.core import signing
from django.test import TestCase

from .models import GemClarificationResult, User


class GemClarificationResultTests(TestCase):
    def setUp(self):
        self.analyser = User.objects.create(
            username="clarification-analyser",
            email="clarification@example.com",
            password="password",
            role="analyser",
        )
        token = signing.dumps(
            {"user_id": self.analyser.id, "role": self.analyser.role},
            salt="gem-api-auth",
        )
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def post_rows(self, rows):
        return self.client.post(
            "/api/gem/clarification-results/",
            data=json.dumps({"results": rows}),
            content_type="application/json",
            **self.auth,
        )

    @staticmethod
    def row(bid_no, history, pending=True):
        return {
            "bid_no": bid_no,
            "item_name": "Desktop",
            "clarification_status": "Pending Clarification" if pending else "Clarification Submitted",
            "is_pending": pending,
            "clarification_at": "2026-11-02T10:00:00",
            "history": history,
        }

    def test_saves_and_lists_pending_clarifications(self):
        history = [{"Date": "2026-11-02 10:00", "Clarification Sought": "Upload OEM authorisation", "Response": ""}]
        response = self.post_rows([
            self.row("GEM/2026/B/1", history),
            self.row("GEM/2026/B/2", history, pending=False),
            self.row("GEM/2026/B/3", [], pending=False) | {"clarification_status": ""},
        ])
        payload = response.json()
        self.assertEqual(payload["saved"], 2)
        self.assertEqual(payload["rejected"], 1)

        listing = self.client.get("/api/gem/clarification-results/?status=pending", **self.auth).json()
        self.assertEqual([item["bid_no"] for item in listing["results"]], ["GEM/2026/B/1"])
        self.assertEqual(listing["results"][0]["history"], history)
        self.assertEqual(listing["summary"]["pending"], 1)

    def test_rescan_without_history_keeps_saved_history(self):
        history = [{"Date": "2026-11-02 10:00", "Clarification Sought": "Upload datasheet"}]
        self.post_rows([self.row("GEM/2026/B/1", history)])
        self.post_rows([self.row("GEM/2026/B/1", [], pending=False)])
        result = GemClarificationResult.objects.get(bid_no="GEM/2026/B/1")
        self.assertEqual(result.history, history)
        self.assertFalse(result.is_pending)

    def test_bulk_delete(self):
        self.post_rows([self.row("GEM/2026/B/1", [{"a": "b"}]), self.row("GEM/2026/B/2", [{"a": "b"}])])
        ids = list(GemClarificationResult.objects.values_list("id", flat=True))
        response = self.client.delete(
            "/api/gem/clarification-results/",
            data=json.dumps({"ids": ids}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.json()["deleted"], 2)
        self.assertFalse(GemClarificationResult.objects.exists())
