"""Run from the project directory: python -m src.cli --output ui/fixture-data.json"""
import argparse
from datetime import date
import json
from pathlib import Path
from .engine import build, stable_json


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", type=Path, default=Path("fixtures/repd.synthetic.json"))
    parser.add_argument("--receipts", type=Path, default=Path("fixtures/receipts.synthetic.json"))
    parser.add_argument("--as-of", default="2026-11-15", help="Explicit injected collection date")
    parser.add_argument("--output", type=Path, default=Path("results/machine-read-notes.json"))
    args = parser.parse_args()
    source = json.loads(args.snapshot.read_text(encoding="utf8"))
    receipts = json.loads(args.receipts.read_text(encoding="utf8"))
    bundle = build(source, receipts, date.fromisoformat(args.as_of))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(stable_json(bundle) + "\n", encoding="utf8")
    print(f"{len(bundle['notes'])} synthetic notes; SHA256 {bundle['bundle_sha256']}; full 7775 identity audit UNVERIFIED")


if __name__ == "__main__":
    main()
