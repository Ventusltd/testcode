# Agent 3 Release Integrity v1 — 14 November 2026

**QA-only, not a production release or acceptance.**

## Architecture

The existing TestCode order is preserved: offline negative fixtures, then pinned source verification, then independently witnessed rights, browser, served-byte and rollback gates. No publishing mechanism is included. This draft does not edit run.mjs, engines.json, Agent 1 TestCode PR #9, or any release directory.

The new driver is drivers/agent3-release-integrity-v1.mjs. It checks original DESNZ CSV/XLSX SHA256 and file sizes, parses the raw CSV and counts source refs, rejects non-identical or undeclared duplicate IDs, and uses the immutable Git **tree hashes** for three published Pipeline News directories. It independently reads the operative ID from the existing versions.json. It returns an explicit nine-gate acceptance matrix and always sets release_authorised to false. A green unit test is therefore not a release token.

The new workflow is .github/workflows/agent3-release-integrity-v1.yml. It executes 26 no-network good/bad fixtures before checking out a fixed source-evidence Git commit. It compares independently specified SHA256, records the exact current publication checkout SHA, and fails on release tree or pointer drift. Output artifacts are mandatory, never warning-only. No content:write permission, token-dependent fetcher or writer exists. Because current main is intentionally checked for drift, the CI receipt pins the exact observed HEAD, rather than claiming a future rerun would have tested the same moving branch.

## Pinned evidence

| Item | Expected immutable evidence |
| --- | --- |
| Official October Q3 CSV | 48e76c49f33a1090e78108d1ea9bfe689b35963ea3be1bb4f6516d038a5ff862 (5,219,160 bytes) |
| Official October Q3 XLSX | 87811e249395a05b223db6855952334f425e66cc9a2106caea0e38fd9e5037ea (5,378,656 bytes) |
| Evidence checkout | globalgrid2050 commit 213d1a79e876d80775f1be50caec94a8c449e09b |
| Source structure | 14,968 raw CSV rows, 14,967 unique Ref IDs, 53 columns, exactly one identical Ref 7679 duplicate |
| September 202609082224 | Tree 6247a0c3c00e8e88324d9ea55b22d67dbbb1be90 |
| October 202611132345 | Tree 0c7a4ed5ea369e4a4e71a45cfa6fe9c186fae773 |
| Operative V9.20 202611140306 | Tree 365d7df093368c39c3878daacf65449ba32e7267 |
| Tree reference commit | globalgrid2050 9092ff8a8fcd4c83191d00bc928377412ad05f42 |

The Ref15915 discrepancy and the official CSV's 25 month-first date cells remain individually documented exceptions requiring source reconciliation. This test grants no global waiver. XLSX is SHA-tested, but cell-by-cell workbook/date equivalence remains an independent open gate. Public V9.20 has 7,775 filtered records and must not be confused with the 14,967 distinct official raw references.

## Highest-risk reproducible failure modes

| Risk | Evidence and fixture | Correct response |
| --- | --- | --- |
| P0: a structural TestCode news report is mistaken for release approval | PR #9 can report structural PASS while publisher rights and independently verified per-link fetching are explicitly unproven | Fail-closed release matrix: absent independent rights/browser/served/rollback are UNVERIFIED, never PASS |
| P0: SHA values are recorded but not independently anchored | PR #9 reports input hashes of pinned Git commits but does not assert independent expected SHA256; a changed source with identical row count produces another digest | Independent, immutable CSV/XLSX hashes are mandatory; byte change FAIL even with valid-looking counts |
| P0: green workflow does not mean reproducible full-stack release verification | General TestCode workflow checks out changing main branches, permits missing report artifacts with warning, and does not prove browser/MAP/CSV/live-byte/rollback | Pin source commits, record observed current HEAD, fail missing artifacts, keep offline PASS separate from approval |
| P0: upstream acid and licensing blockers | GlobalGrid #100 at 20c9f213 has 20 failing acid tests; #102 12 structural tests do not clear 258 unverified DC sources | HOLD producer merge, public pointer and data publication |
| P1: historical release mutated | Any mismatch in the three Git tree hashes or operative pointer | FAIL, preserve previous edition and create additive new version |
| P1: valid HTTP but broken CSV/MAP | Downloaded CSV wrong unique Ref count, or MAP receiver lacks engine/Ref identity | FAIL even if link returns HTTP 200 |
| P1: non-restorable release | Previous V9.20 pointer, tree, or isolated rollback receipt missing | UNVERIFIED until byte-exact non-destructive rehearsal |
| P1: skipped or warning-only CI | Missing required job, xfail downgrade, continue-on-error, or absent report | FAIL or UNVERIFIED, never PASS |

These are code-grounded risks and fixture targets, not assertions that every live browser failure has been reproduced.

## Release acceptance status contract

Every required gate needs a completed independent receipt SHA256, a tested commit SHA, named independent reviewer and exact measured output. Missing proof is UNVERIFIED, a proved defect is FAIL. A fully green set becomes READY_FOR_INDEPENDENT_REVIEW, never automatic approval.

| Required gate | To pass |
| --- | --- |
| source_provenance | Independently pinned CSV/XLSX SHA256 and exact REPD identity |
| publisher_rights | Independent licence and database-use classification; zero unverified source rights |
| integrated_ci | All required named jobs completed successfully on exact SHA, no skipped/xfail/warning-only promotion |
| browser_1440 | Real 1440px page operation, project count and 0 JavaScript errors |
| browser_390 | Real 390px page operation, all table columns accessible and 0 JavaScript errors |
| csv_export | Actual clicked download with 7,775 rows and 7,775 distinct canonical Ref IDs |
| map_click | Actual GridAtlas receiver responds to MAP click with correct Ref ID and functioning engine |
| public_served_bytes | HTTP 200 and SHA256 of actual publicly served bytes equals independent expected deployment digest |
| rollback | Non-destructive rehearsal restores previous V9.20 pointer and full tree without deleting past versions |

### Reproduction

First run: node --test examples/test_agent3_release_integrity_v1.mjs

Then use the read-only driver with flags --source-csv FILE, --source-xlsx FILE, --release-repo DIRECTORY, --versions FILE, optionally --out receipt.json. The GitHub workflow provides the exact Q3 source checkout and current GlobalGrid checkout. An offline successful exit with publication_status HOLD is intentional; do not re-label it as full acceptance.

## Follow-up implementation design (not yet executed)

An independently reviewed separate browser candidate should run Playwright at 1440 and 390 CSS pixels, capture console errors and screenshots, actually click CSV and MAP controls, parse downloaded CSV, verify REPD identity and GridAtlas receiver, and download/public-hash the public runtime and data after deployment. Keep each source and deployment commit pinned. Rollback should be rehearsed as a new dry-run branch using the previous pointer, full Git tree hash and an original homepage snapshot; no actual homepage replacement solely for a test.

## Coordination and conditions

Agent A coordinates release, Agent 1 exclusively owns GlobalGrid #99 and TestCode #9, Agent 2 independently reviews, Agent 3 owns this new isolated QA candidate, Agent 4 owns editorial relevance. No producer branch, frozen releases, live data branches or pointers were edited. This proposal is not registered as a mandatory gate until its own fixtures, hosted CI, and independent adversarial review are complete. Claude's availability is not a dependency.

Source: neural-link issue #24 and #22; TestCode run.mjs and engines.json; GlobalGrid release and official REPD files. The GitHub issue mailbox is asynchronous; comments do not wake another agent.
