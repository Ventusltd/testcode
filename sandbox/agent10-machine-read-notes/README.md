# Agent 10 — Machine Read Notes executable prototype

**Scope:** isolated `Ventusltd/testcode` branch `agent10/machine-read-notes-20261115`, PR #15, `sandbox/agent10-machine-read-notes/`. **No production deployment.** This README supersedes the initial documentation-only work order with executable behaviour and known limits; the full assignment remains in [Neural Link #40](https://github.com/Ventusltd/neural-link-between-agents/issues/40).

## Run

```sh
cd sandbox/agent10-machine-read-notes
bash scripts/run-offline.sh
python -m src.cli --output ui/fixture-data.json --as-of 2026-11-15
python -m http.server 8000 --directory ui
# Visit http://localhost:8000
python scripts/browser_check.py  # requires Python Playwright + Chromium; independently fails if absent
```

The prototype is **offline and deterministic**: Python stdlib `src.engine` verifies each synthetic input, preserves its frozen row/status and renders conservative, attributed explanations. `src.cli` writes canonical JSON using a fixed injected collection date. A pre-rendered HTML fallback displays all three records without JavaScript. With JavaScript, the generated `ui/fixture-data.json` powers REPD-specific buttons and disclosures. Article URLs use `.invalid` reserved examples, not asserted real citations. `jsonschema` is needed for contract tests and Playwright for browser checks, with dependencies pinned by CI.

## Security and acceptance boundaries

- All fixture REPD rows and article receipts are **illustrative synthetic data**, not the original Q3 DESNZ extract nor captured publisher bytes. **7,775-identity verification: UNVERIFIED.** Actual snapshot ingestion, original status reconciliation and independent owner acceptance remain separate future work.
- No candidate can be automatically upgraded to `INDEPENDENTLY CORROBORATED`: a hash-shaped string, source URL, claimed review or claimed permission is not trust evidence. The current MVP deliberately rejects self-declared positive rights and acceptance. Only separate out-of-band authenticated review could unlock such states in a later contract.
- Event dates, publication dates, fetch timestamps and first-seen timestamps remain independently typed. Date-only values are never invented midnight UTC instants. Future dates, conflicts and timezone-free instants are rejected.
- Binding uses exact explicit REPD metadata or remains candidate/insufficient. `tie_break_only` and `unknown` are **INSUFFICIENT EVIDENCE**. Related publisher brands and URLs cannot create independent corroboration.
- Events are keyed by project, event class and authoritative event reference/date if evidenced. Without those anchors, distinct canonical original URLs stay distinct. Installation commencement never silently becomes government consent or the overall project status.
- Short deterministic facts are built from enums and the original frozen row. A post-render validator rejects unapproved URLs, dates, stamps, status or un-attributed claims. No article HTML is rendered, no remote AI inference is used, no text reproduction right is presumed.

## Validation evidence

`python -m unittest discover -s tests -v` exercises **45 assertions/scenarios**, including **40** named adversarial/safety controls and **5** schema/UI checks. The initial local run produced **2 FAIL** (test harness wrongly assumed sorted note 0 was REPD 12588); the corrected assertion locates the ID rather than using array position and then passes. This is a test-harness correction, **not evidence of a previously unsafe production implementation**. See `docs/RECEIPTS.md` and generated test reports. Browser acceptance requires real screenshot and semantic checks; a text-only grep cannot establish mobile usability. CI must pin the Git SHA and upload artifacts; without that receipt, CI status remains UNVERIFIED.

## Integration sequence

1. Exact SHA TestCode offline and browser validation, independent review.
2. Separate owner approval for non-live post-V9.22 GlobalGrid2050 preview branch.
3. Owner physical iPhone Safari and independent reviewer accept the **same** served/source SHA.
4. Separate owner authorisation for any V9.23 publishing. Agent9 GridAtlas work and Agent8 V9.22 remain untouched.

## Successor development (Agent 10, V9.23-or-later)

The separate [`fullscreen-report/`](fullscreen-report/README.md) demonstrates portrait/landscape, filtered previous/next, focus management, additive report URL and a fully precomputed note with a decorative typed duplicate. The shared generic asset adapters live under `src/adapters/` and enforce native REPD or data-centre IDs, optional geometry, distinct IT-load/grid MW, candidate-only sidecars and unchanged original MAP URL bytes. This is **TestCode only**, not a product feature yet. Execute `bash scripts/run-offline.sh` and the dedicated `scripts/report_browser_check.py` in real browsers. Earlier successful browser CI for the original Machine Read Notes table does **not** constitute report-mode acceptance.
