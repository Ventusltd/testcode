/* repd-rows.mjs — every REPD row in the corpus, and the link it should have.
 *
 * "once test code tells you all 7000 + REPD rows pass" — the architect,
 * 2026-09-05.
 *
 * This is that gate. It runs the engine's own auditProjectRows over the WHOLE
 * published corpus — all 7,680 records, read from the sixteen parts of the
 * newest published version — and checks the result against what that version's
 * own release contract says it should be. Offline; no socket is opened.
 *
 * The query is not reimplemented here. It is imported from
 * ventus-grid-engine/deeplink/contract.js, the same function the receiver audit
 * and the workflow use, because an audit whose logic differs from the fix it
 * authorises is not a gate.
 *
 * What it is really checking is the thing that hid for weeks: a row can have an
 * identity, a coordinate and a MAP button, and still produce a link that lands
 * on a page carrying no engine. Counting rows is not enough — every link has to
 * be built against the canonical receiver, and the count of rows that cannot be
 * linked has to match what the corpus itself declares, so a silent loss shows
 * up as a number rather than as nothing.
 *
 * Run: node drivers/repd-rows.mjs
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditProjectRows, CANONICAL_RECEIVER, isRetiredReceiver }
    from '../../ventus-grid-engine/deeplink/contract.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = path.resolve(ROOT, '..');
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

/* ---- The newest published version, read rather than named ---------------- */
const pipelineDir = path.join(PARENT, 'globalgrid2050', 'uk_renewables_pipeline');
if (!existsSync(pipelineDir)) {
    console.error('No local globalgrid2050 clone: nothing to audit.');
    console.error('That is a failure, not a pass — a check that finds nothing to');
    console.error('check has not checked anything.');
    process.exit(1);
}
const rank = (n) => n.replace(/^v/, '').split('.').map(Number)
    .reduce((a, p, i) => a + (p || 0) * [1e6, 1e3, 1][i], 0);
const version = readdirSync(pipelineDir)
    .filter((n) => /^v9(\.\d+)*$/.test(n))
    .sort((a, b) => rank(a) - rank(b))
    .slice(-1)[0];

/* ---- The corpus, from its parts ------------------------------------------ */
const partsDir = path.join(pipelineDir, version, 'data', 'v9.1', 'projects');
const partFiles = existsSync(partsDir)
    ? readdirSync(partsDir).filter((n) => /^part-\d+\.json$/.test(n)).sort()
    : [];

const rows = [];
for (const name of partFiles) {
    const parsed = JSON.parse(readFileSync(path.join(partsDir, name), 'utf8'));
    const part = Array.isArray(parsed) ? parsed : (parsed.projects || parsed.rows || []);
    rows.push(...part);
}

check('the corpus was found and read from its parts',
    rows.length > 0, `${version}: ${partFiles.length} parts, ${rows.length} rows`);

/* ---- What the version itself says the corpus contains -------------------- */
/* A release contract does not always restate the corpus counts: v9.7 declares
   `data_parent: { release: 9.1, data_changed: false }` and inherits them. So
   walk the release contracts newest-first and take the first that actually
   DECLARES a geometry count, then say which one it was. Taking the
   alphabetically last file gave `undefined` and two failures that looked like
   a data fault and were a lookup fault — the difference matters, because one
   of those would have sent someone hunting through 7,680 rows. */
const contractsDir = path.join(pipelineDir, version, 'contracts');
const releaseFiles = readdirSync(contractsDir)
    .filter((n) => /^release\.v[\d.]+\.json$/.test(n))
    .sort((a, b) => rank(a.replace(/^release\.|\.json$/g, '')) - rank(b.replace(/^release\.|\.json$/g, '')))
    .reverse();

let declared = {};
let declaredBy = null;
for (const name of releaseFiles) {
    const expected = (JSON.parse(readFileSync(path.join(contractsDir, name), 'utf8')).expected) || {};
    if (expected.valid_geometry_count !== undefined) { declared = expected; declaredBy = name; break; }
    if (!declaredBy && expected.project_count !== undefined) { declared = expected; declaredBy = name; }
}

check('a release contract declaring the corpus counts was found',
    Boolean(declaredBy) && declared.valid_geometry_count !== undefined,
    declaredBy || 'none of the release contracts declares a geometry count');

check('the corpus is the size its own release contract declares',
    rows.length === declared.project_count,
    `read ${rows.length}, declared ${declared.project_count}`);

/* ---- The audit ----------------------------------------------------------- */
const audit = auditProjectRows(rows);

check('every row carries an REPD identity',
    audit.with_identity === rows.length,
    `${audit.with_identity} of ${rows.length}`);

check('the rows that cannot be linked are exactly the ones the contract declares',
    audit.no_geometry === declared.missing_geometry_count,
    `no geometry: ${audit.no_geometry}, declared missing: ${declared.missing_geometry_count}`);

check('every linkable row matches the declared valid-geometry count',
    audit.linkable === declared.valid_geometry_count,
    `linkable ${audit.linkable}, declared ${declared.valid_geometry_count}`);

/* The point of the whole exercise: not that a link exists, but that it lands
   somewhere that can compute. */
const built = audit.entries.filter((e) => e.expected_href);
check('every link is built against the canonical receiver',
    built.length > 0 && built.every((e) => e.expected_href.startsWith(CANONICAL_RECEIVER)),
    `${built.length} links, all on ${CANONICAL_RECEIVER}`);
check('no link is built against a retired receiver',
    built.every((e) => !isRetiredReceiver(e.expected_href)),
    'zero links to a page that carries no engine');
check('every link carries the REPD identity the arrival resolves on',
    built.every((e) => /[?&]repd_ref=/.test(e.expected_href)),
    'repd_ref present on every link');

/* A row with an identity but no geometry must be REPORTED, never given a
   link that silently goes to the map's default view — that is a MAP button
   that looks alive and answers a question about the wrong place. */
const noGeometry = audit.entries.filter((e) => e.has_identity && !e.has_geometry);
check('a row without geometry is given no link at all, rather than a wrong one',
    noGeometry.every((e) => e.expected_href === null),
    `${noGeometry.length} rows correctly left without a link`);

const report = {
    schema: 'globalgrid2050.testcode.repd-rows.v1',
    generated_utc: new Date().toISOString(),
    version,
    declared_by: declaredBy,
    parts: partFiles.length,
    rows: rows.length,
    declared,
    canonical_receiver: CANONICAL_RECEIVER,
    with_identity: audit.with_identity,
    linkable: audit.linkable,
    no_geometry: audit.no_geometry,
    unlinkable_repd_refs: noGeometry.map((e) => e.repd_ref).slice(0, 40)
};
writeFileSync(path.join(process.cwd(), 'repd-rows.json'), JSON.stringify(report, null, 2) + '\n');

console.log(`version                ${version}`);
console.log(`parts                  ${partFiles.length}`);
console.log(`rows                   ${rows.length}`);
console.log(`with an REPD identity  ${audit.with_identity}`);
console.log(`linkable               ${audit.linkable}`);
console.log(`no geometry            ${audit.no_geometry}`);
console.log(`canonical receiver     ${CANONICAL_RECEIVER}\n`);

let failed = 0;
for (const c of checks) {
    if (!c.ok) failed += 1;
    console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.detail ? '  -- ' + c.detail : ''}`);
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
if (failed) { console.error(`${failed} FAILED`); process.exit(1); }
