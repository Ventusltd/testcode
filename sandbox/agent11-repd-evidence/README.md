# Agent 11 — REPD solar-1000 evidence selection and provenance (V9.24 candidate)

**Isolated repository:** `Ventusltd/testcode`; branch `agent11/repd1000-evidence-20261116`; folder `sandbox/agent11-repd-evidence/`. This is a read-only data enrichment experiment, **not production, not an accepted publisher receipt, and not a live release**. Agent 10 owns the deterministic Machine Read Notes UI and fullscreen prototype in TestCode PR #15. Agent 11's output is a potential upstream sidecar input, not a replacement for that schema or agent's code.

## Important source corrections (16 November 2026)

The source `Ventusltd/globalgrid2050/repd-2026q3.csv` at the pinned `1559f40e73a4e454c39b23d5172cf4c5e96ef3ea` commit contains **14,967 rows**, of which **7,649** are exactly `Technology Type = Solar Photovoltaics`. The Pipeline News 7,775 count describes a *different filtered universe* and must not be applied to this CSV's full solar count. There are 349 numeric REPD-ID ordering inversions in the solar subset: **file order is not ascending numeric ID**. To preserve the requested Feed Millakin first record, our reproducible selection is **first 1,000 solar entries in source-file order**. This is explicit metadata, never a silent numeric sort.

- `13899` Feed Millakin is solar index 0, *0.34 MW*, and the official file **already** states `Planning Permission Granted`, decision `18/07/2023`, `Awaiting Construction`. An aggregator reporting consent is *corroboration at best*, not a new status change; third-party REPD-derived listings may be circular evidence.
- `6736` Bilbo Solar Farm is within the first 1,000 (solar index 9). The Aberdeenshire Buchan Area Committee 17 September 2019 agenda *recommended* grant under `APP/2019/0296`. **A committee recommendation is not a granted consent**. Ethical Power separately describes Lynher Energy ownership, January 2024 construction, and 36.6 MW, but January is month precision; this engine must not invent a day.
- `12588` Botley West is solar index 3,753 (outside the first 1,000). Official UK Government and Planning Inspectorate documents put the refusal on **10 November 2026**, not 11 November. This is a later research-library example, **not** coverage for the current 1,000.

## Commands

```sh
python -m unittest discover -s sandbox/agent11-repd-evidence -p 'test_*.py' -v
python sandbox/agent11-repd-evidence/engine.py \
  --csv ../globalgrid2050/repd-2026q3.csv \
  --evidence sandbox/agent11-repd-evidence/fixtures/source-candidates.jsonl \
  --as-of 2026-11-16 --limit 1000 --expect-solar-count 7649 \
  --out /tmp/agent11-notes.json --audit /tmp/agent11-audit.json \
  --queue /tmp/agent11-research-queue.json
```

The CLI produces 1,000 stable keyed note records, an audit ledger and a separate research queue for every row without accepted external candidates. It emits the unmodified official status and maintains official input SHA-256, file-order selection and four separate dates: event/published/fetched/first seen. If publisher publication date is unknown it remains null. Deterministic `canonical()` JSON sorts keys and controls formatting; injected `--as-of` avoids wall-clock nondeterminism.

No action performs automatic search-engine scraping, LLM calls or live portal requests. `source_queries()` prepares **human or authorised search-API queries**, not evidence itself; obtaining results requires a separately permissioned, rate-limited acquisition adapter that captures actual publisher response bytes and preserves origin and rights metadata. The included two web-sourced URLs have **not been independently authenticated as publisher-byte receipts in this code path**. They are source **candidates**, not verified claims.

## Fail-closed contract

- Every note has key `repd|desnz-repd|2026q3|<numeric REPD ID>`. The official CSV is never rewritten; `official_data_mutated: false` is a *design assertion*, backed by pre/post source SHA checks.
- A provided REPD ID alone does not prove an external URL belongs to that project. Exact planning reference must also match planning authority and distinctive site name. Same reference under a different authority is **rejected**, not claimed. Name+county can be included only as a provisional association.
- Unknown rights are always `unknown`; sources and claimed reviewer flags cannot self-promote to independently verified. The public-facing candidate note is a closed-vocabulary factual template, not a copied article, and is **not verified** until independent review.
- Event date must be exact ISO day; month-only milestones are not day-laundered. Published/fetched/first-seen may be null, but never substituted for the event date or used as its ordering key.
- Evidence not passing identity/rights/time checks goes in `rejections`, not into the note. Every source-less asset carries `no_external_evidence`, never fictional commentary.
- The research queue may include sources previously tried but rejected; acquisition systems should maintain a separate deduped query/retry ledger. A valid URL is **not** proof that the original source can be independently accessed or lawfully republished.
- `independently_verified_rows = 0` is intentionally conservative. Passing unit tests demonstrates correct code behaviour, **not** that the 1,000 projects are externally corroborated.

## V9.24 acceptance gates

1. Source-pin and byte audit against an independent government download (our currently pinned GitHub copy is NOT original DESNZ authentication).
2. Independent publisher-byte receipts, reuse/licence checks, exact project-level identity reviews, true uniqueness by publisher owner, and independent 5–10% sample inspection with false-positive negative controls.
3. More authoritative planning feed adapters with strict source-rate limits, caching, backoff and provenance. No HTML/CAPTCHA bypass, unlicensed bulk reprints or invented user interactions. Schedule the collector 0/30 minutes UTC **only after** independent external feed and runtime budgets are validated on a protected branch.
4. Translate accepted output to Agent10's `machine_read_notes_sidecar.schema.json` and test identity, chronology and false-positive gates. The current Agent11 schema is a staging proposal, not an assertion of direct schema compatibility.
5. Real 390px/393px/landscape/1440px browser, iPhone, MAP deep-link receiver (GridAtlas), official CSV export, prev/next state, source/served SHA and rollback parity.
6. An independent reviewer and owner approve non-live preview of V9.24; only the separate publisher may promote a new immutable version. V9.22/V9.23 histories stay untouched.

**Status:** isolated source-matching MVP. Evidence acquisition, 1,000 independently verified remarks, proof of real-world source rights, browser integration and V9.24 public release **NOT COMPLETE**.
