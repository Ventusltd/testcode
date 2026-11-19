# Pipeline News V9.55 — isolated regression lab (19 November 2026)

**Testcode only.** This lab is an immutable input lock and reproducible browser harness, **not a new Pipeline News implementation**. The original production release remains unchanged.

## Source and all dependencies

The three Git submodules in this directory pin **exact commits**, not moving branches:

- `source/`: `Ventusltd/globalgrid2050@f966203afb84561aa8b6b2e711dcf23812498a9b`, containing the complete V9.55 release, older V9.51/V9.53/V9.54 comparison editions, shared `automation/` modules, data and assets. This is the authoritative published source, not a reimplementation.
- `gridatlas/`: `Ventusltd/gridatlas@839435104e0fdfb059c407a2e49cb9ad540d8f5f`, the V9.191 rollback.
- `pipelinenews/`: `Ventusltd/pipelinenews@35c7507fe4c164037c993e512e3e72972de12905`, related upstream pipeline engineering, **not** an additional engine mounted in V9.55.

`inputs.json` pins Git blobs for each HTML baseline, Chart.js 4.5.1 with its original SRI, Playwright 1.62.1, and the homepage ownership restriction. The workflow uses sparse checkouts of the **exact** Git commits, preserving relative `../../automation` paths; the offline resolver walks all HTML script/styles and recursive static ESM imports, checks local SRI and compares V9.54 data/map/script trees. The browser records every local request and HTTP failure to expose dynamic dependencies not discoverable by static parsing.

## Reproduce

From a clean clone of `testcode`, run `git submodule update --init labs/pipelinenews-v955/source labs/pipelinenews-v955/gridatlas labs/pipelinenews-v955/pipelinenews` (this fetches the full pinned upstream repositories), or use the workflow's lighter sparse-checkout steps. Then:

```sh
node labs/pipelinenews-v955/offline.mjs
cd labs/pipelinenews-v955/source/uk_renewables_pipeline/202611191305
npm ci
npx playwright install --with-deps chromium webkit
cd ../../../../..
python3 -m http.server 8765 --directory labs/pipelinenews-v955/source &
node labs/pipelinenews-v955/browser.mjs
```

The browser uses the **real** pinned Chart.js CDN and actual source datasets, not a Chart stub. Screenshots and JSON evidence go to `labs/pipelinenews-v955/evidence/` (CI artifacts); failures fail the job, never silently pass. Offline dependency checks run before the network/browser phase. No CI step deploys or changes homepage pointers.

## Scope and limitations

Test mobile and desktop (320, 375, 393, 768, 1440, 1920), Chromium and WebKit; verify opening HUD/ticker, news, 50-row pagination, sorting, table freeze, project detail and MAP link identity. Record cold and warm loads, HTTP/console failures and missing-CDN behavior; compare historical release source and homepage pointer without rewriting them. External GridAtlas arrival is a **separate network gate**: deep-link construction is checked locally, but actual electrical substation tracing requires a live receiver and cannot be asserted by a simple valid URL. Physical iPhone acceptance belongs to the owner.

**Known defect at isolation time:** the V9.55 index still says V9.54 in title, Site tools and release metadata. The lab records this rather than patching historical release bytes. The user's 13:04 GitHub unicorn page occurred while Pages deployment was still in progress; it is not evidence of a JavaScript crash.

**Important:** source HTML loads Chart.js from jsDelivr; this dependency is not bundled into the release. If the CDN fails, the current gauge module silently substitutes an in-memory stub and numeric values may still appear. The network-denial scenario tests for this misleading success condition and records it as a defect if observed.
