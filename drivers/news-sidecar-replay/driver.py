"""Offline committed headline bytes -> actual sidecar exporter -> actual renderer."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PINS = json.loads((HERE / "pins.json").read_text(encoding="utf-8"))
HELPER = HERE.parent / "prospecting-observation/driver.py"
SPEC = importlib.util.spec_from_file_location("committed_observation_reader", HELPER)
READER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(READER)
PRODUCER_FILES = ["automation/news/" + name for name in (
    "__init__.py", "build_news_priority.py", "news_algorithm.py", "pipeline_headlines.py",
    "datacentre_feed.py", "names.py", "schema/pipeline-headlines.v1.schema.json")]


def run(repo):
    with tempfile.TemporaryDirectory(prefix="testcode-news-replay-") as temporary:
        scratch = Path(temporary)
        product, corpus, old = [scratch / name for name in ("product", "corpus", "historical")]
        for directory in (product, corpus, old):
            directory.mkdir()
        sources = {}
        for name, commit, paths, destination in (
            ("implementation", PINS["implementation"], PRODUCER_FILES + [PINS["paths"]["renderer"]], product),
            ("headlines", PINS["headlines"], [PINS["paths"]["headlines"]], corpus),
            ("historical_renderer", PINS["historical_renderer"], [PINS["paths"]["historical_renderer"]], old),
        ):
            archive = READER.extract(repo, commit, paths, destination)
            sources[name] = {"commit": commit, "archive_sha256": archive, "files": {
                path: {"sha256": hashlib.sha256((destination / path).read_bytes()).hexdigest(),
                       "blob": READER.git(repo, "rev-parse", commit + ":" + path).decode().strip()} for path in paths}}
        headline_path = corpus / PINS["paths"]["headlines"]
        if len(json.loads(headline_path.read_bytes())["items"]) != PINS["expected_items"]:
            raise READER.ProofError("Committed headline corpus count differs")
        code, inputs = READER.json_process([sys.executable, "-B", str(HERE / "produce.py"), str(product), str(headline_path)])
        if code or inputs.get("schema") != "testcode.news-sidecar-inputs.v1" or inputs.get("network_attempts") != 0:
            raise READER.ProofError("Sidecar producer replay failed")
        payload = {"script": (product / PINS["paths"]["renderer"]).read_text(encoding="utf-8"),
                   "historical_script": (old / PINS["paths"]["historical_renderer"]).read_text(encoding="utf-8"), "inputs": inputs}
        child = subprocess.run(["node", str(HERE / "observe.cjs")], input=json.dumps(payload),
                               capture_output=True, text=True, encoding="utf-8", timeout=60)
        try:
            result = json.loads(child.stdout)
        except (ValueError, UnicodeError):
            raise READER.ProofError("Renderer returned no structured observation") from None
        if child.returncode not in (0, 1) or result.get("error_kind") or not result.get("checks"):
            raise READER.ProofError("Renderer execution failed")
        if (child.returncode == 0) != (result.get("pass") is True):
            raise READER.ProofError("Renderer status and verdict disagree")
        return {"pass": result["pass"], "checks": result["checks"],
                "check_count": len(result["checks"]), "passed_count": sum(c["pass"] is True for c in result["checks"]),
                "cases": result["cases"], "negative_control": result["negative_control"],
                "sources": sources, "node_version": result["node_version"],
                "input_sha256": inputs["input_sha256"], "sidecar_sha256": inputs["sidecar_sha256"],
                "deterministic_sidecar": inputs["deterministic"], "input_unchanged": inputs["input_unchanged"]}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--product-repo", required=True, type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv)
    proof_files = [HERE / name for name in ("driver.py", "produce.py", "observe.cjs", "pins.json")] + [HELPER]
    report = {"schema": "testcode.news-sidecar-replay.v1", "repository": PINS["repository"], "network": False,
              "python_version": sys.version.split()[0], "proof_files_sha256": {
                  path.relative_to(ROOT).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in proof_files},
              "limits": ["Committed headline metadata replay, not article-body research or source rights acceptance",
                         "Counterfactual source states are synthetic controls, not new collection receipts",
                         "Minimal Node VM DOM, not browser layout, Android, live health or release acceptance"]}
    try:
        if args.out and args.out.exists():
            raise READER.ProofError("Receipt output already exists")
        report.update(run(args.product_repo))
    except (READER.ProofError, OSError, ValueError, KeyError, subprocess.TimeoutExpired) as exc:
        report.update({"pass": False, "error_kind": type(exc).__name__})
        if isinstance(exc, READER.ProofError):
            report["error"] = str(exc)
    text = json.dumps(report, sort_keys=True, indent=2) + "\n"
    if args.out and not args.out.exists():
        try:
            with args.out.open("x", encoding="utf-8") as stream:
                stream.write(text)
        except OSError:
            report.update({"pass": False, "error_kind": "RECEIPT_WRITE_FAILED"})
            text = json.dumps(report, sort_keys=True, indent=2) + "\n"
    print(text, end="")
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
