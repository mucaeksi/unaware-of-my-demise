import os
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import media_budget  # noqa: E402


class MediaBudgetGuardTest(unittest.TestCase):
    def test_refuses_to_spend_without_a_verified_price(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(media_budget.BudgetBlocked):
                media_budget.estimate_usd("lyria")
        with mock.patch.dict(os.environ, {"UOMD_EST_USD_LYRIA": "0"}):
            with self.assertRaises(media_budget.BudgetBlocked):
                media_budget.estimate_usd("lyria")

    def test_reserves_before_and_settles_after_a_successful_call(self):
        calls = []
        with mock.patch.dict(os.environ, {"UOMD_EST_USD_TTS": "0.002"}), mock.patch.object(
            media_budget, "_cli", side_effect=lambda *a: calls.append(a) or "7"
        ):
            with media_budget.paid_call("TTS", "line", "model-x", prompt="hello"):
                calls.append(("request",))
        self.assertEqual([c[0] for c in calls], ["reserve", "request", "settle"])
        self.assertEqual(calls[2], ("settle", "--id", "7", "--usd", "0.002000"))

    def test_a_failed_request_stays_recorded_as_an_uncertain_charge(self):
        calls = []
        with mock.patch.dict(os.environ, {"UOMD_EST_USD_TTS": "0.002"}), mock.patch.object(
            media_budget, "_cli", side_effect=lambda *a: calls.append(a) or "3"
        ):
            with self.assertRaises(TimeoutError):
                with media_budget.paid_call("TTS", "line", "model-x"):
                    raise TimeoutError()
        self.assertEqual(calls[-1], ("fail", "--id", "3", "--reason", "TimeoutError"))


if __name__ == "__main__":
    unittest.main()
