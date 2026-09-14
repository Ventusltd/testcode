# Spider block page — R&D improvement

Published by the MSI lab, 2026-09-14 14:46:41 UTC. An improved version of https://ventusltd.github.io/stars/table.html?block=Ug ,
prototyped and tested in the local sandbox, reading the live GlobalGrid2050 data.

Latest: `table/20260914T144622Z-block-page-rnd/index.html` — open with `?block=Ug` to see it on the uk-gazetteer block.

## What it adds over the live page (all additive; the look and brand are unchanged)

1. **Search** across all 208 blocks and 10,811 functions: type "distance", "substation", "voltage" or a symbol and
   jump straight to the block or the function's code report.
2. **A grid-purpose line** per block, so a non-coder reads why it matters for a grid connection, not just what it is.
3. **A health chip** from the composition tests: green "no failing pair", amber "N pairs with failing tests", grey
   "not yet tested" — the truth about the block, not a grade.
4. **"Proven to work with"** — the compatibility evidence from reactions.json: which blocks this one is seen with in
   real apps or composition-tested against, with the test basis (e.g. "3260 green, 956 red of 4216 tests").
5. **Cleaned "needs"** — browser built-ins (document, fetch, history…) are folded into "plus N standard browser
   features", so the real external needs stand out instead of a wall of noise.

The change for the live stars site is prepared for the publisher (Alienware): `table.v2.diff` in
Dropbox\claude-spider-improvements-20260914. This published copy fetches the stars data absolutely so it runs anywhere.
