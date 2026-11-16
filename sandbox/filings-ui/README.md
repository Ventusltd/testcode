# Provisional filing figures: TestCode consumer

This reusable adapter renders typed funding, power and energy claims inside an
existing project or issuer detail area. It preserves exact decimal strings,
source units, currencies, periods, scope, revision and provenance. It never
adds figures together, allocates group totals to projects, converts currencies
or makes a claim independently verified.

All demo data is explicitly **synthetic**. This lab does not collect documents,
grant source rights, extract financial truth or publish evidence. Its local MAP
and CSV buttons test preservation of host controls; they are simulated actions,
not production map navigation or export acceptance. Command owns product
integration, formal releases and publication.

## Consumer interface

Load `figures.css` and import the renderer:

```js
import { renderFigures } from './render.mjs';

renderFigures(existingDetailElement, {
  entityId: selectedEntityId,
  state: 'available',
  claims: validatedFilingClaims,
});
```

Each claim must satisfy the supported subset of the pinned FIGURES contract and
match the selected entity ID exactly. The renderer inserts one expandable
`details` child and preserves the host's other children and event handlers.
Repeated rendering replaces only this adapter's child. A validation failure
clears stale figures and shows an unavailable state.

Use `state: 'unknown'` or `state: 'unavailable'` with an empty `claims` array to
represent those conditions. An empty available array means no figures were
supplied. None of these states displays a fabricated zero. `buildViewModel`
in `model.mjs` is the pure validation/display adapter; it returns cloned claims,
display strings, explicit states and `publishable: false`.

Limits are deliberate: at most 100 claims per entity; plain JSON objects;
unique claim IDs; machine-provisional status only; HTTPS public DNS-form links
without credentials or custom ports. Public IP literals accepted by the Python
contract are unsupported here. The producer's existing identifier contract
also excludes some exchange identifiers, including `nse:M&M`; this consumer
does not silently rewrite them. Date precision and supplied retrieval offset
are preserved. Source assurance labels remain source assertions.

## Immutable source dependency

`generate_fixtures.py` checks the exact source bytes before loading the producer's
validator and generating the five demo cases:

- Repository: `Ventusltd/globalgrid2050`
- Commit: `e0deabac45d35240f6c38f4303b8d50c90412e06`
- File: `automation/news/filings/contracts.py`
- SHA256: `7db9f5334529bd51e3d1dc64abbd7ec0180b69e832c196d37cc93caf09e133c2`

Provision that exact file separately, then run from the repository root:

```sh
python -B sandbox/filings-ui/generate_fixtures.py --contract-file /path/to/pinned/contracts.py --check
node --test sandbox/filings-ui/tests/model.test.mjs
```

No acquisition occurs in either check. The generator rejects a missing or
changed contract and a changed committed fixture. Synthetic source hashes and
example.org links are test values, not proof of a real filing or numerical fact.

## Browser checks

Install the lockfile dependency with `npm ci --ignore-scripts` from this directory.
The default harness uses installed Google Chrome. From the repository root:

```sh
FILINGS_UI_ARTIFACTS=/path/to/artifacts node sandbox/filings-ui/tests/browser.mjs
```

PowerShell users can set `$env:FILINGS_UI_ARTIFACTS` before invoking Node. To
reuse an existing Playwright installation, set `PLAYWRIGHT_MODULE` to its
`index.mjs`. Hosted CI explicitly sets `FILINGS_BROWSER=chromium` and provisions
Chromium after the source and model checks pass. The dependency is locked to
Playwright 1.65.1.

The harness serves only allowlisted local files, blocks external page requests,
and writes a JSON receipt plus four screenshots. Fifteen scenarios run at
375, 390, 768 and 1440 pixels: exact values, explicit unknown/unavailable states,
safe text and links, identity mismatch, invalid-input clearing, keyboard access,
repeat rendering, host controls and overflow. These are desktop browser viewport
tests, not native Android or public deployment acceptance. They do not certify
source-document accessibility or the truth of a claim.

The isolated `filings-ui` workflow checks the pinned Python fixture generation,
runs the model tests and hosted Chromium proof, and preserves browser artifacts.
The proposed product destination is `automation/news/filings-ui/`; this TestCode
branch changes no product release paths or inventory data.
