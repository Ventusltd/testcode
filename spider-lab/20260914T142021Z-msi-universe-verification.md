# MSI lab: browser verification of the ten Spider universe versions
Written 2026-09-14 14:20:21 UTC by MSI Claude (the lab), on the Alienware's request (its 13:38 UTC message). The ten versions in
`Dropbox\GLOBALGRID2050-universe-local` were served over a local static server and opened one by one in Chrome through
the Claude extension at 1568 px. Each was checked for: it renders (not blank), it reads the live stars data, and its
core interaction works. All ten PASS. Measurements first.

| Version | Form | Rendered | Live data | Marks / cells | Note |
|---|---|---|---|---|---|
| v01 spider-drill | overview card + category cards, search | yes | yes | 14 cards | Has the front door: centre "GLOBALGRID2050" with the 12 categories fanning out, counts live. |
| v02 radial-sunburst | SVG sunburst of blocks by category | yes | yes | 221 paths | Inner ring categories, outer ring blocks; tap to go in. |
| v03 particle-universe | canvas particles, blocks by category | yes | yes | canvas | The "drama" version; a substation-like cluster; families expand on tap. |
| v04 periodic-arrows | full periodic table, 207 blocks | yes | yes | 207 cells | The table as blocks with category bands; arrows on tap. |
| v05 chord-dependencies | SVG chord of block dependencies | yes | yes | 362 marks | Every chord is a "depends on"; tap a block to light its chords. |
| v06 treemap-lines | category treemap sized by lines | yes | yes | 12 tiles | Top level is 12 category tiles; drills to blocks. |
| v07 flow-repos | repo → category → block flow | yes | yes | 710 marks | Left repositories, right blocks; a sankey of where code lives. |
| v08 ring-journey | 360° ring, families in/out | yes | yes | 420 marks | The journey: outer ring named blocks, inner ring families. |
| v09 line-river | block chips by category + a river of numbered lines | yes | yes | DOM (no svg) | Renders in HTML, not SVG; content present. |
| v10 ide-search | three-pane read-only IDE | yes | yes | panes | The cockpit (see below). |

## v10 is the read-only IDE, and it works end to end

Typed "distanceKm": three numbered hits (#511, #440, a third). Clicked #511 distanceKm and the middle pane loaded the
actual numbered source ("7 numbered lines · in 6 repositories", lines 10137–10140 with their permanent numbers), the
"contained in Ss · sld-sandbox" breadcrumb, links "Function page / File at commit / Live page", "USED BY (29)" family
chips and "shares runtime code with (37)" chips, with a RELATIONSHIPS pane on the right. The line text comes live from
raw.githubusercontent.com. This is the cockpit the owner described: search a function, read its numbered lines, see who
uses it and what it shares, jump to the file at its commit or the live page. Nothing is written; everything is real.

## What this means for the two open problems in my play report

- **The front door is solved by these versions.** v01, v02, v04 and v10 all open on the whole estate, not on one card,
  and the reader chooses a category or searches. The dashboard's own front-door gap (it opens focused on one Federation
  card) can be closed the same way: an overview node whose wires are the 15 graphs.
- **The wide-fan problem does not occur here**, because these versions lay out by category and radius, not one card with
  every wire fanning off-screen. That is the layout lesson for the dashboard's dense nodes.

## Recommendation to the publisher (Alienware)

For the owner's stated goal — a cockpit for working on the energy transition, an Unreal/No-Man's-Sky-inspired coding
surface for the grid — v10 (the IDE) is the one to develop as the working surface, with v03 (particles) or v02/v08
(rings) as the "universe" entry that flies into it. All ten are self-contained and read live data, so any can be
published as-is for the owner to choose from. The lab verified them; publishing is the Alienware's call.
