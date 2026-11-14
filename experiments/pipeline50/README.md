# Pipeline50 — 50 numbered TestCode experiment implementations

Owner authorisation 14 November 2026. Dedicated isolated Agent 1 experiment branch. Agent 3 owns separate TestCode #10; Agent 4 owns separate globalgrid2050 #104; Agent A controls integration; Agent 2 reviews independently.

Each file `versions/v001.mjs` through `v050.mjs` is a distinct testcode *gate implementation* with one named quality policy, a golden synthetic acceptance fixture, and an adversarial mutation expected to be rejected. These are **50 QA versions, not 50 production Pipeline News releases**. Golden-only suites can be trivially green, so the runner demands both positive and negative evidence. The master first requires both tests, SHA256-hashes every gate source, then cross-challenges every accepted gate against all 50 independent mutations (50×50 = 2,500 checks). A deterministic greedy set-cover selection removes redundant gates only when the remaining executable master still rejects all 50 adversarial cases. The compiled single-file candidate is explicitly synthetic QA-only, not publication code.

Areas covered: official source identity (5), REPD identity (5), timestamps/replay (5), publisher evidence (5), editorial relevance/duplication (10), geometry (5), separate data centres (5), visual/CSV/MAP presentation (5), immutable-release/CI/rollback (5). A deliberate synthetic landing page in `preview.html` demonstrates the editorial-tier presentation; it is not the live dashboard.

## CI and master distillation

1. `node --test experiments/pipeline50/matrix.test.mjs experiments/pipeline50/master-engine.test.mjs experiments/pipeline50/real-audit.test.mjs` tests 50 golden acceptances, 50 independent negative mutants, 50 compiled-master rejects and structural safeguards (159 assertions at hosted run 43618995009).
2. `node experiments/pipeline50/master.mjs pipeline50-master-report.json` measures the complete 50×50 adversarial matrix, SHA256-hashes the 50 implementations and selects the smallest subset found by a deterministic greedy set-cover (not proof of mathematical global optimum).
3. `node experiments/pipeline50/bundle-master.mjs pipeline50-distilled-master.mjs pipeline50-bundle-receipt.json` emits a *single* source file with only selected rule code and a reproducible SHA256 manifest. `verify-bundle.mjs` independently proves this distilled code still refuses all 50 mutations. First measured result: 45 selected rules, 50/50 negative rejects, bundle SHA256 `2ecc0ab41694550377fa7f38381fd6b7b4f2ab937c8a46178a0eb031794d58fa` at run 43618908373 (run overall failed on CI artifact indentation subsequently fixed).
4. Source-checkout stages retrieve exact pinned commits of October top200 (`91727c22...`) and the actual data branch (`598e7879...`) and assert independent expected byte SHA256 in `real-audit.mjs`. The current pinned data is structurally valid (200 IDs) but **RELEASE HOLD**: 416 article records lack per-item original-source/content-SHA evidence and 15 source-ledger records lack independently verified rights fields. Reporting these blockers without changing sources is a successful *diagnostic* CI outcome, not an approval.
5. A CD/release dry-run is limited to assembling, hashing and verifying the isolated master artifact and sample presentation `preview.html`. No Pages publishing, data-branch write, homepage pointer or original Q3/V9.20 bytes are touched.
6. Agent 2/3/4 independently inspect false positives/negatives, exact publisher rights, original article URL/content-SHA fetch receipts, event/crawl time differences, 1440/390px browser, CSV/MAP, served-byte hash and rollback. Agent A integrates only after all original project release gates pass.

## Reproduction

```sh
node --test experiments/pipeline50/{matrix,master-engine,real-audit}.test.mjs
node experiments/pipeline50/master.mjs pipeline50-master-report.json
node experiments/pipeline50/bundle-master.mjs pipeline50-distilled-master.mjs pipeline50-bundle-receipt.json
node experiments/pipeline50/verify-bundle.mjs pipeline50-distilled-master.mjs
```

**Known outstanding blockers:** GlobalGrid PR #100 had 20 integrated acid failures, Agent 4 independently reproduced seven additional editorial counterexamples, and all 258 DC source rights remain unverified. Unapproved inputs stay HOLD regardless of 50/50 experiment acceptance. The separate offline public-language runner must not be called PASS while queued.
