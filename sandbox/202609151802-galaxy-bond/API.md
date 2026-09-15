# The Bond v1 validator

`bond_validator.py` is a stdlib-only Python 3.12 module. Its callable core performs no I/O and does not mutate inputs. Reports omit local paths and provenance payloads. Evidence and notes are preserved verbatim: callers must provide public documents suitable for publication.

```python
report = audit(manifest, layers, issued_keys, families, family_lines,
               raw_bytes=raw_bytes,
               independent_lines=independent_lines,
               block_register=block_register)
```

- `manifest`: parsed `wafer.v1` manifest.
- `layers`: dictionary keyed by manifest `file` or layer `id`, containing parsed layer documents. File-key lookup takes precedence.
- `issued_keys`: iterable of actual unique positive uint32 integer line keys (maximum 4,294,967,295). Family IDs are not used as line keys.
- `families`: pack array of `{n,lineOffset,lineCount}` or records with independent `{n,lines:[...]}`. Family IDs must be unique. This may be omitted, reducing anchor coverage.
- `family_lines`: array of little-endian uint32 values decoded from the exact matching `lines.bin` pack. Arrays retain order and repeated keys.
- `raw_bytes`: optional dictionary using the same keys as `layers`, containing the original bytes, not JSON reserialization. Required for manifest byte/hash checks. Parsed documents are also checked against these bytes.
- `independent_lines`: optional mapping integer key (or decimal string key) to `{owners:[family IDs], chars:integer}`. Owner membership must be complete independent pack evidence and chars the independent character length. Same-feature `families` and `chars` properties are deliberately never used as evidence. Missing values produce NOT EVALUATED.
- `block_register`: optional independent `{blocks:[{symbol,number,inside:[{family}],repos:[...]}]}` or block-to-family-ID-array mapping. A mapping supports membership/counts, but cannot establish block numbers or repositories.

## Report

Top level: `schema: "bond.v1"`, `scope`, `input_checks`, `inputs`, `coverage`, `rows`.

Each row has `manifest_index`, `layer_id`, `label`, `claim_text`, `status`, `predicates`, `disclosed`, `not_evaluated`, `first_deviation`, and `coverage`. Array indexes are zero based; collection/manifest deviations have `feature_index: null`.

Each predicate: `{id,text,status,checked,total,passed,failed,first_deviation}`. Its status is `PASSED`, `FAILED`, or `NOT EVALUATED`; partial input availability is never passed as full coverage. All checks run to compute denominators. A first deviation is `{feature_index,field,expected,actual}`.

`not_evaluated` entries are `{field,text,reason}`; source prose remains verbatim. `disclosed` entries are `{field,value,status:"DISCLOSED"}` and do not excuse failed predicates.

Row statuses:

- `CONTRADICTED`: at least one evaluated predicate fails, regardless of disclosures.
- `PARTIALLY EVALUATED`: at least one semantic predicate is checked, with remaining unevaluated statements/checks.
- `NOT EVALUATED`: structural checks may pass, but semantic evidence has no evaluated predicate.
- `HONOURED`: all supported predicates pass and no statement/check remains unevaluated. This is scoped to the exact reported text and predicates; it is not a general natural-language certification.

Never infers UNDERCLAIMED from extra properties or a satisfied lower bound. No status colours. Unknown crossname, learned, repository/source equivalence, and explanatory claims remain NOT EVALUATED. First-line checks validate exact family alignment only, not source-equivalence or register-selection claims. Routes are compared to the pack array, not sorted numerically.

`coverage` counts every actual feature, key reference, distinct key, check and check denominator. Geometry keys may repeat and are counted as references; distinct keys are separately counted. An empty feature array has 0/0 geometry checks; prose and independent semantics are still evaluated or withheld normally.

## CLI

The CLI accepts explicit paths; no directory discovery, package install or network access occurs. `--layers-map` points to a JSON dictionary from manifest file/id to an explicit source path. `--manifest`, `--layers-map`, `--issued-keys`, and `--output` are required. The output must be a new file; an existing file is never overwritten. Optional flags: `--families`, `--family-lines`, `--independent-lines`, `--block-register`.

Binary inputs are little-endian uint32. Output is deterministic JSON with no timestamp or input path. Exit 0 means no contradiction was found in available checks, not full proof; exit 1 means a contradiction or invalid manifest/issued-key input; exit 2 means an input/output failure. Consumers must render coverage and NOT EVALUATED even when exit is 0.

`python -m unittest -v` runs the offline fixtures.
