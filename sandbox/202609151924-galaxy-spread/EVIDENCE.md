# Evidence record

Corrected visual source `0875f88eece880a72e69bb7283247b7fe8d07b8a`: [browser CI35014400493](https://github.com/Ventusltd/testcode/actions/runs/35014400493) passed all four spread cases, including the new computed-axis-fill regression. WebKit phone screenshot visually inspected: no black axis triangle remains. [Pages35014399426](https://github.com/Ventusltd/testcode/actions/runs/35014399426) succeeded; served HTML,CSS,app and model hashes matched exact source at19:38UTC on2026-09-15. CSS SHA256 is `58b4741a4c1bc855b81bb532ebe28bfb9fae8c2ae14e99e6fbdd40fec2017b2e`. Engine and app/model hashes are unchanged. This supersedes the initial rendering defect, not the retained historical receipt.

External arithmetic source pin `d9cd18b0e2034325814924e6e4a0e958014f2748`; module SHA256 `e6c4b9de5bc2bf6a8900ef776b3d5005ca358a3f73b38ba002205a37f7ca41f8`. The local Chrome preview loaded that pinned URL and displayed1GWh and£30,000gross for the explicitly synthetic1GW/1hour/1utilisation/90-versus60GBP perMWh example. This is not a full browser acceptance receipt.

Model tests hash-check the exact external source before execution. Browser checks cover four viewport/engine cases, swapped prices, equal-price partial refusal, negative price, zero/missing utilisation, run action, missing handoff explanations, exact CODE URL, ten sensitivity records, export, reduced motion, overflow, source-response hash and unavailable-module refusal. Committed checks are not passing executions; hosted receipts follow after completion.

No current fleet, route geometry, market schedule, price forecast, return-on-investment recommendation, physical iOS test or native WebMCP verification is claimed.

Run [35013797022](https://github.com/Ventusltd/testcode/actions/runs/35013797022), source `f17a50c85c6e6b4922957fe4a900a63e7c7b61f9`:11model tests and4/4spread browser cases passed at19:29:41–19:29:50UTC. Both engines at390pxDPR3 and1400pxDPR1 had zero normal-workflow errors/failed requests, no overflow, the matching engine response digest and unavailable-module refusal. Pages35013795503 succeeded; served HTML/CSS/app/model all SHA-matched source at19:32UTC.

Visual review found an unintended black triangular fill on the open SVG axis path. Numerical results and tests were correct, but that visual was not accepted for handoff. Follow-up explicitly sets axis fill:none and adds a computed-style regression assertion. The existing pass does not certify the follow-up edit; its rerun is recorded after completion.
