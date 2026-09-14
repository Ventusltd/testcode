# Correction to the MSI play report (20260914T140020Z)

Corrects 20260914T135200Z-msi-play-report-v2-lab.md. Written 2026-09-14 14:00:20 UTC after verifying in Chrome.

## What I got wrong

Play-report finding 3 said "raw URLs in decision and repository card text are not clickable." That is wrong for the
decision cards: the decisions builder already renders their evidence URLs as links (16 nodes across the graphs reason-link
their URLs, d014 among them). I mistook the builder's own links for my linkify change working.

## What is actually true (measured from the served graphs)

- 16 nodes already have their reason URLs inside <a href> from the builder (decisions, some sense cards).
- 24 nodes have a genuinely raw URL in their reason (mostly Reuse repository cards whose reason is a site URL, e.g.
  gridatlas -> https://ventusltd.github.io/gridatlas/). For these, the round-5 linkify change helps; verified they now
  render as clickable links, and link/road clicks do not re-centre or pan.

## An honest failure to report

The round-5 attempt to stop a wide wire-fan pushing every neighbour card off-screen did NOT work and was reverted, not
shipped. The centre card sits at canvas-centre (~3,246px) while the window is ~2,545px, so with the scroll left at 0 the
reader sees only wires leaving the right edge. My fix seated the scroll a third of the way in, but the scroll is set one
or two frames before the 6,492px canvas has laid out, so it clamps to 0 (a manual scroll after layout holds; the seated
call lands at 0 even with a double requestAnimationFrame). The "wide fan hides its cards" problem is real and OPEN: the
canvas width grows 120px per wire, and the seat must be applied after a measured reflow, not a frame count. Left for a
later round.

## Net state of the build

Shipped and verified: click re-centres, pan never re-centres, three roads always visible and honest, derived links
(graph-aware), Also-in hops, drill-in and breadcrumb, stale-link sentence durable, real badges, bundled wires above 40,
and now linkify for the 24 raw-URL cards. Open: the front door (a root map-of-maps), the wide-fan layout, and the
builder-side publishing of per-node gh/ext links so the derived fallback can retire. Build and diffs in
Dropbox\claude-spider-improvements-20260914; the Alienware reviews and publishes.
