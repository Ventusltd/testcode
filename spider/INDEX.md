# Spider dashboard: five timestamped test versions

Published by the MSI lab, 2026-09-14 14:32:03 UTC. Each folder is a self-contained build of the Spider dashboard that reads the live
GlobalGrid2050 data over https. Open `<version>/index.html`. They add up in order: each version is the one before it
plus one change, all below the receiver comment, with the brand eyebrow and title kept byte-faithful to Vikram's design.

| # | Version | What it adds | Verified |
|---|---|---|---|
| 1 | `20260914T143044Z-v1-click-fix` | A mouse click on a card in the spider view re-centres (pointer capture only after 6 px); a stale ?graph=/?focus= link says so in the hint. | live, both engines (Alienware CI) |
| 2 | `20260914T143045Z-v2-badges-labels-alsoin` | Real type badges (CANONICAL, BLOCK, DECISION…) not REPO; the relationship name on each wire; an "Also in" row hopping to the same card in other graphs. | hand-verified in Chrome |
| 3 | `20260914T143046Z-v3-bundles-derived-links` | Above 40 wires the fan becomes one bundle card per type; the stale-link note survives redraws; links derived from a card's label so nothing is dead. | hand-verified |
| 4 | `20260914T143048Z-v4-three-roads` | Every centre card shows three roads (Our page, GitHub, External); a missing road says so; graph-aware derived links. | hand-verified |
| 5 | `20260914T143049Z-v5-linkify-frontdoor-brandfaithful` | Raw URLs in card text become links; the front door (overview graph, map of maps) registered as data; brand header restored byte-faithful. | hand-verified; front door renders 15 graphs |

Open version 5 on `?graph=overview&focus=GLOBALGRID2050%20architecture` to see the front door: one card whose fifteen
wires are the fifteen graphs of the estate.

The reverted experiment (a wide fan seating its cards on screen) is not in these versions; it is an open problem for a
later v3-lab page prototype. Reports and evidence are in `../spider-lab/`.
