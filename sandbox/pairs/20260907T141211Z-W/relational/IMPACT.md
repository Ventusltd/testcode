# Reverse impact and negative controls

Pair `GG2050-PAIR-20260907T141211Z-W` - runs 2 - components 102 - edges 20

Revised after an external logic review. Applicability now requires every consumed input to be present at the same content hash; the cycle test is delimited; truncation is reported; unresolved edges are never merged away; quarantine eligibility is transitive; and a run with an unimplemented case is INCOMPLETE rather than PASS.

## Q1  Which tests consume `atlas/data/interconnectors.geojson`?

Truncated at depth 12: **no**

| affected component | depth | pair | run | test | recorded outcome | evidence |
|---|---|---|---|---|---|---|
| gridatlas:atlas/data/interconnectors.geojson | 0 | GG2050-PAIR-20260907T141211Z-W | receipt-windows-rig.json | pair-arrivals | INCOMPLETE | none |
| gridatlas:atlas/data/interconnectors.geojson | 0 | GG2050-PAIR-20260907T141211Z-W | run-2026-09-07T14-21-10-632Z.json | pair-arrivals | PASS | none |
| globalgrid2050:pipeline/data/v9.8/interconnectors.json | 1 | GG2050-PAIR-20260907T141211Z-W | None | None | None | declared |
| gridatlas:atlas/cartridges/202609071232-sld-sandbox-v9-8.js | 1 | GG2050-PAIR-20260907T141211Z-W | receipt-windows-rig.json | pair-arrivals | INCOMPLETE | declared + UNRESOLVED EDGES PRESENT |
| gridatlas:atlas/cartridges/202609071232-sld-sandbox-v9-8.js | 1 | GG2050-PAIR-20260907T141211Z-W | run-2026-09-07T14-21-10-632Z.json | pair-arrivals | PASS | declared + UNRESOLVED EDGES PRESENT |
| globalgrid2050:pipeline/scripts/plugins/projects-v9-8.js | 2 | GG2050-PAIR-20260907T141211Z-W | None | None | None | runtime-observed |
| gridatlas:atlas/current.json | 2 | GG2050-PAIR-20260907T141211Z-W | receipt-windows-rig.json | pair-arrivals | INCOMPLETE | declared |
| gridatlas:atlas/current.json | 2 | GG2050-PAIR-20260907T141211Z-W | run-2026-09-07T14-21-10-632Z.json | pair-arrivals | PASS | declared |
| globalgrid2050:pipeline/scripts/core/atlas-receiver-v9-7.js | 3 | GG2050-PAIR-20260907T141211Z-W | receipt-windows-rig.json | pair-arrivals | INCOMPLETE | runtime-observed |
| globalgrid2050:pipeline/scripts/core/atlas-receiver-v9-7.js | 3 | GG2050-PAIR-20260907T141211Z-W | run-2026-09-07T14-21-10-632Z.json | pair-arrivals | PASS | runtime-observed |
| globalgrid2050:pipeline/scripts/core/atlas-interconnector-link-v9-8.js | 4 | GG2050-PAIR-20260907T141211Z-W | receipt-windows-rig.json | pair-arrivals | INCOMPLETE | static-resolved |
| globalgrid2050:pipeline/scripts/core/atlas-interconnector-link-v9-8.js | 4 | GG2050-PAIR-20260907T141211Z-W | run-2026-09-07T14-21-10-632Z.json | pair-arrivals | PASS | static-resolved |

## D1  A changed input invalidates applicability

Child pair `GG2050-PAIR-20260907T141211Z-W-child-demo` carries every parent component except the interconnector geojson, which is regenerated on the estate's earth radius and so has a new content hash.

The rule shipped first was: applicable if ANY consumed input is present in the child. The review's counterexample holds, and this graph reproduces it, because the child shares almost every component with its parent. The rule is now: stale if ANY consumed input is absent from the child at the same content hash.

- `receipt-windows-rig.json` recorded `INCOMPLETE` -> **STALE (1 of 8 consumed inputs changed or absent)**; the superseded any-match rule said APPLICABLE
- `run-2026-09-07T14-21-10-632Z.json` recorded `PASS` -> **STALE (1 of 8 consumed inputs changed or absent)**; the superseded any-match rule said APPLICABLE

One qualification the review did not make. It holds that a receipt stays applicable when components it never consumed change. That is true only while consumption is complete for the environment being claimed, and here it is not: two components are fetched by absolute URL and were aborted under the network cut, so they are pair components no run consumed. A change to either cannot mark any receipt stale under a consumption-scoped rule, yet it can change behaviour the moment the pair is served online. Applicability is therefore qualified by environment: a network-cut receipt says nothing about the online pair.

A second qualification, against this implementation rather than against the rule. `run_inputs` is written by the analyzer, not observed by the harness, so 16 rows stand for 103 pair components. Until the harness records what it actually fetched, every applicability verdict is only as good as that declared list.

## D2  A cycle terminates, and the visited test no longer confuses prefixes

A -> B -> A: 2 rows, finished, truncated: no. Rows: demo:A@0, demo:B@1

