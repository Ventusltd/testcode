# Test Code comparison builds

202609051152 is a UTC build identifier, allocated before assembly. Exact assembly and verification times are in release.json and evidence/browser-results.json.

Published at https://www.globalgrid2050.com/testcode/202609051152/ . Source artifacts are here; deployment copies them byte-for-byte into globalgrid2050/testcode. Product source hashes and parent commits are in release.json. This comparison does not replace production versions.

Pipeline uses the committed 313f5623 baseline and adds pagination, mobile project cards and paired MAP links. Atlas reassembles the changed menu cartridge on the existing immutable shell. Source inputs included the stopped agent's uncommitted menu fixes, identified by hash, plus the changes in tools/build.py and tools/print-view.js.

Run browser tests with Node and Playwright installed; set PLAYWRIGHT_MODULE to its module path if needed, TEST_BASE to the candidate URL and TEST_GENERATION to the timestamp. Run `node sandbox/tools/browser-proof.cjs` from the repository root. It launches installed Google Chrome. Device emulation is not real Android or iOS.

Published product bytes must remain immutable. A code iteration gets a new UTC timestamp. Live verification receipts may be appended separately.
