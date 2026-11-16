# Prospecting export and manifest consumer proof

This offline proof executes the actual pinned exporter, reads its newly written
`priority.json`, `priority.csv` and `manifest.json`, and imports the real
`parsePriorityBundle` implementation. It extends the separate article-observation
proof without modifying it. A successful raw-triage parse does not cover this
later export and manifest boundary.

```sh
python -B drivers/prospecting-export-consumer/driver.py \
  --product-repo /path/to/local/globalgrid2050 --self-test --out new-receipt.json
```

Python 3.12, Node 20 or newer, Git, and the complete local objects named in
`pins.json` are required. Nothing is fetched or installed. The source defaults
to `19d5634bbd86f2082f6bc1aed251d453ec80fa58`; `--source FULL_COMMIT` can measure
a later complete source revision. The proof reuses the hardened Git reader from
Testcode PR #21 at `35018e018449f10a091f8ebc65abe516b7c837f1` by import. Missing
objects, lazy-fetch attempts and Git replacement/graft substitution retain that
reader's failure behavior. No uncommitted product files are read.

The exporter runs in an isolated Python child with socket creation and DNS
blocked. The consumer installs a fetch guard before importing the actual
bundle. These are explicit guards for the inspected component, not a general
operating-system sandbox. All temporary source and output bytes remain local;
the public receipt includes exact commits, blobs, archive and proof-code hashes,
checks and runtime versions. Errors omit exception messages and input paths.
`--out` creates a new receipt and refuses to overwrite an existing one. Without
it, the receipt is printed to stdout. Failed execution exits nonzero.

The default proof includes:

- Actual export CLI success, deterministic replay, byte-preserving refusal to
  overwrite, and invalid optional-input rejection before output creation.
- Both file receipts and CSV ranked-ID order, independently checked against
  the actual JSON output. The UI parser does not read CSV; CSV integrity is
  explicitly measured by the export-receipt checks.
- Independent reads of hash-pinned source partitions and the frozen selection:
  7,775 official records, 3,604 solar records and exactly the ordered Solar-1000.
  The ranked 1,000 remains a separate subset.
- Real parser acceptance, missing/wrong pins, altered manifest and priority
  bytes, re-pinned receipt/profile/clock/inventory changes, incomplete manifests,
  and a manifest paired with another genuine export.
- A re-pinned, structurally valid source-inventory change that the independent
  baseline association check detects. This is not falsely reported as a parser
  rejection: the parser trusts its supplied manifest pin by design.

Negative controls require the expected semantic rejection after the genuine
positive input has passed. An import failure never counts as a caught mutation.
The `--self-test` option additionally runs eight Node tests inside the same
archive/input closure, including a deliberately permissive adapter, altered CSV,
missing inputs, wrong source association and a caught fetch attempt. A missing
test input or zero-test run fails. For an already prepared local closure:

```sh
TESTCODE_PROSPECTING_EXPORT_SPEC=/path/to/runtime-spec.json \
  node --test drivers/prospecting-export-consumer/consumer.test.mjs
```

The runtime spec contains local input locations and is temporary; it is never
part of the public receipt. No optional news or DC inputs are supplied in this
bounded proof. Evidence and momentum remain unknown. This does not test DOM
rendering, installed Chrome, Android, live rights or public deployment. Formal
V9.27 composition and its browser/acceptance gates remain separately owned.
No workflow, release tree, registry, source schedule or publication is changed.
