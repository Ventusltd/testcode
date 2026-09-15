# Verification receipt

Checked 2026-09-15 18:11 UTC against this local static version.

- Python validator: 24 offline tests pass, including invalid keys, stale manifest metadata, duplicate IDs, exact family order and disclosures that do not waive contradictions.
- JavaScript: `node --check app.mjs` and `node --check wafer.mjs` pass.
- Headless Chrome 153.0.8010.37: 430 × 932 and 1400 × 900 viewports; zero page errors, console errors or failed requests; no horizontal overflow.
- Browser assertions: 201 displayed layers match the report; pinned-source link matches the full source commit; search, selection, return navigation and result filtering work.
- Phone overview and selected-layer screenshots visually inspected.
- Report: 858,579 bytes; SHA-256 `c6441697b7225ad548da4a0464d49c2394d88401e0c83ad4137e913a41269feb`.
- Source: `Ventusltd/galaxies-wafers` at `f5de7a85cb235d43247a337b3e13a6cc08a9c0c4`.
- Counted report results: 201 layers, 47,236 features, 194 partially evaluated, 7 not evaluated, 0 contradicted and 0 honoured. Absence of contradictions is not completeness or engineering certification.
- Runtime totals are counted from the report; wafer marks use issued-key samples and the unchanged placement module. No randomised output or verdict colour scale.

This receipt is a local snapshot check, not a claim that a hosted deployment was
tested or that any unsupported statement was verified. Reproduction and current
optional-input limitations are described in README.md and API.md.
