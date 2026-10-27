# Independent Build G integrity challenge — 27 October 2026

This branch is **ChatGPT-owned reviewer evidence only**. It inherits the exact synthetic integrity tests from draft Testcode PR #2, which failed against Claude's Build F as intended. No edits are made to Claude's GridAtlas branch, any published preview, the archive, or production.

**Immutable candidate:** GridAtlas commit `31e009d1acbe2d00e82fc6c5e0fdbadb7c6c1b3c`, generation `202610270113` (G), on Claude's review branch; not yet published.

**Independent regression:** `drivers/gridatlas-lightning-integrity.test.mjs` runs I01–I04 against the candidate, with deliberately synthetic day files and an instrumented Node VM. I01 checks missing WebCrypto fails closed; I02 rejects a false SHA with WebCrypto; I03 requires a named index mismatch after the final retry; I04 checks recovery when the second shard is correct. These are not tests of real EUMETSAT archive data or browser UI.

**Additional unchanged gates:** nine immutable-composition checks, eight independent ChatGPT runtime checks, and an original known-bad candidate negative control. The old candidate is supposed to remain RED. Any failed new integrity test keeps the PR RED.

**Source and evidence:** `https://github.com/Ventusltd/testcode/actions/workflows/gridatlas-lightning-independent.yml` (select this branch and inspect exact run SHA). Capture final GitHub Actions job logs and count before reporting PASS. `atlas/current.json` must remain generation `202609241334`.

**Not proven:** owner iPhone V1–V15, actual EUMETSAT archive integrity, a year of history, measured electrical effects, live map release. Do not merge or deploy G as a consequence of this reviewer PR.
