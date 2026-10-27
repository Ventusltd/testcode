# GridAtlas Lightning candidate — independent Testcode lane (26 October 2026)

This is a **separate verification lane**, not another GridAtlas product fork, interface design or public app preview. Claude owns implementation in `Ventusltd/gridatlas` and ChatGPT reviews test results independently. No product overlays, Atlas releases, production pointers, archive data or GitHub Pages configurations are edited by this change.

## Pinned inputs
- Original production composition: `atlas/current.json` = generation `202609241334`.
- Claude first hardened candidate (snapshot for this run): `0424d45953579a7905c039511a6219e39ab0ee18`, generation `202610270024`.
- Original failing candidate (negative control): `fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d`, generation `202610261949`.
- Independent ChatGPT test suite: `7e7c3d83d587595ceebf5c7ab33f7bfa84d95099`.
- Tests run in **`testcode`**; product source and any fixes stay in separate clones. Every resulting PASS or FAIL names the SHA.

## Why this is better than another preview
The released original GridAtlas remains unaffected. The prior public preview at `/atlas/v/202610261949/` is knowingly defective (long periods disabled, inaccurate coverage, clipped label); duplicating that UI in Testcode would produce yet another version for the owner to debug. Instead the workflow challenges Claude's exact candidate **without publishing it**.

## Static gates
The nine offline tests in `drivers/gridatlas-lightning-immutable.test.mjs` assert that:
- the live pointer still selects the accepted generation;
- the original sld cartridge is unchanged and verifiably hashed;
- the versioned candidate uses an identical immutable composer;
- the original four slots, release shell and other three cartridge hashes remain intact;
- the new cartridge equals the **exact original bytes, newline, then one additive Lightning module**;
- candidate manifest SHA-256/bytes agree with served candidate files;
- the 24,781-byte original-derived overlay allowance and 460,000-byte cartridge bound hold;
- module parses; optical flash wording does not claim confirmed ground strikes;
- generated filenames and version metadata identify the intended immutable generation.

The workflow also runs ChatGPT's independent Node VM regression suite against the hardened candidate and, separately, proves the original candidate remains **RED** on that same suite. A negative control unexpectedly turning green is itself a failure.

## Run
From a parent directory with `testcode/` and a pinned `gridatlas/` clone as siblings:

```bash
cd testcode
LIGHTNING_GEN=202610270024 GRIDATLAS_ROOT=../gridatlas node --test drivers/gridatlas-lightning-immutable.test.mjs
```

For GitHub, run `Independent Lightning candidate challenge` on this branch or create a draft PR; `workflow_dispatch` accepts an exact candidate SHA and generation to recheck later. It downloads only pinned public repositories and uploads raw output even on RED.

**Important limits:** these are static/VM tests, not owner iPhone Safari, real basemap, image geometry, native hit-testing, EUMETSAT collector verification or 12-month backfill. A green CI run is **not a release veto pass**, and published preview approval remains a separate user action. The archive is not published, so selecting 12M can only show available recent observations and explicit UNKNOWN history.

Source issue: https://github.com/Ventusltd/gridatlas/issues/32

Updated after Claude PR #34 advanced beyond generation 202610262318: immutable candidate ref `0424d45953579a7905c039511a6219e39ab0ee18` and generation `202610270024` selected for the independent gate. No original GridAtlas artefacts, live routing, app code or historical data were modified by this Testcode update.

**Build E note:** published as a standalone preview on 2026-10-27 via GridAtlas PR #37 / commit `1c19b76838758ef08ed9c8c4902a798a8762ece6`. GitHub Pages run `40426931408` succeeded. This CI deliberately pins the development source commit `0424d459...` with identical seven candidate blobs, not a mutable main branch. Live generation remains `202609241334`; visual/owner V1–V15 acceptance and archive integrity stay separately gated.
