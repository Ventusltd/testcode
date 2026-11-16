"""Fault-injection checks against the actual archived producer and renderer.

Set TESTCODE_PRODUCT_REPO to a pre-provisioned public Git checkout. Missing input
fails rather than skipping. Source mutations exist only in the Node child input.
"""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("news_replay_driver", HERE / "driver.py")
DRIVER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DRIVER)


class ReplayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        value = os.environ.get("TESTCODE_PRODUCT_REPO")
        if not value:
            raise RuntimeError("TESTCODE_PRODUCT_REPO must identify committed public inputs")
        cls.repo = Path(value)

    def mutate_renderer(self, before=None, after=None, *, historical=False):
        real_run = subprocess.run

        def run(command, **kwargs):
            if command[0] == "node" and command[1] == str(HERE / "observe.cjs"):
                payload = json.loads(kwargs["input"])
                if historical:
                    payload["historical_script"] = payload["script"]
                else:
                    self.assertIn(before, payload["script"], "Mutation must reach the pinned source")
                    payload["script"] = payload["script"].replace(before, after, 1)
                kwargs["input"] = json.dumps(payload)
            return real_run(command, **kwargs)

        with patch.object(DRIVER.subprocess, "run", side_effect=run):
            return DRIVER.run(self.repo)

    def test_actual_corpus_composition_and_historical_counterexample(self):
        report = DRIVER.run(self.repo)
        self.assertTrue(report["pass"])
        self.assertEqual((report["check_count"], report["passed_count"]), (67, 67))
        self.assertEqual(len(report["cases"]), 8)
        self.assertEqual(report["negative_control"]["rendered_count"], 65)
        self.assertEqual(report["negative_control"]["missing_policy_count"], 4)
        self.assertTrue(report["negative_control"]["expected_failure_detected"])
        self.assertNotIn(str(self.repo), json.dumps(report))

    def test_lost_show_more_is_detected(self):
        report = self.mutate_renderer("more.addEventListener('click', draw);",
                                     "more.addEventListener('click', function () { list.removeChild(more); });")
        self.assertFalse(report["pass"])
        self.assertIn("current:full_inventory", [c["name"] for c in report["checks"] if not c["pass"]])

    def test_lost_publisher_credit_is_detected(self):
        report = self.mutate_renderer("String(item.source || '')", "''")
        self.assertFalse(report["pass"])
        self.assertIn("current:credits_and_titles", [c["name"] for c in report["checks"] if not c["pass"]])

    def test_ignored_priority_binding_is_detected(self):
        report = self.mutate_renderer("priorities.get(doc)", "null")
        self.assertFalse(report["pass"])
        self.assertIn("current:exact_order", [c["name"] for c in report["checks"] if not c["pass"]])

    def test_stale_cached_priority_after_rejection_is_detected(self):
        report = self.mutate_renderer("priorities.delete(doc);", "/* deliberate fault: keep earlier binding */")
        self.assertFalse(report["pass"])
        self.assertIn("cached_priority_cleared_after_rejection", [c["name"] for c in report["checks"] if not c["pass"]])

    def test_counterexample_cannot_silently_become_a_positive_control(self):
        report = self.mutate_renderer(historical=True)
        self.assertFalse(report["pass"])
        self.assertFalse(report["negative_control"]["expected_failure_detected"])

    def test_missing_input_is_nonzero_and_sanitized(self):
        with tempfile.TemporaryDirectory(prefix="news-replay-missing-") as temporary:
            missing = Path(temporary) / "private-path-must-not-be-reported"
            result = subprocess.run([sys.executable, "-B", str(HERE / "driver.py"), "--product-repo", str(missing)],
                                    capture_output=True, text=True, encoding="utf-8", timeout=20)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stderr, "")
            self.assertFalse(json.loads(result.stdout)["pass"])
            self.assertNotIn(str(missing), result.stdout)
            self.assertNotIn("private-path-must-not-be-reported", result.stdout)

    def test_existing_receipt_is_preserved(self):
        with tempfile.TemporaryDirectory(prefix="news-replay-receipt-") as temporary:
            output = Path(temporary) / "receipt.json"
            output.write_bytes(b"original accepted receipt")
            result = subprocess.run([sys.executable, "-B", str(HERE / "driver.py"), "--product-repo", str(self.repo),
                                     "--out", str(output)], capture_output=True, text=True, encoding="utf-8", timeout=20)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(output.read_bytes(), b"original accepted receipt")
            self.assertNotIn(str(output), result.stdout)

    def test_unwritable_receipt_is_nonzero_without_private_path(self):
        with tempfile.TemporaryDirectory(prefix="news-replay-output-") as temporary:
            output = Path(temporary) / "private-output-parent-missing" / "receipt.json"
            result = subprocess.run([sys.executable, "-B", str(HERE / "driver.py"), "--product-repo", str(self.repo),
                                     "--out", str(output)], capture_output=True, text=True, encoding="utf-8", timeout=20)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stderr, "")
            self.assertEqual(json.loads(result.stdout)["error_kind"], "RECEIPT_WRITE_FAILED")
            self.assertNotIn("private-output-parent-missing", result.stdout)


if __name__ == "__main__":
    unittest.main()
