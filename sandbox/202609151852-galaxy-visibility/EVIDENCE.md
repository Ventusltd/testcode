# Verification history

Application source: `c7cb9bfaa165cb7a453e14c087f4a71296c10f1a`.

- Local model and full geometry integrity suite:10tests passed; all201files/47,236features were checked. This is not simultaneous browser-render coverage.
- Pages run35010925304 succeeded for that commit.
- Hosted browser run35010927352 **failed**:1/4cases passed. All four observed no page/console errors or failed network requests up to their stopping points. The two phone cases stopped at an absolute mouse click below the viewport, before inspecting a key; Chromium desktop asserted the row count before the asynchronous details-toggle event populated it. WebKit desktop completed the whole check, including export and tampered-catalogue refusal.
- The test driver was corrected to use a locator-relative, automatically scrolled canvas click and to wait explicitly for table population. Application, geometry, palette and style-model bytes are unchanged by this correction. The failed run remains part of the record; a corrected test file is not itself a passing rerun.

Optional WebMCP hooks are feature-detected, but no supported native validation context was available in this receipt. They are not claimed verified. Headless WebKit is not a physical iPhone or iOS memory-pressure test.

Corrected run [35011273409](https://github.com/Ventusltd/testcode/actions/runs/35011273409), checked-out source `d2add56f32b4759bd52128a9d55ed409c3f5a5a7`: **4/4 browser cases passed**, Chromium151.0.7922.34 and WebKit26.5, each390×844 DPR3 and1400×900 DPR1. Observed19:04:01–19:04:27 UTC,2026-09-15. Each case recorded zero errors/failed requests, no overflow, three lazy geometry requests and a refused tampered catalogue. The harness served the exact checkout on the hosted runner; these are not browser observations of mutable Pages. Ten model/integrity tests also passed.

Pages run35011272621 succeeded. Separately, at19:09 UTC, served index.html/app.mjs/model.mjs/style.css/catalog.json/visibility-style.json/wafer.mjs were fetched over HTTPS and SHA256-compared with their local source bytes: all seven matched. Static style JSON SHA256: `e67f6bcde5910bb0565ab535f9203444fcc45df42123045d99d0974b69b4785a`. The WebKit390px fit screenshot was visually reviewed; visible current/proposed geometry, controls and contrast limitations were legible without horizontal overflow. This does not certify every layer's pixels or all device conditions.
