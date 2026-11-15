# Agent10 local receipts — 2026-11-15

- Work-order branch at invocation: `1259ce5176b86110978557149d87d3a46b101a71`.
- Commands: `python -m src.cli --output ui/fixture-data.json`, `python -m src.cli --output results/machine-read-notes.json`, `python -m unittest discover -s tests -v`, `node --check ui/machine-read-notes.js`.
- Fixed as-of: `2026-11-15`. Synthetic notes: **3**, sample REPD references 12588, 15793, 2527. No publisher source was fetched. Real-world authenticity: **UNVERIFIED**. Full 7,775 REPD identity audit: **UNVERIFIED**.
- Initial local test run **40 tests, 2 failures**: tests 04 and 40 assumed sorted entry `notes[0]` was Botley West, while deterministic numeric sorting places REPD 2527 first. No unsafe engine claim was observed. Corrected tests look up REPD 12588 by ID. This failure-to-pass is test-harness evidence, not an engine vulnerability found and fixed.
- After correction: **40/40** engine checks, then **45/45** including schema and static UI validation.
- Bundle digest: record exact computed digest in `ui/fixture-data.json` and `results/machine-read-notes.json`. These are identical canonical JSON outputs.
- Browser evidence: see `results/browser/browser-receipts.json` and PNG screenshots when executed, including 390, 393 and 1440 px. Browser receipts must not be claimed if script cannot launch.
- CI exact-GitHub-SHA status: UNVERIFIED until Actions runs on the committed implementation SHA. GitHub Action logs, not this file, establish independent CI status.
- Local Chromium browser composition: **5/5 scenarios PASS** using exact local UI source bytes and fixture JSON: 390px, 393px, 1440px open/close and keyboard, 393px reduced motion, 390px JavaScript-disabled native disclosure. HTML/CSS/JS SHA256 and screenshot filenames recorded in `results/browser/chromium-browser-receipts.json`. This is **not** a hosted/public-preview or real iPhone Safari test. WebKit not installed locally and remains UNVERIFIED pending CI.
