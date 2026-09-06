# Measurements visible after drawing

Baseline generation0528 at24d1d4cda2cb867dd802e02075db8b7a2d5c78d6
placed the measurements after the entire editing-control column. Actual fresh
canvas clicks/taps found square metres and hectares outside the320px phone
viewport, and hectares outside the1440x900 desktop viewport. The393px two-column
phone layout already showed both readings. Three visibility assertions failed;
the geometry and controls remained functional.

Owner b608de2665f6b568f13b06a0ade9707da0014e7d supplies a CSS-only measurement
module successor. The desktop column and narrow single-column phone now place
readings first. Explicit grid positions retain the existing two-column layout
on other phones. Original controls, handlers, coordinates and calculations are
unchanged. This changes neither the active map area nor the shared registry.

Candidate202609060537 passes24 actual drawing/readout/control checks across
320x568,393x852 and1440x900, plus64 existing clearance checks across four sizes.
Reset and Layers remain reachable, Undo after Reset restores every coordinate,
and the values stay outside the map canvas. The320px and desktop fresh-draw
screenshots were visually inspected and show both polygon and metric readings.
Raw baseline/corrected evidence:poly0528-readouts-negative, poly0537-readouts,
poly0537-clearance under offline-screenshots/recovery-20260906.

The carried parent includes the numeric distance correction, composition guard,
vertex limit, persistent draft and explicit Reset. CI and exact served-byte/live
acceptance remain separate from these local observations.
