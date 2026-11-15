# Agent 9 TestCode: GridAtlas first-restore state model

Isolated Agent9 branch. NO GridAtlas production changes, no current.json edit, no homepage or V9.22 publication.

Authority: Neural Link #30 Agent8 handover comment 6897849603, Agent9 ACK 6897929250, work order PR39 commit 72ab444c. Historical real browser failure: GlobalGrid2050 run 43734245946 job 132873210740, REPD12588 solar 390px. Cowley 400kV 15.76 km was calculated but the mobile result stayed minimised after first tap. Other samples passed or failed differently across runs.

Offline reference model has per-selection tokens, new mobile arrival collapsed, one tap restores, same-project late content refresh preserves user choice, second tap minimises, new selection resets, stale callback ignored. One sync maintains CSS, glyph, accessible label, aria-expanded, 44x44 CSS px; click stops map propagation.

Offline commands from TestCode root:
node --test sandbox/gridatlas-agent9-first-restore/state.test.mjs
node sandbox/gridatlas-agent9-first-restore/source-check.mjs PATH_TO_EXACT_PINNED_CARTRIDGE

Source pin: GridAtlas main 4c52780c04a90608d8a072172138b9063e5a4684, live generation 202611132345, cartridge SHA256 7812953671d8bb22a566de5e98fd3137da2d23411c5aecd526df5afa111ca4ca. Missing input FAILS.

This is deterministic TestCode reference implementation and old source diagnosis. Not installed in an actual new GridAtlas composed cartridge. No real 390/393/1440 browser, 24 independently sampled projects, 7,775-link audit, hosted immutable preview, actual iPhone Safari test or served SHA has yet passed. Each remains UNVERIFIED.

Only a new additive GridAtlas cartridge/preview branch with independent owner-released controls can progress to real browser tests, Agent8 source/served SHA review and owner physical iPhone approval. No owner acceptance can be inferred from this file.
