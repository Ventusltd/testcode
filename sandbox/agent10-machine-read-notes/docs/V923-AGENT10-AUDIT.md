# Agent 10 — V9.23-or-later isolated continuation audit

**Audit target:** `Ventusltd/testcode` branch `agent10/machine-read-notes-20261115` draft PR #15. Owner is separately publishing the already-merged V9.22 source; **no production edits authorised**.

## Change summary

- Native, additive Pipeline News architecture only: source register stays authoritative; Machine Read Notes is an optional sidecar keyed by four-part asset identity. REPD `repd_ref` is never synthesised for a data-centre asset.
- `src/compat.py` and `src/adapters/records.py` expose pure REPD and data-centre adapters; map href is passed through byte-for-byte after canonical receiver validation. Data-centre site IDs, site keys, optional point and IT load vs stated grid-connection MW are preserved as distinct concepts.
- Versioned `contracts/asset_key.schema.json` and `contracts/machine_read_notes_sidecar.schema.json` fail closed on missing identity/rights and unsupported acceptance states.
- `fullscreen-report/` has a standalone accessible portrait/landscape synthetic report sample. It is a **TestCode proof fixture**, not a separate product nor a live UI. It supports precomputed notes, initial readable text, decorative-only print/reveal, filtered navigation, Back/Escape, focus return, safe areas and printable report.
- `tests/test_adapters_report.py`: 22 initial adapter/report controls and 8 further source-integrity adversarial checks; combined pre-existing 45 gives 75 local unittest cases before CI. Adversarial cases include map receiver substitution, source mutation, orphan notes, rights elevation, forged data-centre REPD key, duplicate project IDs, missing geometry and invalid load inference.

## Scope and evidence grades

Local invocation: `python -m unittest discover -s tests -q` -> 67 tests PASS. `node --check fullscreen-report/report-mode.js` -> PASS. `ALLOW_OFFLINE_COMPOSE=1 python scripts/report_browser_check.py --engine chromium` -> 9 synthetic browser cases PASS across six viewports (local in-memory pages, real-browser interactions but **no true history navigation**); WebKit locally **UNVERIFIED** because the browser executable is not installed. A real localhost/CI run and saved browser traces are still required. Script is scoped CI gated with dedicated Chromium and WebKit calls; a new commit must obtain its own exact-HEAD results before claiming CI accepted.

**UNVERIFIED:** source 7,775 identities; actual publisher retrieval/ownership/rights; original Pipeline News MAP / CSV / filter full-corpus comparison; upstream GridAtlas 390px first-restore visibility; served preview source/hash; owner physical iPhone acceptance. Existing V9.22 release and Agent9 branch are untouched. A test against synthetic fixtures cannot satisfy any of these checks.

## Release gates

1. V9.22 remains immutable. No post-V9.22 feature promoted to that release.
2. The next product integration must be a separate approved GlobalGrid2050 new-version branch, preserving all original official records, MAP actions, sort/filter/CSV and old version folders.
3. Independent source and CI review must identify the same exact SHA. A non-live candidate with served-byte evidence needs separate owner authorisation.
4. Owner iPhone Safari portrait/landscape report-mode acceptance and separate reviewer acceptance precede any product publication. Do not interpret an issue comment as approval.

## Explicit real-V9.22 source integrity gate (new)

A separate no-publishing CI job checks out `Ventusltd/globalgrid2050` exactly at merged V9.22 source commit `0719ddc28f2a418281594549d4667c9916ff6b20`, sparse-checks the 16 `data/v9.1/projects/part-###.json` partitions, and runs `scripts/audit_v922_source.py`. The gate requires precisely **7,775 numeric unique REPD IDs**, declared part-row parity and no missing partitions, stable source rows/status, and zero note-sidecar mutation. Each partition SHA256 is written into an output artifact. If the pinned source is unavailable, the gate FAILS rather than reporting a synthetic pass. This is **product V9.22 partition consistency**, NOT verification against the independent official DESNZ XLSX, live generated MAP hrefs or visible GridAtlas first-restore result.

### CI remediation receipt — 556bf74

First real source-integrity job at SHA `556bf743c492a95d395ec7856a519ac774de1e51` failed before data evaluation with `ModuleNotFoundError: No module named 'src'`: CLI called `python scripts/audit_v922_source.py`, which placed `scripts/` rather than project root on `sys.path`. This is an **actual red integration test**, not a data mismatch or a successful 7,775 audit. Corrected the workflow to `python -m scripts.audit_v922_source` and require a separate exact-head CI result before elevating source integrity. Original failed run: https://github.com/Ventusltd/testcode/actions/runs/43773953167/job/132995951631 .

## UI screenshot refinement (390 px)

Inspected real locally composed Chromium screenshot `results/report-browser/chromium-390x844.png`; initial design used ~100px mobile header because `Close report`, project title and `Fullscreen` crowded a 390px line. Changed the visible close text to **Close** with full screen-reader label, hid native Fullscreen API progressive enhancement at widths under 900px, compacted the overline and frozen-facts spacing. Full-window CSS overlay remains functional without browser Fullscreen API. Re-ran 9/9 local Chromium cases at six viewports, including portrait/landscape; this is still not a served page / real iPhone receipt. Exact-head hosted browser check must be rerun after UI change.

## Browser stress extension

Extended `scripts/report_browser_check.py` beyond six viewport checks: it explicitly injects >2,000 characters, a >600-character unbroken URL and `<img onerror=...>` as inert text into the already-precomputed brief; asserts zero HTML injection and no horizontal overflow. Print emulation verifies the shell becomes static, the full original brief stays visible, and animation is removed. Local composed Chromium: **11/11** browser cases (still cannot prove real browser history or served-preview SHA). Exact-head CI must independently run Chromium and WebKit after the change.
