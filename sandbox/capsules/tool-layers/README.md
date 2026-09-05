# Original design-tool layers

These maintained cartridges integrate separately owned applications without merging their calculations into GridAtlas.

| Module | Responsibility |
| --- | --- |
| compose.mjs | Read a full producer Git commit and verify every manifest member before copying any bytes. |
| ownership.mjs | Bind each tool to its producer tuple; retain older manifests across partial upgrades. |
| host.js | Lazy persistent iframe layers and independent tool buttons. |
| dismissal.js | Escape dismissal in parent and same-origin child documents, with listener cleanup. |
| focus-boundary.js | Tab traversal at parent/child boundaries while preserving internal controls. |

The builder in ../teleprinter/build.mjs copies runtime cartridges into each new sandbox/TIMESTAMP/tool-layers directory. Original applications remain under sandbox/TIMESTAMP/layer-apps. Tool identities are in atlas/tool-layers.json. Never modify an old timestamp to upgrade a tool.

GIS SLD Financial Sandbox producer: Ventusltd/gis-sld-sandbox. Module Layout producer: Ventusltd/layout-tool. Cable Geometry producer: Ventusltd/cable-trench-or-drill. Each retains original runtime releases independently. Shared-origin iframe separation isolates CSS and JavaScript globals; it is not a security boundary.

Run node --test sandbox/capsules/tool-layers/*.test.mjs from the Testcode root. GitHub's Codex cartridge capsule checks workflow runs these on Linux and retains compact source-bound receipts. Browser proof uses Teleprinter drivers/codex/cartridge-outcomes.browser.mjs. Local capsule previews are explicitly marked and are not deployed-byte acceptance.

Detailed screenshots, PDFs and raw receipts stay under C:/Users/vikra/OneDrive/Desktop/offline-screenshots/architecture-reload-20260905. The durable next-fifty roadmap and acceptance ledger live in Ventusltd/spiders, codex/reload/plan-tracker. A passing capsule test does not imply electrical, physical-device, original-tool-print or estate-wide acceptance.

Navigation is bound to the document actually loaded in each iframe. `registry.mjs` resolves explicit current tool pins before retained historical bundles and also identifies unlaunched DC/AC review. `navigation.js` preserves original links and uses the loaded document URL to update title, readiness identity and current owner. Query strings and fragments remain in the original URL. Unknown or inaccessible destinations are unbound, with no claimed owner or drawing pass. Confirmed restart reloads the current accessible document. Closing still returns to the launcher that opened that persistent iframe.

The consumer `atlas/tool-layers.json` navigation list records actual resolved owner tuples. Original producers' historical sibling declarations remain baseline provenance, not a claim that an old sibling is what the current consumer serves.

`source-scopes.mjs` builds `layer-source-scopes.json` as a separate per-tool inventory. It verifies the complete owner manifest structure before selecting files, checks every selected candidate byte, and preserves the entry, exact owner tuple, member sizes/hashes, shared data and dependency declarations. Derived packages inherit external declarations only from a separately hash-verified original manifest. The inventory does not concatenate the tools into Atlas, fetch external dependencies or assert that declared external resources are available. The build reads committed manifests from the sibling producer checkouts and fails if their pinned history is missing.
