# Integration gates (no implicit authority)

1. **Code gate:** authored Python engine, versioned JSON, 40 named adversarial controls and 5 contract/UI checks. Missing fixtures or drift fail; no `unittest.skip` for mandatory gates.
2. **Browser gate:** actual local-page 390px/393px/1440px first click, keyboard, focus, >=44px, no JavaScript, reduced motion and screenshots. Separate WebKit/iPhone validation is needed for Safari assurance.
3. **Source gate:** obtain official immutable source manifest with SHA256, raw files, all 7,775 IDs and original statuses; verify against unchanged snapshot. This synthetic 3-row sample must never be counted as a pass here.
4. **Evidence gate:** capture real original article bytes, retrieval chain, owner registry, rights basis, stable reviewed project-binding and event identifiers. Without those anchors, labels remain CANDIDATE/INSUFFICIENT.
5. **CI gate:** GitHub Actions exact commit SHA, test logs, schema and browser artifacts, no mandatory skipped gate. No network-dependent requests in offline phase; separate browser job may install pinned browser dependencies.
6. **Product gate:** independent owner authorisation for separate non-live V9.23 GlobalGrid2050 preview after Agent8 V9.22 governance; preserve Agent9/mobile repair separation.
7. **Release gate:** owner real iPhone Safari on preview plus independent GitHub reviewer verifying matching source and served SHA, immutable rollback, accessibility and source licence. Only another explicit owner approval authorises promotion.
