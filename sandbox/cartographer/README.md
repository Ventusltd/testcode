# CARTOGRAPHER: bounded estate reuse proof

This TestCode experiment connects existing estate interfaces to the prospecting
workstream without creating another active registry or changing a product.
The accompanying receipt pins **14 files in five public repositories**. The
offline verifier checks commit/path/blob/SHA256 identity, not source correctness,
API compatibility, execution, release acceptance, or complete estate coverage.
All five commit objects were also readable through GitHub on 16 November 2026.
They are inspected checkpoints, not a claim to be each owner's latest release.

## What can be reused

| Owner and inspected pin | Observed interface | Useful next connection | Boundary |
| --- | --- | --- | --- |
| [Spider b47609b9](https://github.com/Ventusltd/spiders/blob/b47609b9252f65f8ccf7ac6a2393619e374ecf30/species/genome-spider/spider.mjs) | Node IDs are repository plus relative path; edges carry type and evidence. The compiler emits genome JSON and federated node/edge/manifest products. Its separate child manifest represents the declared build plan. | Attach ARCHIVIST's deduplicated source identities and confirmed input/output closures to the existing observed graph. Keep proposed prospecting relationships in the declared plan. | A referenced stub is explicitly not content-scanned. An import or plan edge does not establish executed behavior. Existing output includes local-root metadata; do not publish it unchanged as a new receipt. |
| [CVAA 39e449ce](https://github.com/Ventusltd/cvaa/blob/39e449cee1c8543f9d9f3d1d995c9c286b127501/inoculate.mjs) | Locked antibodies receive a data context through a child process; runner startup failure, timeout, explicit skip and findings have separate paths. | Submit accepted provenance/identity regression cases as narrowly owned vaccines after reproducing the defect and proving the runner operates in the target environment. | Do not execute historical antibodies during archaeology. This inspection did not rerun CVAA or establish that its whole suite passes. A source identity check is not immunity. |
| [Cosmic 9f5250f2](https://github.com/Ventusltd/cosmic/blob/9f5250f285d7e126b6d698d61aedd86990214d30/universe.json) | The cartridge declares unit, observation time, total, hierarchy, child sources and placement laws. The inspected cartridge measures historical line occurrences. | A future source-coverage view could show read, held and unavailable portions of an inventory, using a separately measured cartridge. | Historical line occurrences, distinct blobs, owner-authored code and project evidence are different measures. The advertised billion-line scale was not recomputed here. Visual proximity cannot become a power connection. |
| [Kuiper 23740e4d](https://github.com/Ventusltd/kuiper-belt/blob/23740e4d050a4b94cb3dc113f280ed1db47aaa5e/tools/estate.py) | Estate output derives bodies and a digest from repository observations. It explicitly reports no destination probes and keeps every body dim when none ran. `tools/key.py` resolves an issued key to a committed blob/line and checks cached line counts. | Navigate from a project-research capability to its pinned owner, proof and real destination. Keep destination availability separate from ownership and content identity. | The key resolver may print source text and local clone failures; public reports need metadata-only redaction. An openable destination is not acceptance of its numeric outputs. |
| [Elements f7a92fb0](https://github.com/Ventusltd/elements/blob/f7a92fb085c38dcbbd5cb469a66cd5ca61fb95bf/catalogue/provenance.json) | Pinned register and numbered-data inputs underpin block, family, line and surface keys. The builder checks duplicate symbols/families and input counts. | Use existing block/family keys to identify reusable producer functions; retain Git blob/path identities alongside them. | Register relationships are declared data, not proven dependencies. The builder still fetches numbered inputs even with a local register argument; it is not an offline build merely because `--register` is used. |

The [Spider plugin boundary](https://github.com/Ventusltd/spiders/blob/b47609b9252f65f8ccf7ac6a2393619e374ecf30/codex/build-plan/PLUGIN-BOUNDARY.md)
is an architecture proposal, not a generic implemented registration API. Preserve
existing GridAtlas layer/configuration and cartridge ownership. Pure engine
calculation, UI rendering and source collection stay separate.

**SeeThrough remains unresolved.** A bounded repository lookup did not establish
that owner or a concrete input/output contract. This does not establish absence
from the estate. No invented dependency is included in the receipt.

## Next bounded product application

1. Keep operational evidence in SQLite and analytical Parquet in the accepted
   producer; do not relocate them into any visualization owner.
2. Give source-backed Solar/DC/Grid claims stable project identities, source
   locators and clocks. Link those claims to the owner module and its exact test
   receipt. A function-family ID describes code; it must not replace a REPD or
   independent DC project ID.
3. Extend the existing Spider observation graph only after the full
   workflow/script/import/input/environment/output closure is captured. This
   experiment and ARCHIVIST receipts are inputs for that owner review, not a
   migration or collector activation.
4. Show research relevance and missing source coverage in the consolidated
   Pipeline. Optional estate visualizations remain an investigation route, not
   another dashboard block or an engineering-confidence score.

These are proposed integrations. None is represented as an already deployed
cross-product API. Source authority, project identity confidence, research rank
and test status remain independent.

## Reproduce

Run the synthetic offline tests first:

```text
python -m unittest discover -s sandbox/cartographer -p test_verify_pins.py -v
```

Then run `verify_pins.py pins.json` from this directory, providing one mapping for
each owner with `--repo OWNER/REPOSITORY=LOCAL_CHECKOUT`. The receipt contains the
five required public owner names. A checkout must contain the pinned commit
objects; its current branch and dirty working files are not used. No network
fetch or inspected source execution occurs. Missing objects fail; they do not
count as covered. Mapping paths stay in the invocation and never enter output.

The verifier rejects empty/duplicate coverage, altered bytes, wrong blobs,
missing owners/objects, non-commit identities, unsafe paths and unknown pin
fields. It does not authenticate source authors or prove repository visibility;
the public GitHub check above was a separate bounded observation.

Observed local result: **10 tests pass; 14 pinned files across five repositories
pass identity checks; zero source files executed; runtime acceptance UNVERIFIED**.
The fixture lists source metadata only. No private source bodies, local paths,
production pointer, live navigation or frozen Pipeline files are included.

The earlier analytics and browser harness deliveries are independent of this
experiment. ARCHIVIST owns the history traversal and its explicit remaining
coverage; this proof does not imply that every file in those histories was read.
