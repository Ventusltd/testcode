# Actual Print and source-download review

Reviewed immutable candidate `202609060418`, composed from owner `6d77a92688c07363f8c99c1e1cba7f54d4a039f0`, first committed in TestCode `4161b71991f0ab5d1c3f17c6995f47992eb6398d`. CI diagnostic revision `877f7cb09548b875d6cf6f84ba414900194f80a6` leaves the application bytes unchanged. This is additional review evidence, not another feature release or completion of all 96 review criteria.

## R49: actual app Print path

Entrypoint closure: current Atlas bootstrap imports `202609051906/atlas/teleprinter-bootstrap.js`, which mounts `teleprinter/controls.js`. Its document capture listener intercepts the existing File Print button and calls `print-screen.js` → `app-frame.js` → pinned `vendor/html2canvas-1.4.1.mjs`, `capture-geometry.mjs`, `clone-visible-ui.js`, and `screen-pdf.mjs`. The inherited cartridge's older `printView()` is not the executed path for this action.

The first reviewer driver incorrectly waited for `window.print()`. Both waits failed; this was a rejected test assumption, not evidence that the active Print action loses measurements. Corrected driver clicks the same real button and saves the browser's actual download. No screenshot is fed into the product, no source substitution or screen-sharing permission is used.

Chromium and Firefox at 393×852 and 1440×900, DPR1: actual app-render downloads passed. WebKit at both viewports, DPR3: native 1179×2556 and 4320×2700 captures passed. Reports retain the original geometry and viewport, actual Teleprinter event, download, errors and screen evidence. All three engines preserve the exact polygon after printing. Independently rendered phone PDF visibly includes the polygon, the measurement panel, controls, menu and provenance. The app-render record is separate from the new map-only PDF control.

Additional unchanged-candidate polygon review: Firefox and WebKit each pass 106 desktop/phone viewport interactions. These use mouse input; Chromium alone carries the native touch-drag evidence. Phone emulation is not physical-device testing.

## R73: actual source download

The File source command invokes `print-source-code.js`, validates the pinned base, then calls `runtime-source.js`. Capture includes document/open shadow state, observed resources, public map state and literal JS/CSS references. HTTP diagnostic reads use XMLHttpRequest to bypass the app's fetch transformations. Resource and byte limits are explicit; completeness remains false because browser discovery cannot establish all dormant, worker or server dependencies.

The real source download contained 56 full resource bodies. Independent hashing checked every body against its recorded byte count and SHA256. All four current executable cartridge hashes are present, including the new map-PDF module's composed cartridge. The captured polygon is identical to the working polygon. The download identifies the current route and explicitly states INCOMPLETE.

One local diagnostic endpoint `/__testcode/receipt` returned 404 and was included/disclosed as an HTTP error; 11 discovery warnings remain explicit. These findings are not silently changed into a claim of complete deployment source closure. Raw first download: 43,731,889 bytes, SHA256 `92777c520901878c4ba71f235c0ca8fb42fa0f1b941f15a3de22a52e02839e75`. A subsequent closure check additionally verifies every current cartridge.

## Evidence and publication boundary

Raw files are under `C:/Users/vikra/OneDrive/Desktop/offline-screenshots/recovery-20260906/`: `poly0418-app-print`, `poly0418-app-print-firefox`, `poly0418-app-print-webkit-dpr3`, `poly0418-source-download`, `poly0418-source-closure`, `poly0418-firefox`, and `poly0418-webkit`. Rejected assumptions remain under `poly0418-print-negative`.

At this checkpoint 30 versions are accepted. All 30 are now linked on the homepage after publication `9d364a218b91cf0fda1807bc9705a6616b63e62f`, Pages run `34011203468`. Candidate0418 is not yet accepted: first PDF CI `34011251539` failed during Linux Firefox map initialization before export. The diagnostic revision records headless/headed graphics capabilities and retains page/console errors. No antivirus, browser extension, or security settings were changed.
