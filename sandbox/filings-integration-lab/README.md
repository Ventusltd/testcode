# Pinned filings consumer lab

This TestCode sandbox composes the successor WEST, ASIA and FIGURES interfaces
without changing their owning repository or enabling a collector. The examples
are explicitly synthetic. They prove consumer behavior, not real issuer data,
financial facts, source rights or production readiness.

`inputs.json` pins three GlobalGrid2050 commits and every runtime module/registry
SHA256. No producer source is copied into this repository. The loader refuses
missing, modified or escaping inputs before importing a component. A new
upstream version requires a deliberate pin update and rerun.

## Run locally, offline first

From the TestCode root, materialize exact blobs from an existing local
GlobalGrid2050 Git clone that contains the three commits:

```text
python -B sandbox/filings-integration-lab/prepare_inputs.py --source-repo /path/to/globalgrid2050 --output /new/path/to/filings-inputs
python -B sandbox/filings-integration-lab/run.py --inputs /new/path/to/filings-inputs --output /path/to/filings-integration.json
```

Preparation uses local `git show` only, disables lazy fetching, replacement
objects and grafts, forbids Git transport protocols, and refuses to overwrite an
existing directory. Local Git regression fixtures demonstrate that an unguarded
promisor read hydrates a missing blob from a file URL while preparation refuses
it without a fetch child or output. The execution phase denies Python socket audit events, validates
input hashes and runs stdlib unittest consumer scenarios. Missing inputs, zero
tests, failures, unexpected successes, expected failures or skips fail the gate.
The JSON receipt names source commits/hashes and outcomes, without workstation
paths or source bodies. Use the runner rather than direct unittest discovery:
one check deliberately proves the runner's offline restriction is active.

CI provisions three exact public source checkouts, then invokes this same
offline runner. Provisioning uses the network; it is not described as offline.
The local gate must pass before the workflow is submitted. There are no live
source probes or publication steps, and no secrets or package installation.
The workflow retains its receipt even on failure.

## What the lab exercises

- WEST submissions metadata: explicit issuer scope, source payload versus filing
  document identity, unknown dates, corporate-only forms and amendment semantics.
- ASIA disclosure intake: namespaced issuer IDs, source bytes and clocks,
  preserved revisions, and quarantine even when an optional figure is valid.
- FIGURES wire contract: exact decimal lexemes, source units/currencies and
  periods, separate finance stages and physical quantities, forecast and
  restatement distinctions without conversion or aggregation.
- Closure failures: absent input, a one-byte mutation and attempted sockets.

## Experimental binding step

`binding.bind_claim(metadata, claim, document_bytes=..., document_receipt=...,
source_kind='west'|'asia', filing_id=...)` adds an explicit issuer/document
consistency gate in this sandbox. WEST requires a selected filing and a separate
document receipt; its submissions payload is not the filing document. ASIA uses
its canonical namespaced record ID and original receipt. Both require the exact
issuer, document URL/ID, supplied byte hash and equivalent retrieval instant.
Only issuer-scoped claims are supported, without inferred group/project links.

The resulting binding remains provisional and unpublished. It cannot establish
receipt authenticity, the truth of a number, source rights or what the document
actually says. Tests deliberately show that a structurally valid but unsupported
number still needs semantic review. This is a candidate consumer interface for
owner review, not a promoted production API or independent verification.

Known interface limits are executable: ASIA accepts NSE `nse:M&M`, while FIGURES
v1 rejects the ampersand; the lab does not silently rewrite that identity. FIGURES
calendar checks require an evidenced source offset at midnight boundaries; the
ASIA fixture demonstrates a same-instant offset conversion without changing the
source date. Passing these characterization tests means the limit is recorded,
not that every market/identifier is supported. Unknown rights keep intake
unpublished even when the identity/byte checks pass.

No V9.24/V9.25 source, REPD/Solar-1000 data, homepage, main gate registry,
collector or release pointer changes. Command chooses successor integration.
Hosted CI is separate evidence from local results; neither is a browser test or
an Android-device claim.
