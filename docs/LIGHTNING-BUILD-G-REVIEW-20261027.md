# Independent Build G integrity challenge — 27 October 2026

This branch is **ChatGPT-owned reviewer evidence only**. It inherits the exact synthetic integrity tests from draft Testcode PR #2, which failed against Claude's Build F as intended. No edits are made to Claude's GridAtlas branch, any published preview, the archive, or production.

**Immutable candidate:** GridAtlas commit `31e009d1acbe2d00e82fc6c5e0fdbadb7c6c1b3c`, generation `202610270113` (G), on Claude's review branch; not yet published.

**Independent regression:** `drivers/gridatlas-lightning-integrity.test.mjs` runs I01–I04 against the candidate, with deliberately synthetic day files and an instrumented Node VM. I01 checks missing WebCrypto fails closed; I02 rejects a false SHA with WebCrypto; I03 requires a named index mismatch after the final retry; I04 checks recovery when the second shard is correct. These are not tests of real EUMETSAT archive data or browser UI.

**Additional unchanged gates:** nine immutable-composition checks, eight independent ChatGPT runtime checks, and an original known-bad candidate negative control. The old candidate is supposed to remain RED. Any failed new integrity test keeps the PR RED.

**Source and evidence:** `https://github.com/Ventusltd/testcode/actions/workflows/gridatlas-lightning-independent.yml` (select this branch and inspect exact run SHA). Capture final GitHub Actions job logs and count before reporting PASS. `atlas/current.json` must remain generation `202609241334`.

**Not proven:** owner iPhone V1–V15, actual EUMETSAT archive integrity, a year of history, measured electrical effects, live map release. Do not merge or deploy G as a consequence of this reviewer PR.

## Executed independent GitHub Actions result (01:32–01:33 UTC)

**PASS, run [40433190233](https://github.com/Ventusltd/testcode/actions/runs/40433190233)** on reviewer head `c1e2d26327dc66ac99fb6ab877274cea60b3c9c6` and **pinned G source `31e009d1acbe2d00e82fc6c5e0fdbadb7c6c1b3c`**:

- Immutable original and candidate: **9/9 PASS**.
- Independent ChatGPT Node VM H01–H08: **8/8 PASS**.
- Independent synthetic archive integrity I01–I04: **4/4 PASS**. Missing WebCrypto fails closed; false SHA rejects; persistent mismatch reason retained; retry can recover.
- Original old candidate negative control `fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d`: **7/8 FAIL as expected** (one sanity PASS); the control job PASS confirms the suite still detects regressions.

**Limits remain:** synthetic VM tests, not WebKit/iPhone or actual EUMETSAT day-shard downloads; no V1–V15 sign-off, no 12-month history or release authorisation. Claude G browser T8 strict DOM hit-testing reports FAIL due to canvas-under-panel target semantics; its separate T8b measured-line reachability is PASS. Treat as a test-method disagreement requiring an independent browser receipt, not as a certified V-gate.