Identifier pairs in this graph where one id is a substring of another: **1**.
- `gridatlas:atlas/data/interconnectors.geojson` is contained in `gridatlas:atlas/data/interconnectors.geojson@R_ATLAS`, so an undelimited visited test would treat the second as already seen and drop its consumers

The review called the depth cap unnecessary given correct cycle detection. True for termination, false for cost: this query enumerates paths, not nodes, so a dense acyclic graph is still exponential in edges. The cap stays, and truncation is detected by re-running one level deeper and comparing row counts.

## D3  An unresolved dependency stays visible

Impact of the eight unlocated far converters:

- unresolved:far-end-converters-x8 (depth 0) run None recorded None - evidence none
- unresolved:far-end-converters-x8 (depth 0) run None recorded None - evidence none
- gridatlas:atlas/cartridges/202609071232-sld-sandbox-v9-8.js (depth 1) run receipt-windows-rig.json recorded INCOMPLETE - evidence declared + UNRESOLVED EDGES PRESENT
- gridatlas:atlas/cartridges/202609071232-sld-sandbox-v9-8.js (depth 1) run run-2026-09-07T14-21-10-632Z.json recorded PASS - evidence declared + UNRESOLVED EDGES PRESENT
- gridatlas:atlas/cartridges/202609071232-sld-sandbox-v9-8.js (depth 1) run receipt-windows-rig.json recorded INCOMPLETE - evidence declared + UNRESOLVED EDGES PRESENT
- gridatlas:atlas/cartridges/202609071232-sld-sandbox-v9-8.js (depth 1) run run-2026-09-07T14-21-10-632Z.json recorded PASS - evidence declared + UNRESOLVED EDGES PRESENT
- gridatlas:atlas/current.json (depth 2) run receipt-windows-rig.json recorded INCOMPLETE - evidence declared
- gridatlas:atlas/current.json (depth 2) run run-2026-09-07T14-21-10-632Z.json recorded PASS - evidence declared
- gridatlas:atlas/current.json (depth 2) run receipt-windows-rig.json recorded INCOMPLETE - evidence declared
- gridatlas:atlas/current.json (depth 2) run run-2026-09-07T14-21-10-632Z.json recorded PASS - evidence declared
- globalgrid2050:pipeline/scripts/core/atlas-receiver-v9-7.js (depth 3) run receipt-windows-rig.json recorded INCOMPLETE - evidence runtime-observed
- globalgrid2050:pipeline/scripts/core/atlas-receiver-v9-7.js (depth 3) run run-2026-09-07T14-21-10-632Z.json recorded PASS - evidence runtime-observed
- globalgrid2050:pipeline/scripts/core/atlas-receiver-v9-7.js (depth 3) run receipt-windows-rig.json recorded INCOMPLETE - evidence runtime-observed
- globalgrid2050:pipeline/scripts/core/atlas-receiver-v9-7.js (depth 3) run run-2026-09-07T14-21-10-632Z.json recorded PASS - evidence runtime-observed
- globalgrid2050:pipeline/scripts/core/atlas-interconnector-link-v9-8.js (depth 4) run receipt-windows-rig.json recorded INCOMPLETE - evidence static-resolved
- globalgrid2050:pipeline/scripts/core/atlas-interconnector-link-v9-8.js (depth 4) run run-2026-09-07T14-21-10-632Z.json recorded PASS - evidence static-resolved
- globalgrid2050:pipeline/scripts/core/atlas-interconnector-link-v9-8.js (depth 4) run receipt-windows-rig.json recorded INCOMPLETE - evidence static-resolved
- globalgrid2050:pipeline/scripts/core/atlas-interconnector-link-v9-8.js (depth 4) run run-2026-09-07T14-21-10-632Z.json recorded PASS - evidence static-resolved

The review proposed merging parallel evidence with MAX and answered that where a runtime-observed edge and an unresolved edge reach the same component the result is definitively runtime-observed. That is rejected, and this graph is the reason: the sld-sandbox cartridge carries both, and they are not two routes to one fact. One says a named dependency was observed; the other says a dependency exists whose target cannot be named. MAX over them deletes the second. Unresolved is kept outside the order and annotated onto the answer, so a reader can see the impact set is a lower bound.

## D4  An unchanged semantic failure stays quarantined, under a transitive predicate

`gridatlas-cartridge-proof:substation-intelligence:451935>368640` first seen 2026-09-06T23:58:53Z, outcome FAIL; runs of that test queued by this pair: 0.

The shipped rule re-opened a quarantine when the subject's bytes, the boundary or the proof changed. The review's counterexample holds: a fix landing in a dependency of the subject leaves all three unchanged, and the failure stays quarantined for ever. The predicate is now:

```
eligible = subject_bytes_changed
        OR boundary_changed
        OR proof_changed
        OR any(component in the failing run's inputs has new bytes)
        OR harness_sha256_changed
        OR environment_fingerprint_changed
        OR manually_revoked(reason, utc)
```

The last clause exists because no state-driven predicate can detect a quarantine that was mistaken when it was written. It needs a person, and it is recorded with a reason and a timestamp rather than by deleting the row.
