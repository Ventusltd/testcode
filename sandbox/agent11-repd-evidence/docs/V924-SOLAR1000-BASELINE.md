# Agent 11 V9.24 Solar-1000 — implementation and honest baseline

16 November 2026 · isolated TestCode PR #16 · NON-LIVE · owner Ventus Ltd

## New handoff supersedes old sample-order experiment

Owner's new scope was committed at `Ventusltd/neural-link-between-agents` `d95f0d3a853d068405f172c3f9d6d75f6206a876`. The earlier Agent11 `engine.py` remains intact as a *legacy source-file-order comparison* because it helped uncover the source ambiguity, but it is **not** the V9.24 selection for this owner directive.

Authoritative V9.23 source (immutable product release): https://github.com/Ventusltd/globalgrid2050/tree/1559f40e73a4e454c39b23d5172cf4c5e96ef3ea/uk_renewables_pipeline/202611160020/data/v9.1/projects

16 pinned partitions total **7,775 records**; exactly **3,604** with `repd_technology=Solar Photovoltaics`. Numeric REPD Ref sorting selects **1,000 distinct solar IDs**, starting **1018** (Fen Farm) and ending **2325**. This is a DIFFERENT sample from the source-file-order first 1,000 in the complete 14,967-row DESNZ file, and it deliberately excludes REPD 13899 Feed Millakin and REPD 12588 Botley West.

The committed `fixtures/pinned-v923-solar1000-ids.json` lists **all 1,000 IDs** with source commit and aggregate source digest. The Python `v923.py` generates each selected row's SHA256, a 16-part byte hash manifest and the provenance-labelled JSON sidecar. Original fields/statuses/locations remain untouched.

## Live native V9.23 evidence baseline

V9.23's `scripts/plugins/machine-notes-v923.js` uses the 68-headline feed from `pipeline-news-data/dist/pipeline_headlines.json`, not this engine's future sidecar. A point-in-time pin of that feed at `b00af1e2d5c4f180ca312e10bab0ee5530ef15a3` shows **3 possible name associations** (REPD 12588 Botley West, 2527 Inch Cape and 15793 Green Hill); **0** belong to numeric Solar-1000, and even those three outside the sample are unverified name associations. Native accepted independent evidence in Solar-1000: **ZERO**.

## Implemented

- `v923.py`: pinned 16-part ingestion; 7,775/3,604/1,000 count gates; numeric sorting; unique source identity; 1,000 row SHA256 digests and composite source fingerprint; name, status, planning ref, capacity read only; stable `repd|DESNZ-REPD|2026q3|ID`.
- Stable 1,000-row ledger with distinctions `not_researched`, `search_candidate`, `candidate`, `researched_no_source` and `blocked`. None are independently verified or accepted without separate evidence protocol. Audit contains denominators for research status and honest fallback; do not call unresearched entries `research attempted`.
- Stratified **25-project pilot** seeded with 1018, 1019 and 1020 as chronological identity controls, plus consent, refusal, construction, revised and operational records from diverse councils.
- `engine.py`: strict identity-planning-ref+authority+name association; source chronology; rights and self-review rejection; event class vocabulary and independent-corroboration gate.
- `collect.py`: real, explicit-opt-in **Brave Search API** adapter. `--live` and `BRAVE_SEARCH_API_KEY` BOTH required; max 25 provider calls per run by default, hard 100 cap, delay, per-row failure isolation, idempotent JSONL cache. Search results are search-index CANDIDATES, never publisher receipts. Default dry-run **zero requests and zero attempted records**.
- `agent10_adapter.py`: candidate-only JSON v1 sidecar compatible with Agent10 `DESNZ-REPD` identity contract; does not touch existing producer, GridAtlas, MAP route or CSV.
- Two **source-linked preliminary candidates**, neither an independently attested publisher receipt: REPD 1019 Manor Farm St Ewe council note (14 Mar 2022) about later planning amendment and REPD 1020 Nanterrow Farm local planning listing (16 Oct 2026) about a proposed CCTV/security amendment. Dates are *document/listing* dates, NOT inferred government decision dates. The real underlying publisher URL and location are included in the fixture, rights unknown. The first has been visually cross-checked against the parish PDF; this alone does not provide original server-byte provenance or formal independent editorial acceptance.
- 24+ Python unit tests, 50 deliberate wrong-authority collision variations and 1000-row false-status dry-run control, pinned GitHub Actions CI. GitHub workflow source and stdout are evidence for exact-head code gates, not a live site acceptance.

## Evidence coverage and triage — currently

**Clean V9.23 native baseline (no external candidates):** 1,000 scoped; 0 researched; 0 independently sourced; 0 accepted; 0 actionable; **1,000 not researched**.

**Additional manual pilot-candidate overlay:** 2 provisional source-associated items, **0 verified**, **998 untouched/unresearched**. These rows must remain labelled candidate, not accepted independent coverage.

Proposed priority scoring includes documented project stage, known MW, and a tentative electrical-work opportunity weighting, explicitly labelled HEURISTIC. Scores are not proof of procurement, customer intent or project finance. 2026 data relevance does not imply a 2011 station is a current tender.

## Source collection and safe activation

The collector does NOT search the web unless configured and invoked with explicit `--live`. Brave's documented Web Search API uses `https://api.search.brave.com/res/v1/web/search`, X-Subscription-Token; any token must be stored securely in GitHub Actions secrets, never in repo or browser JS. No unauthorised site scraping, CAPTCHA bypass, contact harvesting or raw article reproductions.

Future collector pipeline: permissioned provider search -> candidate queue -> bounded publisher receipt validation (including actual byte SHA, canonical URL, source owner, source licence and four clocks) -> independent project+event match review -> independent human acceptance -> release-bound sidecar adapter. Do not infer article event dates from search index timestamps.

Review stages: **25 → 100 → 250 → 1000** only once manual sample attribution remains at least 98% with denominators and zero known cross-project leaks. Audit 100 stratified selected rows and 50 collision controls. None of these independent editorial accuracy tests can be counted complete from synthetic CI alone.

## Commands (non-live)

```sh
python -m unittest discover -s sandbox/agent11-repd-evidence -p 'test_*.py' -v
python sandbox/agent11-repd-evidence/v923.py \
  --parts-dir ../globalgrid2050/uk_renewables_pipeline/202611160020/data/v9.1/projects \
  --headlines ../globalgrid2050/dist/pipeline_headlines.json \
  --out-dir /tmp/agent11-v924-baseline --as-of 2026-11-16
python sandbox/agent11-repd-evidence/collect.py \
  --queue /tmp/agent11-v924-baseline/research-queue.json \
  --cache /tmp/agent11-cache.jsonl --out /tmp/agent11-dry-run.jsonl
```

For optional real authorised discovery, supply a correctly configured private `BRAVE_SEARCH_API_KEY` and pass `--live` with bounded `--max-requests`; it is not running on a schedule.

## Release controls

TestCode PR #16 ONLY: https://github.com/Ventusltd/testcode/pull/16
Coordination: https://github.com/Ventusltd/neural-link-between-agents/issues/41 and #40.
Predecessors V9.22/V9.23, homepage, GridAtlas and MAP receiver untouched. No tested product-native V9.24 UI, live provider-byte rights or verified 1,000-source coverage yet. Full UI parity and owner phone + independent reviewer are NOT claimed. Promotion explicitly requires separate owner permission.
