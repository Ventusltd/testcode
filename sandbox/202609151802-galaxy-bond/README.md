# The Bond: a bounded layer-evidence audit

This standalone page reads `report.json`, a reproducible snapshot of the public
code galaxy. It lets a reader select a layer, inspect named predicates and first
deviations, read disclosed gaps, and see the prose that was not evaluated.

Passing supported predicates is not proof of every sentence, source dependency,
physical claim, or runtime composition. A disclosed gap is not a penalty and does
not excuse an invalid key or a contradicted count. Extra fields are not automatically
stronger evidence. This version does not infer UNDERCLAIMED.

This published report deliberately omits the optional block register and
independent owner/character map. Module aggregate claims and copying semantics
therefore remain not evaluated. The experimental callable API assumes those
optional inputs are complete and well-formed; it does not yet prove rendered
module completeness or reconcile an owner map against all family arrays. Do not
use optional-input results as a completeness certificate.

## Reproduce

Python 3.12, standard library only. Keep the source checkout and public numbered
cache outside this page directory. The selected source commit's
`build/codex-sources.json` supplies immutable Git blob pins for the required cache
files: `all-lines.bin`, `lines.bin`, and `families.json`.

```text
python -B -m unittest discover -s . -p test_bond_validator.py -v
python -B build_report.py --galaxy-repo <source-checkout> --commit <full-commit> --input-dir <external-cache> --generated-utc <UTC-time> --output <new-report.json>
```

Do not overwrite historical reports to conceal a changed result. Choose a new
timestamped version. Source discovery reads Git blobs as data and does not execute
indexed JavaScript. The emitted provenance identifies the source commit and every
consumed numbered-input digest.

## Browser and integration

Serve this directory as static files. Required browser files are `index.html`,
`style.css`, `app.mjs`, `report.json`, and the unchanged `wafer.mjs`. All runtime
fetch/import paths are relative to this directory. No root manifest, root script,
live API, private service or source cache is needed to view the report. The source
link leads to the pinned public repository commit, not a changing branch.

The copied wafer module is the unchanged canonical Git blob
`56514b6fa9cbfa61b0944ae18bcb7d599628f22b`. Its SHA-256 is
`3f7a57344a804fbc7e7352155b40fe0d3cae42c8f6d1fd50a7dfc4b6234c0809`.
The preview draws at most the first 128 distinct issued keys per layer in feature
order; it is explicitly a sample, not the complete numbered database. Canvas
placement comes from that frozen module. Selection colour is not a verdict scale.

The report does not publish new grid-network data and does not certify an
engineering design. Physical or runtime claims outside the supported predicates
remain unproved. See the report's per-layer coverage and unevaluated statements.
