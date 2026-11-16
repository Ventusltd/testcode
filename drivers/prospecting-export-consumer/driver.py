"""Offline committed exporter -> complete files -> real manifest-aware UI parser."""
from pathlib import Path
from contextlib import redirect_stdout, redirect_stderr
import argparse
import csv
import hashlib
import importlib.util
import io
import json
import os
import socket
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
PINS = json.loads((HERE / "pins.json").read_text(encoding="utf-8"))
READER_PATH = HERE.parent / "prospecting-observation/driver.py"


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def reader():
    spec = importlib.util.spec_from_file_location("prospecting_export_committed_reader", READER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def encoded(value):
    return (json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def baseline(product):
    """Read the committed baseline independently of the export's inventory."""
    release = product / "uk_renewables_pipeline" / PINS["baseline"]

    def pinned(path, expected):
        target = (release / path).resolve()
        if not target.is_relative_to(release.resolve()):
            raise ValueError("Baseline path outside release")
        raw = target.read_bytes()
        if digest(raw) != expected:
            raise ValueError("Baseline digest differs")
        return json.loads(raw)

    manifest = pinned("data/v9.1/build_manifest.json", PINS["build_manifest_sha256"])
    pilot = pinned("solar1000/manifest.json", PINS["solar1000_manifest_sha256"])
    rows = []
    for part in manifest["project_partitions"]:
        values = pinned(part["path"], part["sha256"])["projects"]
        if len(values) != part["record_count"]:
            raise ValueError("Baseline partition count differs")
        rows.extend(values)
    ids = ["REPD-" + row["repd_ref"] for row in rows]
    solar = sorted((row["repd_ref"] for row in rows if row["technology"] == "solar"), key=int)
    if len(ids) != len(set(ids)) or len(ids) != 7775 or len(solar) != 3604:
        raise ValueError("Baseline population differs")
    if pilot["selection_count"] != 1000 or pilot["ids"] != solar[:1000]:
        raise ValueError("Baseline Solar-1000 differs")
    return {"official_ids": ids, "solar1000_ids": pilot["ids"], "official_receipt": {
        "id": "official_repd", "state": "OFFICIAL", "release": PINS["baseline"],
        "manifest_sha256": PINS["build_manifest_sha256"],
        "solar1000_manifest_sha256": PINS["solar1000_manifest_sha256"],
        "source_workbook_sha256": manifest["source_workbook_sha256"],
        "source_dataset": manifest["source_dataset"], "observed_at": None,
        "freshness": "UNKNOWN", "population": 7775, "solar1000_count": 1000,
    }}


def worker(product, output):
    """Isolated child: no product exception text or paths enter the receipt."""
    attempts = []

    def blocked(*args, **kwargs):
        attempts.append(True)
        raise RuntimeError("Offline network disabled")

    socket.socket = blocked
    socket.create_connection = blocked
    socket.getaddrinfo = blocked
    sys.path.insert(0, str(product))
    checks = []

    def check(name, passed):
        checks.append({"name": name, "pass": passed is True})

    try:
        from automation.news import build_prospecting_priority as exporter
        expected = baseline(product)
        output.mkdir()
        (output / "expected.json").write_bytes(encoded(expected))

        def export(destination, as_of):
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                return exporter.main(["--as-of", as_of, "--out-dir", str(destination)])

        for name, as_of in (("primary", PINS["as_of"]), ("replay", PINS["as_of"]),
                           ("alternate", PINS["alternate_as_of"])):
            check(name + "_export_cli_success", export(output / name, as_of) == 0)
        names = {"priority.json", "priority.csv", "manifest.json"}
        primary = {name: (output / "primary" / name).read_bytes() for name in names}
        check("complete_export_file_set", {p.name for p in (output / "primary").iterdir()} == names)
        check("deterministic_export_bytes", all(primary[name] == (output / "replay" / name).read_bytes() for name in names))
        manifest = json.loads(primary["manifest.json"])
        triage = json.loads(primary["priority.json"])
        table = list(csv.DictReader(io.StringIO(primary["priority.csv"].decode("utf-8"))))
        check("csv_exact_ranked_identity_order", [row["project_id"] for row in table] == [row["id"] for row in triage["records"]])
        check("csv_count_separate_from_official_population", len(table) == 1000 and len(expected["official_ids"]) == 7775)
        check("manifest_inventory_matches_frozen_source", manifest["inventory"]["official_ids"] == expected["official_ids"]
              and manifest["inventory"]["solar1000_ids"] == expected["solar1000_ids"])
        check("all_export_file_receipts", all(manifest["files"][name] == {"bytes": len(primary[name]), "sha256": digest(primary[name])}
                                              for name in ("priority.json", "priority.csv")))
        check("csv_clock_and_unknown_momentum", all(row["as_of"] == PINS["as_of"] and row["momentum_state"] == "UNKNOWN" for row in table))
        overwrite_code = 0
        try:
            export(output / "primary", PINS["alternate_as_of"])
        except SystemExit as exc:
            overwrite_code = exc.code
        check("actual_export_cli_refuses_overwrite", overwrite_code == 2)
        check("rejected_overwrite_preserves_all_bytes", all(primary[name] == (output / "primary" / name).read_bytes() for name in names))
        invalid = output / "invalid-evidence.json"
        invalid.write_bytes(b"{}")
        invalid_code = 0
        try:
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                exporter.main(["--as-of", PINS["as_of"], "--out-dir", str(output / "invalid-output"),
                               "--evidence", str(invalid), "--evidence-sha256", "0" * 64])
        except SystemExit as exc:
            invalid_code = exc.code
        check("invalid_optional_input_rejected_without_output", invalid_code == 2 and not (output / "invalid-output").exists())
        check("producer_network_not_used", not attempts)
        return {"schema": "testcode.prospecting-export-worker.v1", "pass": all(item["pass"] for item in checks),
                "checks": checks, "manifest_sha256": digest(primary["manifest.json"]),
                "official_population": len(expected["official_ids"]), "solar1000_count": len(expected["solar1000_ids"])}
    except Exception:
        return {"schema": "testcode.prospecting-export-worker.v1", "pass": False, "checks": checks,
                "error_kind": "EXPORT_WORKER_FAILED"}


def json_child(command, *, env=None, timeout=60):
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", env=env, timeout=timeout)
    try:
        value = json.loads(result.stdout)
    except (ValueError, UnicodeError):
        raise ValueError("Child receipt unavailable") from None
    return result.returncode, value


def composition(repo, source, self_test):
    committed = reader()
    with tempfile.TemporaryDirectory(prefix="testcode-export-consumer-") as temporary:
        scratch = Path(temporary).resolve()
        product, output = scratch / "product", scratch / "output"
        archive_sha = committed.extract(repo, source,
                                        ["automation/news", "uk_renewables_pipeline/" + PINS["baseline"]], product)
        code, generated = json_child([sys.executable, "-I", "-B", str(HERE / "driver.py"), "--worker", str(product), str(output)])
        if code or generated.get("schema") != "testcode.prospecting-export-worker.v1" or generated.get("error_kind") or not generated.get("checks"):
            raise ValueError("Actual export generation failed")
        args = ["--bundle", str(product / "automation/news/prospecting-ui/bundle.mjs"),
                "--export-dir", str(output / "primary"), "--alternate-dir", str(output / "alternate"),
                "--expected", str(output / "expected.json"), "--manifest-sha256", generated["manifest_sha256"]]
        code, consumer = json_child(["node", str(HERE / "consumer.mjs"), *args])
        if consumer.get("schema") != "testcode.prospecting-export-consumer.v1" or consumer.get("error_kind"):
            raise ValueError("Consumer execution failed")
        if code not in (0, 1) or not consumer.get("checks") or (code == 0) != (consumer.get("pass") is True):
            raise ValueError("Consumer status differs from receipt")
        checks = generated["checks"] + consumer["checks"]
        result = {"source_commit": source, "source_archive_sha256": archive_sha,
                  "source_blobs": {path: committed.git(repo, "rev-parse", source + ":" + path).decode().strip()
                                   for path in ("automation/news/build_prospecting_priority.py",
                                                "automation/news/prospecting-ui/bundle.mjs",
                                                "automation/news/prospecting-ui/adapter.mjs")},
                  "producer": generated, "consumer": consumer, "checks": checks,
                  "pass": generated["pass"] and consumer["pass"]}
        if self_test:
            spec = output / "runtime-spec.json"
            spec.write_bytes(encoded({"args": args}))
            test_run = subprocess.run(["node", "--test", "--test-reporter=tap", str(HERE / "consumer.test.mjs")],
                                      env={**os.environ, "TESTCODE_PROSPECTING_EXPORT_SPEC": str(spec)},
                                      capture_output=True, text=True, encoding="utf-8", timeout=60)
            import re
            count = re.search(r"^# tests (\d+)$", test_run.stdout, re.MULTILINE)
            passed = re.search(r"^# pass (\d+)$", test_run.stdout, re.MULTILINE)
            skipped = re.search(r"^# skipped (\d+)$", test_run.stdout, re.MULTILINE)
            total = int(count.group(1)) if count else 0
            test_pass = test_run.returncode == 0 and total >= 6 and passed and int(passed.group(1)) == total and skipped and int(skipped.group(1)) == 0
            result["node_tests"] = {"pass": bool(test_pass), "count": total}
            checks.append({"name": "node_consumer_self_tests", "pass": bool(test_pass)})
            result["pass"] = result["pass"] and bool(test_pass)
        result["check_count"] = len(checks)
        return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--product-repo", required=True, type=Path)
    parser.add_argument("--source", default=PINS["source"])
    parser.add_argument("--out", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    report = {"schema": "testcode.prospecting-export-proof.v1", "repository": PINS["repository"],
              "pins": PINS, "network": False, "python_version": sys.version.split()[0],
              "limits": ["Actual offline export and JavaScript bundle parser; no DOM/browser/Android claim",
                         "No optional evidence or DC input; unknown remains unknown",
                         "No formal release, live source rights or public deployment acceptance"],
              "proof_files_sha256": {name: digest((HERE / name).read_bytes()) for name in
                                     ("driver.py", "consumer.mjs", "consumer.test.mjs", "pins.json")},
              "imported_reader_sha256": digest(READER_PATH.read_bytes())}
    try:
        if args.out and args.out.exists():
            raise ValueError("Receipt already exists")
        runtime = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=10)
        if runtime.returncode:
            raise ValueError("Node unavailable")
        report["node_version"] = runtime.stdout.strip()
        report.update(composition(args.product_repo, args.source, args.self_test))
    except Exception as exc:
        report.update({"pass": False, "error_kind": type(exc).__name__})
    raw = encoded(report)
    if args.out and not args.out.exists():
        try:
            with args.out.open("xb") as stream:
                stream.write(raw)
        except OSError:
            report.update({"pass": False, "error_kind": "OUTPUT_WRITE_FAILED"})
            raw = encoded(report)
    print(raw.decode("utf-8"), end="")
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--worker":
        receipt = worker(Path(sys.argv[2]).resolve(), Path(sys.argv[3]).resolve())
        print(json.dumps(receipt))
        raise SystemExit(0 if receipt["pass"] else 1)
    raise SystemExit(main())
