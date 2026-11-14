# Pipeline50 — 50 numbered TestCode experiment implementations

Owner authorisation 14 November 2026. Dedicated isolated Agent 1 experiment branch. Agent 3 owns separate TestCode #10; Agent 4 owns separate globalgrid2050 #104; Agent A controls integration; Agent 2 reviews independently.

Each file `versions/v001.mjs` through `v050.mjs` is a distinct testcode *gate implementation* with one named quality policy, a golden synthetic acceptance fixture, and an adversarial mutation expected to be rejected. These are **50 QA versions, not 50 production Pipeline News releases**. Golden-only suites can be trivially green, so the runner demands both positive and negative evidence. The master only selects version gates that pass both, SHA256-hashes each gate's source, and emits an auditable master-candidate report.

Areas covered: official source identity (5), REPD identity (5), timestamps/replay (5), publisher evidence (5), editorial relevance/duplication (10), geometry (5), separate data centres (5), visual/CSV/MAP presentation (5), immutable-release/CI/rollback (5). A deliberate synthetic landing page in `preview.html` demonstrates the editorial-tier presentation; it is not the live dashboard.

## CI and master distillation

1. `node --test experiments/pipeline50/matrix.test.mjs` runs 100 golden/mutant cases plus aggregate assertions, offline with zero external data dependencies.
2. `node experiments/pipeline50/master.mjs pipeline50-master-report.json` hashes the 50 version sources, scores each pair, and emits a *master QA candidate* manifest. If one version fails it cannot enter the master and the workflow fails.
3. CI stores both test and master JSON as artifacts. Source input commits are pinned in the workflow; the real-data smoke audit is separate from the synthetic acceptance, so the 50 synthetic PASS cases cannot authorise release.
4. Agent 2/3/4 independently inspect blind false positives and negatives, exact public source licences, per-article original URL/content SHA fetch receipts, separate event/crawl dates, authentic MAP/CSV/browser rendering and rollback.
5. Only Agent A may coordinate a separately versioned successor and require real served-byte acceptance. No direct production pointer update from this branch.

**Known outstanding blockers:** GlobalGrid PR #100 had 20 integrated acid failures, Agent 4 independently reproduced seven additional editorial counterexamples, and all 258 DC source rights remain unverified. Unapproved inputs stay HOLD regardless of 50/50 experiment acceptance. The separate offline public-language runner must not be called PASS while queued.
