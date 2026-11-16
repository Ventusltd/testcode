# Estate Archivist: bounded historical source observations

This TestCode lab inventories Python and GitHub workflow blobs without executing
them. It supplements the canonical Spider graph; it is not a registry, scheduler,
dependency resolver or production collector. Ownership was acknowledged in
[Neural Link #42](https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-6923682016).

## Existing owners and precise boundary

Spiders owns the [build programme](https://github.com/Ventusltd/spiders/tree/b47609b9252f65f8ccf7ac6a2393619e374ecf30/codex/build-plan)
and `estate-audit.py`: bounded API-visible repository snapshots, source reference
extraction, recent commit metadata and CI receipts. Its plan separates planned
relationships from observed dependencies. This lab adds local all-ref historical
tree traversal, resumable cursors and content deduplication. It does not replace
that audit, write graph edges or claim a source reference is a runtime dependency.

Elements' [catalogue builder](https://github.com/Ventusltd/elements/blob/f7a92fb085c38dcbbd5cb469a66cd5ca61fb95bf/build/build_catalogue.py)
uses existing `block:`, `family:`, `line:` and `surface:` identities. Its inputs
are the Stars block register and a pinned TestCode numbered-data pack. The
catalogue's own [checks](https://github.com/Ventusltd/elements/blob/f7a92fb085c38dcbbd5cb469a66cd5ca61fb95bf/tests/check_catalogue.py)
compare reconstructed rows and acknowledge unresolved register references; this
archaeology does not execute those checks or certify their advertised coverage.
Preserve these existing identities in any future CARTOGRAPHER mapping.

## Run and resume

Requires Python 3.10+ and Git supporting `rev-list --missing=print`.
No third-party Python packages. Substitute local locations only at invocation:

```text
python tools/estate_archivist.py --repo <checkout> --public-repo Ventusltd/elements --checkpoint <private-directory>/elements.json --out <report-directory>/elements.json --max-commits 20 --max-blobs 20 --max-bytes 131072
python -m unittest discover -s tests -p test_estate_archivist.py -v
```

Repeat the same command to resume. The checkpoint freezes reachable commits and
the public-tip evidence at scan start; later ref changes need a new checkpoint.
Only use checkpoints produced locally by this tool, never downloaded or edited
ones. They contain private local-history identifiers and must not be published.
The CLI rejects checkpoints inside a Git checkout and rejects a checkpoint that
would overwrite the public report. Report outputs contain no source bodies,
commit subjects, authors, local branch names, remotes or workstation locations.

The first invocation makes an unauthenticated GitHub repository request, rejects
private/unavailable repositories, and observes advertised public heads/tags using
an explicit GitHub HTTPS URL with credential helpers and global URL rewrites
disabled. It performs no fetch into the inspected checkout. Public tips missing
locally are counted, not silently substituted with an unproven local branch.
Local commits whose public reachability cannot be established are counted but
their trees and blobs are not read or exported. This category can include older
public history when a newer advertised tip is unavailable locally; it does not
mean those commits were proved private.

Metadata enumeration freezes `rev-list --all HEAD`; each step visits at most
`max-commits` trees and reads at most `max-blobs` unique selected bodies, each at
most `max-bytes`. Ref/commit enumeration and one recursive tree listing are
metadata operations, not byte-bounded streaming; every Git subprocess has a
60-second timeout. This is suitable for bounded owner checkouts, not an assertion
that arbitrary enormous Git repositories have bounded metadata memory use.

Bodies are deduplicated by Git blob ID before reading. Reports retain byte size,
SHA256, line count and Python AST count/status only; the AST is never evaluated.
Oversize/unavailable blobs are terminal exclusions for that scan; use a new scan
after deliberate budget or object-availability changes. The tool disables Git
replacements, grafts and lazy object fetching and never invokes checkout, diff
drivers, text conversion, hooks or inspected scripts.

For every public path/blob observation, the report preserves a source commit
and GitHub URL. A historic path absent at the current public head is marked
explicitly. The same blob at multiple paths indicates a rename/copy candidate,
not proven lineage. A changed file retains its older and newer blobs separately.
If the public-head tree is unavailable, current/absent fields are null.

Symlinks, submodules, untracked changes, unsafe path spellings, non-Python/non-
workflow paths and named vendor/cache directories are excluded. Reflog-only and
unreachable Git objects are outside the frozen reachable universe. A shallow
repository cannot claim complete history. Missing objects stop initialization
or become explicit unavailable observations; no promise of recoverability.

## First bounded owner pass, 16 November 2026

The accompanying [machine-readable receipt](evidence/estate-archivist-20261116.json)
contains public source pins and observations, without the private checkpoints.

| Public owner | Local reachable commits | Processed | Unique bodies read | Public reachability unproven among processed | Selected source coverage complete |
| --- | ---: | ---: | ---: | ---: | --- |
| Elements | 7 | 7 | 8 | 0 | yes |
| Cosmic | 12 | 12 | 0 | 12 | no |
| CVAA | 65 | 20 | 3 | 11 | no |
| Spiders | 333 | 20 | 25 | 9 | no |
| Kuiper-belt | 151 | 20 | 0 | 20 | no |

In total, 79 of 568 frozen reachable commits were processed and 36 distinct
selected bodies read. Cosmic's traversal is complete but its source coverage
is not: neither advertised public tip was available locally. CVAA and Spiders
each also had two unavailable public tips; Kuiper-belt had six. No blob read
failed and no selected blob exceeded the 128 KiB budget in this pass. The
receipt distinguishes traversal completion from selected-source completion.
Only Elements completed both. No claim of all-estate coverage or execution.

Spiders' sampled paths include the canonical estate audit, genome workflow,
Elements-topology workflow, reload/plan-tracker and printer-topology code.
CVAA's sampled workflows include inoculation, selftest and vaccine build.
Those source paths are discovery leads for CARTOGRAPHER, not evidence their
workflows ran or their dependencies were accepted. Cosmic/Kuiper source-purpose
claims require a separately pinned owner read; this receipt supplies none.

## Adversarial checks

Synthetic Git histories test deleted paths, rename/copy deduplication, durable
resume, old/new content versions, source code that would create a sentinel if
executed, private branch/path/body suppression, missing blobs/tips, oversize
bodies, unsafe paths, syntax errors and unavailable public heads. These tests
exercise the lab only; they do not certify the inspected estate code.
