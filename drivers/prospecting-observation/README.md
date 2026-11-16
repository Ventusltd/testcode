# Article observation through the producer and consumer

This offline Testcode driver composes the real transactional evidence store,
prospecting generator and JavaScript UI adapter from exact committed inputs.
It verifies that checking a source without seeing an old article again cannot
refresh that article or award research follow-up points. Seeing the article
again must update observation freshness while preserving its publication and
first-observed clocks.

Run with Python 3.12, Node and Git already installed:

```sh
python drivers/prospecting-observation/driver.py --product-repo /path/to/globalgrid2050 --prove-negative-control
```

The input commits in `pins.json` must already exist in that repository's object
database. The driver does not fetch, install, read uncommitted product files,
modify the source repository, or publish anything. Missing objects fail. It
extracts a bounded committed dependency closure into disposable directories;
public receipts contain repository/commit/blob/archive identities, never local
input paths. `--producer` and `--consumer` accept full commit IDs for subsequent
compositions. `--out` writes a new receipt and refuses to overwrite one.
Git reads disable promisor lazy fetching, replacement objects, graft files and
transport protocols. A partial clone with missing objects must fail locally;
it cannot silently repair itself over a network or substitute another tree.

The negative control uses the actual earlier producer revision with the faulty
source-level retrieval clock. It must fail the stale-article case while still
passing genuine re-observation. Configuration failures and empty coverage do
not satisfy this requirement. The repaired producer must pass both cases
through the real UI adapter. A standalone run against the earlier producer
exits nonzero; the combined control demonstration succeeds only when that
specific failure is detected and the repaired composition passes.

In this pinned profile, the highest static-priority frozen seed, REPD-2203,
scores 48.5 against a top-1000 cutoff of 48.81. A real recent observation adds
five points and brings it into the returned subset. The stale case must remain
outside that subset. The proof checks its backend observation projection and
then the actual returned membership through the UI adapter; it never fabricates
a single-row output or claims that an absent row was displayed. Exclusion from
the ranked subset does not mean inactivity or removal from the official data.

The 7,775 official records and exact ordered Solar-1000 come from the pinned
immutable V9.24 input; their existing producer validation executes. All article,
publisher and rights/access inputs are **synthetic test fixtures**. No publisher
rights, live news coverage, project verification or actual event is asserted.
The ranked 1,000 is a distinct output, not a replacement Solar-1000 selection.

This checks the JavaScript consumer model, not DOM rendering, installed Chrome
or Android. It does not test the separate NEWS ordering algorithm, corporate
enrichment, a deployed dashboard or a production release. It is deliberately
outside the general `engines.json` estate gate until its owner accepts the
input closure and public availability of all pinned producer revisions.

## Measured checkpoint

[The retained receipt](receipt-20261116-final.json) records Python 3.12.10,
Node 24.19.0, proof-file digests and exact source identities. The repaired
composition passed 36 checks. The earlier producer failed eight observation,
score and returned-membership checks while its genuine re-observation case
passed. This is the intended negative control, not a suppressed failure.
Separate invocations confirmed that the old producer, a missing Git object and
an existing receipt destination each exit nonzero; an existing receipt remains
unchanged.

The consumer's 15 tests use the actual adapter and fixture helpers from a clean
archive of its pinned commit. Set `TESTCODE_PROSPECTING_UI_DIR` to that archive's
`automation/news/prospecting-ui` directory, then run:

```sh
node --test drivers/prospecting-observation/consumer.test.mjs
```

Five local-Git regressions exercise a real file-only promisor clone, replacement
references, repository/environment grafts, missing objects and dirty working
files. The old driver exhibited seven failing observations; the hardened driver
passes. The unguarded fixture really fetches from a temporary local repository,
then a separate cold clone proves that the guarded read neither fetches nor
emits output. These tests never contact an external service:

```sh
python -B -m unittest discover -s drivers/prospecting-observation -p test_git_inputs.py -v
```

The isolated producer and UI input refs are published under `testcode-inputs/`
in the product repository for exact-SHA replay. This publishes source for the
proof; it does not integrate a product release. The dedicated workflow
provisions those public objects, runs the offline checks and saves only its
sanitized receipt. It never publishes a product or uploads the source archives.
