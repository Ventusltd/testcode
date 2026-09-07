# Reverse impact and negative controls

Pair `GG2050-PAIR-20260907T141211Z-W` · runs 1 · components 99 · edges 18

## Q1  Which tests consume `atlas/data/interconnectors.geojson`?

| affected component | depth | pair | run | recorded outcome | edge evidence |
|---|---|---|---|---|---|
| gridatlas:atlas/data/interconnectors.geojson | 0 | GG2050-PAIR-20260907T141211Z-W | run-2026-09-07T14-21-10-632Z.json | pair-arrivals | PASS | None |
| globalgrid2050:pipeline/data/v9.8/interconnectors.json | 1 | GG2050-PAIR-20260907T141211Z-W | None | None | None | declared,declared |
| gridatlas:atlas/cartridges/202609071232-sld-sandbox-v9-8.js | 1 | GG2050-PAIR-20260907T141211Z-W | run-2026-09-07T14-21-10-632Z.json | pair-arrivals | PASS | runtime-observed,static-resolved,declared,unresolved |
| globalgrid2050:pipeline/scripts/plugins/projects-v9-8.js | 2 | GG2050-PAIR-20260907T141211Z-W | None | None | None | runtime-observed |
| gridatlas:atlas/current.json | 2 | GG2050-PAIR-20260907T141211Z-W | run-2026-09-07T14-21-10-632Z.json | pair-arrivals | PASS | declared,declared,declared,declared,declared,declared |
| globalgrid2050:pipeline/scripts/core/atlas-receiver-v9-7.js | 3 | GG2050-PAIR-20260907T141211Z-W | run-2026-09-07T14-21-10-632Z.json | pair-arrivals | PASS | runtime-observed,runtime-observed |
| globalgrid2050:pipeline/scripts/core/atlas-interconnector-link-v9-8.js | 4 | GG2050-PAIR-20260907T141211Z-W | run-2026-09-07T14-21-10-632Z.json | pair-arrivals | PASS | static-resolved |

## D1  A changed input invalidates applicability

Child pair `GG2050-PAIR-20260907T141211Z-W-child-demo` carries a regenerated geojson (new hash). Parent receipts against it:

- `run-2026-09-07T14-21-10-632Z.json` recorded `PASS` → **STALE for child (input hash changed)** — the historical PASS stays attached to its original bytes

## D2  A dependency cycle terminates

A→B→A: query returned 2 rows and finished (path-based visited set, depth cap 12). Rows: demo:A@0, demo:B@1

## D3  An unresolved dependency stays visible

Impact of the eight unlocated far converters:

- unresolved:far-end-converters-x8 (depth 0) run None recorded None — edge evidence: None
- gridatlas:atlas/cartridges/202609071232-sld-sandbox-v9-8.js (depth 1) run run-2026-09-07T14-21-10-632Z.json recorded PASS — edge evidence: runtime-observed,static-resolved,declared,unresolved
- gridatlas:atlas/current.json (depth 2) run run-2026-09-07T14-21-10-632Z.json recorded PASS — edge evidence: declared,declared,declared,declared,declared,declared
- globalgrid2050:pipeline/scripts/core/atlas-receiver-v9-7.js (depth 3) run run-2026-09-07T14-21-10-632Z.json recorded PASS — edge evidence: runtime-observed,runtime-observed
- globalgrid2050:pipeline/scripts/core/atlas-interconnector-link-v9-8.js (depth 4) run run-2026-09-07T14-21-10-632Z.json recorded PASS — edge evidence: static-resolved
- The `unresolved` status is carried into the answer; the query does not drop the edge.

## D4  An unchanged semantic failure stays quarantined

`gridatlas-cartridge-proof:substation-intelligence:451935>368640` first seen 2026-09-06T23:58:53Z, outcome FAIL; runs of that test queued by this pair: 0. Eligibility returns only when the cartridge bytes, the boundary or the proof change.
