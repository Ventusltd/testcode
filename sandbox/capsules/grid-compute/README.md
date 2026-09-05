# Grid computation detector capsule

This capsule observes the actual Atlas selection calculation, compares its returned
distances with an independent Node run of `ventus-grid-engine`, and checks that a
result is rendered on the map. A page loading, a project name, or a paragraph that
mentions a substation cannot pass on its own.

The fixed corpus contains 100 distinct REPD IDs: 20 each solar, BESS, onshore wind,
offshore wind and biomass. Ten NAEI industrial records are additional cases, not
counted towards 100 REPD records. Missing coordinates remain failures. Aggregate
records such as 169 stores must not be assigned a fabricated single location.

## Running on the working machine

Run from the `testcode` checkout with `ventus-grid-engine` checked out beside it.
Install Playwright and the browser engines for other machines; installed Chrome
and Edge use their own channels. The local fallback uses the existing GridAtlas
Playwright installation. The JSON config pins the build URL, corpus and output
directory. The local server serves the publication worktree at port 8877.

```powershell
node sandbox/capsules/grid-compute/detector.proof.mjs
python sandbox/capsules/grid-compute/server.py
# In another PowerShell session:
$env:CAPSULE_CONFIG='publish-candidate.json'
node sandbox/capsules/grid-compute/run.mjs
```

`CAPSULE_BROWSERS` accepts chrome, edge, firefox, webkit,
chrome-android-emulation and webkit-iphone-emulation. `CAPSULE_CASES` selects an
explicit comma-separated subset, and fails if any requested ID is absent.
`CAPSULE_KIND` and `CAPSULE_LIMIT` are diagnostic filters: reports from these are
not full-corpus certificates. `CAPSULE_REPORT` selects a separate output report.

Each case uses a fresh page, records outcomes, and closes the page. Two workers
are used per browser. Screenshots are disabled by user instruction. Keep only
code and JSON/text observations in Git. Do not add screenshot captures back.

## What the evidence means

`ENGINE_NOT_FIRED` includes requests never entering the real calculation.
`WRONG_ENTITY`, `WRONG_OR_UNVERIFIED_LOCATION`, and `BACKEND_RESULT_MISMATCH`
fail independently. `COMPUTED_BUT_NOT_DRAWN` catches a completed calculation
whose result is absent from the rendered map. Failures exit nonzero.

The negative proof rejects absent calls, stale results, wrong identity, wrong
location, wrong distances, and hidden/absent lines. Nine assertions passed.
The engine observer has its own 22 assertions and full 155-check verifier.

Chrome extension visits are separately recorded as direct Pipeline MAP clicks.
Automated Chrome runs are separate installed-Chrome sessions, not extension
visits. Windows WebKit and mobile emulation are not real Safari/iPhone or an
Android device. The user supplies iPhone acceptance testing.

The displayed distances are indicative screening, not agreed connections.
Lease-area centroids are explicitly approximate and carry their source and hash.
Industrial emissions remain tonnes CO2e; the capsule does not invent MW demand.

The screenshot cleanup removes current tracked images and adds ignore rules.
It does not rewrite previous Git history.
