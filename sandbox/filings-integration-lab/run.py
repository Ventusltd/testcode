"""Offline consumer gate. Missing inputs, failures, skips and zero tests fail."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import unittest

from lab_support import HERE, verify_inputs


def deny_network(event, args):
    if event.startswith("socket."):
        raise RuntimeError("Network is disabled in the offline filings lab")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inputs", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    os.environ["FILINGS_LAB_INPUTS"] = str(Path(args.inputs).resolve())
    sys.dont_write_bytecode = True
    sys.addaudithook(deny_network)
    report = {"schema": "testcode.filings-consumer-gate.v1", "status": "FAIL",
              "generated_at": datetime.now(timezone.utc).isoformat(),
              "network": "socket audit events denied", "fixtures": "synthetic",
              "source_inputs": [], "tests_run": 0, "skipped": 0}
    try:
        report["lab_files"] = {str(path.relative_to(HERE)).replace("\\", "/"):
                               hashlib.sha256(path.read_bytes()).hexdigest()
                               for path in sorted(HERE.rglob("*"))
                               if path.is_file() and path.suffix in {".py", ".json"}}
        report["source_inputs"] = verify_inputs()
        suite = unittest.defaultTestLoader.discover(str(HERE / "tests"), pattern="test_*.py")
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        report.update(tests_run=result.testsRun, skipped=len(result.skipped),
                      failures=[test.id() for test, _ in result.failures],
                      errors=[test.id() for test, _ in result.errors],
                      expected_failures=[test.id() for test, _ in result.expectedFailures],
                      unexpected_successes=[test.id() for test in result.unexpectedSuccesses])
        if result.wasSuccessful() and result.testsRun and not result.skipped and not result.expectedFailures:
            report["status"] = "PASS"
    except Exception as exc:
        # Do not publish local paths, bodies or caller metadata in the receipt.
        report["input_or_runner_error"] = type(exc).__name__
        print(f"Offline gate failed: {type(exc).__name__}: {exc}", file=sys.stderr)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
