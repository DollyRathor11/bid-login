from unittest.mock import patch

from django.test import SimpleTestCase
from django.utils import timezone

from accounts.models import GemRepresentationResult
from accounts.views.GemRepresentations import (
    _apply_replies, _carry_replies, _has_pending_reply, delete_ended_representations,
)


class RepresentationReplyTests(SimpleTestCase):
    def test_only_our_representation_gets_the_reply(self):
        rows = [{"bid_section": "Spec", "representation": "Please change the speakers.", "submitted_on": "1"}]
        count = _apply_replies(rows, [
            {"query": "Another seller asked something else", "reply": "No"},
            {"query": "please change  the SPEAKERS", "reply": "Disagree"},
        ], "10-11-2026 04:15 PM")
        self.assertEqual(count, 1)
        self.assertEqual(rows[0]["reply"], "Disagree")
        self.assertEqual(rows[0]["reply_published_on"], "10-11-2026 04:15 PM")
        self.assertFalse(_has_pending_reply(rows))

    def test_cut_off_text_matches_only_when_long_enough(self):
        full = "The warranty for the interactive panel has been asked for three years which is too long"
        rows = [{"representation": full[:50]}, {"representation": "The"}]
        self.assertEqual(_apply_replies(rows, [{"query": full, "reply": "Noted"}], ""), 1)
        self.assertEqual(rows[0]["reply"], "Noted")
        self.assertNotIn("reply", rows[1])
        self.assertTrue(_has_pending_reply(rows))

    def test_rescan_keeps_saved_replies(self):
        fresh = [{"representation": "Query one"}, {"representation": "Query two"}]
        _carry_replies(fresh, [{"representation": "query one", "reply": "Yes", "reply_published_on": "d"}])
        self.assertEqual(fresh[0]["reply"], "Yes")
        self.assertEqual(fresh[0]["reply_published_on"], "d")
        self.assertNotIn("reply", fresh[1])


class EndedRepresentationTests(SimpleTestCase):
    def test_bids_whose_end_date_has_passed_are_deleted(self):
        now = timezone.now()
        with patch.object(GemRepresentationResult.objects, "filter") as rows:
            rows.return_value.delete.return_value = (2, {})
            self.assertEqual(delete_ended_representations(now), 2)
        rows.assert_called_once_with(end_date__lt=now)
