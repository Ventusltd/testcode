# Full-corpus news sidecar replay

This offline proof runs the actual Python exporter and JavaScript news renderer
from commit `20c0023ccbd6ed34bb2648caf95ea1a6e22491eb` against all 69 headline
records at data commit `d9d4b9249257ce36ae8f09921fa62a9845a3d492`. It complements
the producer's small browser fixture and preserves the older incompatibility
observation in `sandbox/news-ranking-integration/` without editing that lab.

Provision the three full Git commits in `pins.json` separately, then run with
Python 3.12, Node 24 and Git. No package installation is needed by the proof:

```sh
python -B drivers/news-sidecar-replay/driver.py --product-repo "$PRODUCT_REPO" --out receipt.json
TESTCODE_PRODUCT_REPO="$PRODUCT_REPO" python -m unittest discover -s drivers/news-sidecar-replay -p test_replay.py -v
```

The driver reuses `drivers/prospecting-observation/driver.py` for its already
tested committed Git reader. Lazy fetching, replacement objects, grafts and Git
transports are disabled. Inputs are extracted from exact committed archives;
dirty product working files are not executed. Missing objects fail. The Python
producer runs in a child with socket/URL connection entry points disabled. The
Node VM blocks fetch and timer entry points. These are bounded trusted-source
guards, not an OS sandbox for hostile code. Provisioning is separate from proof;
there is no later network gate, scheduler, activation or publication step.

The 67 composed observations cover eight scenarios. Valid current and partial
collections retain the exact exporter rank order. Missing, byte-mismatched or
different-collection sidecars fall back to date order; stale, failed and snapshot
collections do so even with an otherwise valid sidecar. Actual SHOW MORE callbacks
produce cumulative counts 12/24/36/48/60/69. Every original title, canonical link
and credited publisher remains, including the policy items. Repeated rendering
does not duplicate items or change the input's publication/collection clocks.
Invalid validation clears an earlier priority binding of the same document.

Partial/failed source-state variants and the different-collection title are
explicit counterfactual controls created in temporary memory. They are not new
publisher or source-health receipts. The original committed input remains
unchanged. Titles and documents are never copied into Testcode artifacts; the
receipt contains source/byte identities, counts, booleans and order digests.

The real historical renderer at `e2568fa9b818d39e28b106bbe49c3a53d0ad4fc2` is the
default negative control: it renders 65 of these 69 records, losing four policy
items. A broken import is not that counterexample. Unexpectedly retaining all
items fails the control, so the proof cannot silently turn into an empty pass.
Nine independent harness tests inject faults only into child-process source
inputs: broken pagination, missing attribution, ignored priority, stale cache,
and a substituted historical renderer must each be detected. Missing inputs and
an existing or unwritable receipt destination must fail without exposing paths or overwriting
the previous receipt.

`--out` is optional; stdout always carries the structured receipt. A new output
file is required. Exit zero requires every composed check and the historical
counterexample to succeed. Receipt source fields include full commits, Git blob
IDs and archive/file SHA256 values; proof hashes include the reused Git reader.

This is a minimal DOM model, not installed Chrome, layout, Android, public
readback, ranking-quality assessment, source independence, rights or release
acceptance. No product files, existing Testcode labs, workflows or `engines.json`
are changed. The publication lead retains integration and release ownership.
