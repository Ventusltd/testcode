"""Offline store -> prospecting -> JavaScript consumer integration proof.

Only committed Git archives are read. No adjacent working files, collection,
installation, credentials, public writes or production registry changes occur.
"""
from pathlib import Path
import argparse
import hashlib
import io
import json
import re
import subprocess
import sys
import tarfile
import tempfile

HERE = Path(__file__).resolve().parent
PINS = json.loads((HERE / "pins.json").read_text(encoding="utf-8"))
HEX = re.compile(r"[a-f0-9]{40}")


class ProofError(Exception):
    pass


def git(repo, *args):
    result = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, timeout=60)
    if result.returncode:
        raise ProofError("Required committed input unavailable")
    return result.stdout


def extract(repo, commit, paths, destination):
    if not HEX.fullmatch(commit):
        raise ProofError("Full immutable commit required")
    if git(repo, "rev-parse", "--verify", commit + "^{commit}").decode().strip() != commit:
        raise ProofError("Commit identity differs")
    raw = git(repo, "archive", "--format=tar", commit, *paths)
    if len(raw) > 256 * 1024 * 1024:
        raise ProofError("Committed fixture exceeds archive bound")
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:") as archive:
        for member in archive.getmembers():
            target = (destination / member.name).resolve()
            if (not target.is_relative_to(destination.resolve()) or "\\" in member.name
                    or not (member.isdir() or member.isfile())):
                raise ProofError("Unsupported archive member")
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.extractfile(member).read())
    return hashlib.sha256(raw).hexdigest()


def json_process(command, *, timeout=60):
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", timeout=timeout)
    try:
        payload = json.loads(result.stdout)
    except (ValueError, UnicodeError):
        raise ProofError("Child did not return a structured receipt") from None
    return result.returncode, payload


def run_composition(repo, producer_commit, consumer_commit):
    with tempfile.TemporaryDirectory(prefix="testcode-observation-") as temporary:
        scratch = Path(temporary)
        product, outputs = scratch / "product", scratch / "outputs"
        product.mkdir()
        archive_sha = extract(repo, producer_commit,
                              ["automation/news", "uk_renewables_pipeline/" + PINS["baseline"]], product)
        consumer_sha = extract(repo, consumer_commit, ["automation/news/prospecting-ui"], product)
        code, fixture = json_process([sys.executable, "-B", str(HERE / "fixture_worker.py"),
                                      str(product), str(outputs)])
        if code or fixture.get("schema") != "testcode.prospecting-fixture.v1":
            raise ProofError("Product fixture generation failed")
        results = []
        for case in fixture["cases"]:
            code, receipt = json_process([
                "node", str(HERE / "consumer.mjs"),
                "--adapter", str(product / "automation/news/prospecting-ui/adapter.mjs"),
                "--artifact", str(outputs / case["artifact"]),
                "--expected", str(outputs / case["expected"]),
                "--artifact-sha256", case["artifact_sha256"]])
            if receipt.get("schema") != "testcode.prospecting-consumer.v1" or receipt.get("error_kind"):
                raise ProofError("Consumer execution failed")
            if not receipt.get("checks") or code not in (0, 1) or (code == 0) != (receipt.get("pass") is True):
                raise ProofError("Consumer verdict and process status disagree")
            backend = case.get("backend_checks")
            if not backend or any(type(check.get("pass")) is not bool for check in backend):
                raise ProofError("Backend observation checks absent")
            results.append({"case": case["name"], "artifact_sha256": case["artifact_sha256"],
                            "snapshot_sha256": case["snapshot_sha256"],
                            "project_score": case["project_score"], "returned_cutoff_score": case["returned_cutoff_score"],
                            "consumer": receipt, "checks": backend + receipt["checks"],
                            "pass": receipt["pass"] and all(check["pass"] for check in backend)})
        if [case["case"] for case in results] != ["empty_later_scan", "observed_again"]:
            raise ProofError("Required fixture coverage absent")
        return {"producer_commit": producer_commit, "consumer_commit": consumer_commit,
                "producer_archive_sha256": archive_sha, "consumer_archive_sha256": consumer_sha,
                "producer_blob": git(repo, "rev-parse", producer_commit + ":automation/news/prospecting.py").decode().strip(),
                "consumer_blob": git(repo, "rev-parse", consumer_commit + ":automation/news/prospecting-ui/adapter.mjs").decode().strip(),
                "official_population": fixture["official_population"], "solar1000_count": fixture["solar1000_count"],
                "as_of": fixture["as_of"], "selected_project": fixture["selected_project"], "cases": results,
                "pass": all(case["pass"] for case in results)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--product-repo", required=True, type=Path)
    parser.add_argument("--producer", default=PINS["producer"])
    parser.add_argument("--consumer", default=PINS["consumer"])
    parser.add_argument("--prove-negative-control", action="store_true")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    report = {"schema": "testcode.prospecting-observation.v1", "repository": PINS["repository"],
              "synthetic_evidence": True, "network": False,
              "python_version": sys.version.split()[0],
              "proof_files_sha256": {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest()
                                     for name in ("driver.py", "fixture_worker.py", "consumer.mjs", "pins.json")},
              "limits": ["JavaScript adapter proof, not a browser or Android test",
                         "Synthetic articles and access receipts do not establish live evidence or rights",
                         "No NEWS ranking, corporate enrichment or production publication acceptance"]}
    try:
        if args.out and args.out.exists():
            raise ProofError("Receipt output already exists")
        runtime = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=10)
        if runtime.returncode or not re.fullmatch(r"v[0-9]+\.[0-9]+\.[0-9]+", runtime.stdout.strip()):
            raise ProofError("Node runtime version unavailable")
        report["node_version"] = runtime.stdout.strip()
        if args.prove_negative_control:
            negative = run_composition(args.product_repo, PINS["negative_control"], args.consumer)
            failed = [check["name"] for check in negative["cases"][0]["checks"] if not check["pass"]]
            # An import failure or empty proof must never count as catching the defect.
            required = {"backend_follow_up_points", "backend_observation_state", "backend_observed_at", "project_membership"}
            detected = not negative["pass"] and required.issubset(failed) and negative["cases"][1]["pass"]
            report["negative_control"] = {"expected_failure_detected": detected, **negative}
            if not detected:
                raise ProofError("Negative control did not expose the observation-clock defect")
        current = run_composition(args.product_repo, args.producer, args.consumer)
        report.update(current=current, **{"pass": current["pass"]})
    except (ProofError, OSError, subprocess.TimeoutExpired) as exc:
        report.update({"pass": False, "error_kind": type(exc).__name__})
        if isinstance(exc, ProofError):
            report["error"] = str(exc)
    text = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.out and not args.out.exists():
        args.out.write_text(text, encoding="utf-8")
    print(text, end="")
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
