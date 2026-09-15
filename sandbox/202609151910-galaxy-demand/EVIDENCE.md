# Verification record

Local source-pinned model tests:11 passed, zero failures/skips,2026-09-15. Before execution, tests compare the external calculation module's exact SHA256 with `d3fa87733b1131a4b3f44fe9ab45b7304aae7168e31403dc1fddbc032e14043f`. The implementation remains external to this directory.

The visible local Chrome preview loaded the direct pinned module and displayed210kW group demand,700kW unrestricted, and30% for the explicit100×7×0.3 synthetic example. This first-result observation is not a full browser acceptance run.

The committed browser harness covers Chromium and WebKit,390×844 DPR3 and1400×900 DPR1, both directions, invalid/missing/range input, clearing stale output, JSON export, source-response hash, overflow, reduced-motion behaviour and a blocked-module failure case. A committed test is not a passing execution receipt. Hosted results will be recorded after completion.

Native optional WebMCP registration and tool calls have not been exercised in a supported context. No claim of physical iOS testing, universal device compatibility, engineering approval or network-data adequacy is made.

Hosted run [35012121288](https://github.com/Ventusltd/testcode/actions/runs/35012121288) at `1eac47b4f58976038549e439a84eebe3e52c94ac`: **4/4 demand browser cases passed**, Chromium151.0.7922.34 and WebKit26.5, each390px DPR3 and1400px DPR1,19:13:47–19:13:51 UTC. Each recorded zero normal-workflow errors/failed requests, no overflow, the expected exact engine-response SHA256, and intentional module-unavailability refusal. The same run also rechecked the visibility lab. Tests served the checked-out source on the hosted runner, not mutable Pages.

Pages run35012119931 succeeded. At19:15 UTC, the served index.html/style.css/app.mjs/model.mjs were fetched over HTTPS and SHA256-compared with source bytes: all four matched. The WebKit390px initial-result screenshot was visually inspected. No physical-device or native WebMCP claim is added.
