# Teleprinter in Test Code

The engines are authored in `Ventusltd/teleprinter`, under `drivers/codex`.
Test Code generation `202609051419` uses engine commit
`6f2026458665abffd969dc5e2f814157e365bf70`. It adds a Teleprinter control to the
landing page, Pipeline News and Atlas.

Readers choose **Print** for a screen PDF or **Print source code** for a text
file they can attach in ChatGPT. **Copy source code** copies all selected source;
if clipboard access fails, complete selectable text appears. **Share source code**
uses the device's file share sheet where supported. No GitHub access is needed.

Build in two phases so the source print refers to a real committed app version:

1. Run `node sandbox/capsules/teleprinter/build.mjs prepare --engine-dir PATH`.
   This creates a new UTC generation and refuses to overwrite one.
2. Review and test the generated code, then commit its files.
3. Run `node sandbox/capsules/teleprinter/build.mjs finish --generation TIMESTAMP --revision FULL_CODE_SHA --engine-dir PATH`.
   This reads the committed source scope, verifies the working bytes match it,
   and writes the per-app text, manifest and pin. Commit those outputs separately.

Current source pins identify `39bcc72aecbc668c4d2554ced096a7e63b78e33c`:

| App | Selected files | Text bytes |
| --- | ---: | ---: |
| Test Code | 9 | 54,672 |
| Pipeline News | 88 | 442,084 |
| Atlas | 14 | 973,944 |

External dependencies, remote Atlas shell, datasets and prior detector results
are outside the source print. The text includes its exact scope and exclusions;
it is not presented as a complete offline copy of all external services.

The inherited 100-REPD/10-industrial detector results are explicitly labelled as
previous-generation evidence. This addition did not rerun that entire grid test.
Connected Chrome did follow Pipeline's REPD2484 MAP link: East Anglia's screen
reported ENGINE COMPLETED and 77.77 km to Sizewell B, then downloaded the source
text from the real Teleprinter control. The distance is the existing engine's
screening result, not verification of grid connection feasibility.

`teleprinter/drivers/codex/outcome-results.json` records 16 browser/viewport cases
with actual PDF, screenshot-input and source downloads. `app-outcomes.json`
records nine landing/Pipeline/Atlas outcomes across Chrome, Firefox and mobile
WebKit emulation. Pixel samples, embedded ICC profiles and rendered output are
checked. No screenshots or test PDFs are retained or published. Physical iPhone
and native share-sheet testing are still the user's device checks.

`verify-live.py WEB_REPO GENERATION OUTPUT_JSON` compares published bytes against
Git, including the homepage. `homepage.py WEB_REPO GENERATION` creates a measured
restore point before adding the new Test Code link and retaining its predecessor.

## Local diagnostic receipts

Use the app-aware server for localhost browser proofs. A plain static server does not implement the diagnostic POST and yields a source-collection GET 404. This is an environment failure, not a reason to ignore a missing resource.

```powershell
python sandbox/capsules/teleprinter/serve.py --root C:\Users\vikra\globalgrid-testcode-publication --output C:\Users\vikra\OneDrive\Desktop\offline-screenshots\local-receipts --port 8894
python sandbox/capsules/teleprinter/serve.test.py
```

GET /__testcode/receipt returns endpoint metadata; POST validates and appends JSON receipts to the offline directory. It never writes into the served repository. The server binds only to 127.0.0.1. Stop it after testing. Deployed pages do not call this localhost-only endpoint. CVAA's runtime-endpoint-contract vaccine checks separately declared GET and POST probe evidence.
