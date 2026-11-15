# GridAtlas first mobile restore — Agent 3 TestCode regression contract

Status: **independent TestCode-only QA, not a GridAtlas or V9.22 repair**. This work does not change REPD, production, GridAtlas, the source candidate or homepage pointers.

## Observed problem

GridAtlas issue [#87](https://github.com/Ventusltd/gridatlas/issues/87#issuecomment-6896710224) records a real 390px first-restore discrepancy for solar REPD **12588**: all six cartridges composed, the nearest-grid value existed in *hidden* DOM and runtime failures were empty, yet the first click could leave the popup minimised. Two other sampled cases (**12453 BESS**, **14535 onshore wind**) became visible after a single click. Later PR115 tests passed on another run; this is **intermittent** and neither all-fleet nor iOS proof.

The currently composed GridAtlas `sld-sandbox` cartridge in `atlas/current.json` generation `202611132345` points to `atlas/cartridges/202609241334-sld-sandbox-v9-8.js`. The source's `resetCardGeometry` unconditionally reapplies mobile `gridatlas-min`, while the card's restore-click handler merely toggles the class. Source-level analysis supports a possible late re-minimisation race. This is a **hypothesis**, not a proven production fix. The current cartridge's Git blob at inspection was `fe8b2b2f98eec09d8c9e4a9cd5e40b12ee4b0200`; always refetch current generation, bytes and SHA before retesting.

## What was fixed in TestCode

`drivers/gridatlas-mobile-restore-receipt.mjs` is a fail-closed acceptance checker for actual human/browser-captured evidence. It refuses **PASS** when nearest text exists only in hidden DOM, when a restore click leaves `gridatlas-min` present, when the visible card is unstable, when the collapsed control lacks a plus/restore label or has a sub-44px hit target, when cartridges/technology/error status is missing, or when the clicked REPD/technology/coordinates do not reach the canonical receiver. It records separate computation and presentation checks rather than conflating them.

`node drivers/gridatlas-mobile-restore-receipt.mjs --selftest` runs synthetic mutation controls to prove false-green rejection. Passing this selftest **does not mean** real GridAtlas works. A real receipt must pin its source Git SHA, composed generation, source MAP click URL and exact receiver URL, technology, 390/393/1440 viewport, nearest output status, click state, controls, screenshots and traces. Run `node drivers/gridatlas-mobile-restore-receipt.mjs receipts.json` to get a nonzero exit on missing/failed evidence. No receipt is created by this code.

The new workflow tests validator integrity only. Do not register its synthetic selftest as an estate or publication PASS. A product browser gate must run separately, use genuine screenshots/Playwright traces and store exact source/receiver byte hashes.

## GridAtlas/Agent 8 implementation handoff (not applied here)

1. On a **new project selection**, preserve the owner's intentionally minimised, map-first mobile default.
2. On deliberate user restore, persist a user-expanded flag scoped to that popup/project; later `resetCardGeometry` or measurements must **not** silently re-minimise the same selection.
3. Synchronise the control glyph, title, accessible name, `aria-expanded` and ≥44px hit area with the actual expanded/collapsed state, including card reuse and delayed responses.
4. Prove under real mobile touch in fresh and background tabs that first restore reveals nearest substation text, stays visible for ≥1.5 seconds, and that both pending data updates and a new project selection behave correctly.
5. Use proper GridAtlas release process and new immutable cartridge generation. **Do not rewrite or silently rebuild** the existing historical hashed cartridge.

## Release separation

Source URL validity, successful six-cartridge composition, no `window.__GRIDATLAS_NEON_LINKS__.failures`, correct technology layer, visible map lines, nearest result in hidden DOM, card visibility **after restore**, and publisher rights are **different facts**. Record each, including FAIL/UNVERIFIED. Test the known 12588/12453/14535 cases at 390px and 1440px, iOS/WebKit 393px and adversarial delayed updates. Three samples are **PARTIAL**, not a 7,775-project certification; source-only passes are not served-byte or rollback passes.

Signed: ChatGPT Agent 3 — independent TestCode / Pipeline News release QA.
