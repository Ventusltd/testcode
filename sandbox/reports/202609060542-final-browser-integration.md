# Final candidate browser integration

Application source d66ac93905c4cbeb5526ac840d650e7dd876e25f,
generation202609060537, owner b608de2665f6b568f13b06a0ade9707da0014e7d.
This checkpoint records additional local evidence, not publication acceptance.

The fresh-draw/readout/Reset/Undo/Layer suite passes24 checks in each of Chromium,
Firefox and WebKit across320x568,393x852 and1440x900. The driver now accepts and
records BROWSER_ENGINE, preserving Chromium as default. These are actual pointer
and touch interactions. The WebKit page-screenshot limitation documented in
202609060535-source-and-webkit-review.md still applies; do not count its blank
map screenshots as successful page-render evidence.

The native Save PDF control passes48 download/format/size/reference checks across
three engines and two viewports. PyMuPDF independently parsed and rendered all6
downloads: exact generation/credits, nonoverlapping text, native-size map raster
and more than32 sampled image colours. Raw files and render-check.json are in
poly0537-pdf-native under offline-screenshots/recovery-20260906.

The separate actual File Print action passes10 checks in WebKit at DPR3 over
phone and desktop. This invokes the app's own renderer without screen sharing,
retains exact polygon coordinates and produces actual downloaded PDFs. Independent
rendering and visual inspection of the desktop PDF show the map, polygon, handles
and metric readings. The output is not a substituted browser screenshot. Raw PDFs,
rendered PNGs and method/viewport/state receipts:poly0537-app-print-webkit.

This evidence distinguishes three different paths: page screenshot, native map
PDF, and app-render Print. A limitation in the first did not imply failure in the
other two. No production WebGL or antivirus settings were changed for these tests.

A read-only13-worktree inventory is retained as worktrees-0542.json in the same
offline root (actual capture05:41:46UTC). It includes adjacent dirty/untracked work
and the old quarantined Atlas deletion. None of those files was deleted, restored
over another session, or staged as part of this verification.
