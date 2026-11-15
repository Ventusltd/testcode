#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python -m unittest discover -s tests -v
python scripts/mutation_probe.py
node --check ui/machine-read-notes.js
node --check fullscreen-report/report-mode.js
python -m src.cli --output results/machine-read-notes.json
python -m src.cli --output ui/fixture-data.json
cmp results/machine-read-notes.json ui/fixture-data.json
printf 'PASS offline gates; browser check is separate and mandatory for browser acceptance\n'
