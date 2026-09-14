# MSI lab: five minutes playing the Spider v2 lab build

Written 2026-09-14 13:52:00 UTC by MSI Claude (the lab). Build: claude-spider-improvements-20260914/index.v2-lab.html (cumulative diff 0004),
served on the MSI at 127.0.0.1:8791 with the live manifest and graphs proxied. Played by hand in Chrome through the Claude
extension at 1568 px, 13:50 to 13:56 UTC, as a first-time reader would. Recording: spider-v2-lab-play-20260914.gif (31 frames,
sent to the owner). Measurements first; proposals are marked.

## What I did and what happened

| Step | Result |
|---|---|
| Open the root | Lands on the first Federation card, "data-federation-map-for-globalgrid2050-all-repos", with three roads, "Also in: Inventory · Structure" and "⊕ Contents (24)". |
| Tap Contents | Drilled into "data-federation contents": 4 children (live dashboard page, reports folder, every-drop-in-the-ocean, GitHub Actions); breadcrumb "Federation › data-federation contents". |
| Tap the breadcrumb | Back to Federation, same focus. |
| Open FOCUS | A native list of 30 options: Federation's own cards and the 15 graphs mixed together. |
| Structure, focus the estate, Spider view | 27 CONTAINS wires fan right; every neighbour card sits beyond the right edge of a 1568 px window. |
| Drag-pan 900 px left | Pans, does not re-centre; repository cards come into view. |
| Mouse click "grid-distance-maths" | Re-centres; card shows a reason with a raw URL, roads "Our page, GitHub, no external link", "Also in: Reuse · Inventory", 2 wires (Ss sld-sandbox, Pr Proofs and checks). |
| Decisions, focus d014 | The question reads well; evidence is three raw URLs in small text; roads "Our page, GitHub"; wired to Ek and Gc and to Decisions. |
| Applications, Spider view | "Geodesy helpers" MADE_OF #511 distanceKm and #8770 initialBearingDeg, each with roads. |
| ?graph=nonsense | Falls back to Federation with the sentence "The link asked for a graph named "nonsense", which this page does not list; showing Federation." still shown 6 s after load. |

## Findings, in the order they matter for a non-coder

1. **There is no front door.** The root opens on one repository card. The fifteen graphs exist only as entries in a
   30-option dropdown. A reader who does not open that list never learns the dashboard has a Reuse, an Inventory, a
   Decisions or an Applications map. Proposal: a root focus card "GLOBALGRID2050 architecture" whose wires are the 15
   graphs, each a card with its one-word name and node count, so the first spider view is the map of maps. Data change
   only (a root node plus 15 CONTAINS wires); no page change needed beyond what v2 lab has.
2. **A wide fan hides its cards.** With 27 outgoing wires the layout pushes every neighbour card off-screen even at
   desktop width (the horizontal gap grows with the count: 260 + 38 per wire). The reader sees wires leaving the frame and
   may think the graph is empty. Proposal: cap the gap at the viewport width minus the card width, and scroll so the
   centre card sits at the left third when all wires go one way.
3. **Raw URLs in card text are not links.** Decision cards carry their evidence as bare URLs in small text; repository
   cards carry a raw site URL in their reason. Proposal: linkify http(s) URLs in the reason text (page change, additive).
4. **Everything else in the v2 build behaved.** Click re-centres; pan never re-centres; roads always visible and honest;
   Also-in hops land focused; drill-in and breadcrumb work; the stale-link sentence survives redraws; badges name the type.

## Automated check of the same build (Walker 2's v2test.mjs, run as a script at 13:44 UTC, 430 px and 1280 px)

97 checks: 68 PASS, 25 FAIL. Of the 25: 17 are the test script's own defect ("Cannot read properties of undefined
(reading 'evaluate')"), 3 are the known genome-spider data 404 in the console, 2 are the test misreading the hint (verified
by hand above: the sentence is present), 2 are the genome-spider placeholder having no link (expected), 1 is a node with
no wires. Page faults found by the script: none new. First card at 143 ms against 1,494 ms on the live site earlier today.

## Dead links, measured (Reuse graph, 13:42 UTC)

587 distinct URLs: 586 return 200, 1 returns 404 (https://ventusltd.github.io/pipelinenews/, no Pages site). All 249
code.html?family links resolve in their code buckets. Two 404s in graph data found by Walker 1: reports/VEDIC.md (renamed
CLASSIFICATION.md; repaired client-side in v2 lab, builder fix pending with the Alienware) and wider-fleet.mjs atlasLink().

## Handover

The build, the diffs and the README are in Dropbox\claude-spider-improvements-20260914. The Alienware reviews in its
Chromium and WebKit CI and publishes. Proposals 1 to 3 above are the next lab round unless the Alienware directs otherwise.
