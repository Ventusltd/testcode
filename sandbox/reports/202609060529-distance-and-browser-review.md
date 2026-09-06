# Polygon boundary and browser review

Source baseline: TestCode c7c18e984a394acdc3e16abca77886edd790989e,
generation202609060521. Owner correction:
a7c176851eff0a684421ec7420d893e6aa04635d. Candidate202609060528
retains all parent cartridges and router/layout initializers; only the owner
engine's haversine intermediate is clamped to its mathematical range0..1.

Actual GeoJSON and CSV downloads at baseline exposed missing perimeter and
NaN chainage for an edge from[0,-84.99] to[180,84.99], including when that edge
closes the polygon. Floating-point evaluation produces1.0000000000000002
before sqrt(1-a). Eight assertions failed. The earlier84.5-degree fixture
passed and remains in the raw evidence; it did not reproduce the defect.

The corrected candidate passes26 actual browser checks across ordinary UK
and southern rectangles, exact antipodal edges in two positions and a near
antipodal edge. An independent3D vector cross/dot calculation verifies segment
lengths and perimeter. The tolerance is1m for antipodal cases and0.1mm for
ordinary rectangles. Exact input coordinates and CSV closing chainage are
also checked. This corrects arithmetic within the existing6378.137km spherical
model; it makes no new survey-accuracy or large-polygon area-model claim.

Separately, generation0521 passed18 maximum-vertex checks and64 control-clearance
checks in each of Firefox and WebKit, using actual phone taps and desktop clicks.
The same source had already passed Chromium. The drivers now accept an explicit
BROWSER_ENGINE and record it in the evidence. Firefox uses a touch-capable narrow
viewport because Playwright does not support its isMobile option.

Raw evidence is under offline-screenshots/recovery-20260906:
poly0521-distance-negative, poly0521-distance-negative-exact, poly0528-distance,
poly0521-firefox-limit, poly0521-firefox-clearance, poly0521-webkit-limit and
poly0521-webkit-clearance. Publication/CI acceptance is recorded separately.

GPU draft PR3 hardware evidence also received an independent saved-artifact
check in gpu-benchmark-hardware/identity-check.json. All22 checks pass: executing
CRLF source normalizes exactly to Git source34a84b51, both WGSL strings match
baseline31e1bcf, input hashes agree, all25 counts equal4099 and each recorded
elapsed total/mean recomputes from the saved iterations. Report SHA256 is
9cf0c7189feb8cfa5293abb3f3a48fb574392865be32af089d2677d58b40c7a7.
This is not another hardware execution or a general performance result.
