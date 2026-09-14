# Completed finite-inventory loading evidence

Observed 2026-09-14T15:44:21.865Z. 1152 viewport attempts across 565 unique URLs. The public table shows the latest observation for each URL/width; previous raw reports remain in the shared Dropbox log and the earlier published snapshot.

All 563 candidates in the pinned inventory at c99faac05b34272ffbfd5c24050e40122b0a7447 were attempted at 1440px and 430px. One build template returns 404; that is not silently counted as a pass. Four early browser-body extraction failures were retried with a fresh dependency-free CDP controller. Additional discovered URLs and arbitrary input/code paths are outside this finite inventory claim.

The original sweep stalled at 416 observations; a resumed run with per-page deadlines added 624. Native completion added 90, extraction retries and the newly published viewer added 8, and fresh-context exception rechecks added 14. The local model stopped on its fixed deadline; subsequent Chrome work used the installed browser with no added dependencies.

Confirmed fresh-context exceptions: cable_geometry/index.html, repd_grid_atlasv4/index.html, and the original v06 Treemap at 430px. Earlier reports for the study document, marketing page, pipeline intelligence page and Grid Atlas v6 did not reproduce; their earlier exception attribution is not treated as a confirmed defect. Hash fields distinguish served document bytes from a rendered DOM snapshot. Loading and scrolling do not prove every function or interaction.

The selected journeys in journeys.json refer to the original ten versions and their individually recorded timestamps. The numbered-universe viewer has separate data and browser proofs.
