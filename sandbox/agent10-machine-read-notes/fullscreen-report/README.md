# Pipeline News report surface — TestCode V9.23-or-later proof

**Isolated, non-publishing.** This directory is NOT a separate application or a preview of a published Pipeline News edition. It demonstrates an additive, full-window reader over the **same existing project identity and filtered order** as the catalogue, for possible integration *after* V9.22.

## Try the proof

```bash
cd sandbox/agent10-machine-read-notes
python -m unittest discover -s tests -v
node --check fullscreen-report/report-mode.js
# Where localhost HTTP is permitted:
python -m http.server 8000
# Open http://localhost:8000/fullscreen-report/
python scripts/report_browser_check.py --engine chromium
python scripts/report_browser_check.py --engine webkit
```

All three REPD records and source URLs are **synthetic illustrations**. `fixtures/projects.synthetic.json` is a separate frozen demo source, and `fixtures/notes.synthetic.json` contains *candidate-only* note interpretations; this feature never rewrites that source. The data centre fixture is likewise synthetic, uses a native `dcuk-` site identity, has missing geometry, and keeps IT load separate from grid MW.

## Behaviour contract

- Existing Pipeline News is the owner of rows, source fields, filters, sorting, paging, CSV and MAP deep-links. Integration must **reuse** its canonical project model and original generated MAP URL. The report component is not authorised to derive a GridAtlas link. The synthetic fixtures deliberately have **no MAP href**, so the proof displays unavailable rather than inventing location.
- Report mode is an HTML full-window dialog (no Fullscreen API requirement); native fullscreen is only optional enhancement when supported.
- Report header/close, official frozen facts, note + provenance, forward/back within the *filtered* ordering, and external MAP action are all model-fed. Opening a report does not invoke an AI model or rewrite an existing row.
- It works in portrait 390/393, landscape 844×390/852×393, tablet 768, and desktop 1440. It has one principal internal scroll area, compact shallow landscape header, touch targets ≥44px and safe area insets.
- It restores focus to the initiating action on close, keeps the filter control and table intact, traps Tab inside the dialog, responds to Escape, and uses an additive `?report=repd:<ref>` browser-history state. Filter changes outside a report rebuild only the catalogue fixture. Actual product integration must use the *existing* Pipeline News filter state and its `filtered` array.
- `brief-text` is present, **fully visible** and screen-reader available before any animation. Only a duplicate `aria-hidden="true"` decorative copy has a paced print reveal. No flashing, sound, or source text transcription.
- JavaScript disabled: fallback native disclosure summaries remain readable in the catalogue. Print from an open report: a sequential record, note and provenance, with URL expansion and no animations.

## Scope of proofs

The offline adapter suite does **not** assert original 7,775-record preservation. The browser runner covers visible interactions and layout using pinned synthetic source bytes, recording the selected engine, source SHA256, and screenshots/traces. Local environment may block HTTP navigation: only when `ALLOW_OFFLINE_COMPOSE=1` is explicitly set will the runner use in-memory browser composition; it then labels real browser Back as **NOT VERIFIED**, and any GitHub job requiring the actual localhost history path must still pass independently. GitHub Actions needs the actual 390/393/844/852/768/1440 source-served tests in both Chromium and WebKit; it must not use the fallback to claim a normal hosted browser PASS.

**Not verified:** original publisher receipts, licencing, full REPD 7,775 links, native iPhone Safari, independent same-hash served preview and live GridAtlas first-restore. These remain stop-ship for product integration. V9.22 and Agent9 branches are out of scope.
