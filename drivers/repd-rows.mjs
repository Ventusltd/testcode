/* repd-rows.mjs — every REPD row on every surface the estate publishes, and
 * the link it should have.
 *
 * "once test code tells you all 7000 + REPD rows pass" — the architect,
 * 2026-09-05.
 *
 * This is that gate. It runs the engine's own auditProjectRows over the WHOLE
 * published corpus of EVERY published surface — sixteen parts each, read from
 * the local clone — and checks each result against what that surface's own
 * release contract says it should be. Offline; no socket is opened.
 *
 * The query is not reimplemented here. It is imported from
 * ventus-grid-engine/deeplink/contract.js, the same function the receiver audit
 * and the workflow use, because an audit whose logic differs from the fix it
 * authorises is not a gate.
 *
 * WHAT IT USED TO AUDIT, AND WHY THAT WAS NOT AN ANSWER
 * ---------------------------------------------------------------------------
 * Until 2026-09-05 it chose ONE corpus with
 *
 *     readdirSync(pipelineDir).filter((n) => /^v9(\.\d+)*$/.test(n)).sort(rank).slice(-1)
 *
 * and printed `version v9.7`. The build cut that morning lives in
 * uk_renewables_pipeline/202609051156/ — it is the first pipeline link on the
 * homepage — and a timestamped directory matches no version pattern, so it was
 * invisible to this gate. So were v9, v9.4, v9.5, v9.5.1, v9.6, v9.6.1 and
 * v9.6.2, all of which the homepage publishes. The 10/10 was a true statement
 * about the control and said nothing whatever about any candidate, which is
 * the most expensive kind of green there is.
 *
 * So the surfaces come from lib/published-surfaces.mjs: what the homepage
 * actually links, rather than what a directory name looks like. A surface the
 * homepage publishes is audited. A surface that carries no corpus is named and
 * counted, never quietly skipped.
 *
 * What it is really checking is the thing that hid for weeks: a row can have an
 * identity, a coordinate and a MAP button, and still produce a link that lands
 * on a page carrying no engine. Counting rows is not enough — every link has to
 * be built against the canonical receiver, and the count of rows that cannot be
 * linked has to match what the corpus itself declares, so a silent loss shows
 * up as a number rather than as nothing.
 *
 * Run: node drivers/repd-rows.mjs
 *      node drivers/repd-rows.mjs --estate DIR   read a different estate root,
 *          so this gate can be shown going red on a controlled corpus.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { homepageSurfaces } from '../lib/published-surfaces.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const estateFlag = process.argv.indexOf('--estate');
const PARENT = estateFlag >= 0 && process.argv[estateFlag + 1]
    ? path.resolve(process.cwd(), process.argv[estateFlag + 1])
    : path.resolve(ROOT, '..');

const contractModule = path.join(PARENT, 'ventus-grid-engine', 'deeplink', 'contract.js');
if (!existsSync(contractModule)) {
    console.error(`ventus-grid-engine/deeplink/contract.js is not present under ${PARENT}.`);
    console.error('This driver audits with the engine\'s own query rather than a copy of it,');
    console.error('so without the engine it has checked nothing. That is a failure, not a pass.');
    process.exit(1);
}
const { auditProjectRows, CANONICAL_RECEIVER, isRetiredReceiver } =
    await import(pathToFileURL(contractModule).href);

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
/* A line that is always true is a measurement, not a check. Counted separately
   so "N/N checks passed" only ever counts lines that could have gone red. */
const notes = [];
const note = (name, detail) => notes.push({ name, detail });

/* ---- Which surfaces to audit, read from the page that publishes them ----- */
const pipelineDir = path.join(PARENT, 'globalgrid2050', 'uk_renewables_pipeline');
if (!existsSync(pipelineDir)) {
    console.error('No local globalgrid2050 clone: nothing to audit.');
    console.error('That is a failure, not a pass — a check that finds nothing to');
    console.error('check has not checked anything.');
    process.exit(1);
}
const published = homepageSurfaces(PARENT);
check('the surfaces to audit were read from the homepage the estate serves, not from a directory-name pattern',
    published.ok && published.pipelineDirs.length > 0,
    `${published.source}: ${published.pipelineDirs.join(', ') || 'no pipeline surfaces linked'}`);

const rank = (n) => n.replace(/^v/, '').split('.').map(Number)
    .reduce((a, p, i) => a + (p || 0) * [1e6, 1e3, 1][i], 0);

function partsDirOf(dir) {
    const data = path.join(dir, 'data');
    if (!existsSync(data)) return null;
    for (const gen of readdirSync(data).sort().reverse()) {
        const candidate = path.join(data, gen, 'projects');
        if (existsSync(candidate) && readdirSync(candidate).some((n) => /^part-\d+\.json$/.test(n))) {
            return candidate;
        }
    }
    return null;
}

const surfaces = published.pipelineDirs.map((name) => {
    const dir = path.join(pipelineDir, name);
    const partsDir = existsSync(dir) ? partsDirOf(dir) : null;
    return {
        name,
        dir,
        present: existsSync(dir),
        partsDir,
        parts: partsDir ? readdirSync(partsDir).filter((n) => /^part-\d+\.json$/.test(n)).sort() : []
    };
});

const missing = surfaces.filter((s) => !s.present);
check('every surface the homepage publishes is present in the local clone',
    missing.length === 0,
    missing.length ? `absent: ${missing.map((s) => s.name).join(', ')}` : `${surfaces.length} surface(s) present`);

const withCorpus = surfaces.filter((s) => s.present && s.parts.length > 0);
const withoutCorpus = surfaces.filter((s) => s.present && s.parts.length === 0);
check('at least one published surface carries a corpus, so this driver is auditing something',
    withCorpus.length > 0,
    `${withCorpus.length} of ${surfaces.length} published surface(s) carry a parts corpus`);
note('a published surface that carries no corpus is named rather than silently skipped',
    withoutCorpus.length ? `no corpus: ${withoutCorpus.map((s) => s.name).join(', ')}` : 'every published surface carries a corpus');

/* ---- What a surface itself says its corpus contains ----------------------
   A release contract does not always restate the corpus counts: v9.7 declares
   `data_parent: { release: 9.1, data_changed: false }` and inherits them. So
   walk the release contracts newest-first and take the first that actually
   DECLARES a geometry count, then say which one it was. Taking the
   alphabetically last file gave `undefined` and two failures that looked like
   a data fault and were a lookup fault — the difference matters, because one
   of those would have sent someone hunting through 7,680 rows. */
function declaredCounts(surfaceDir) {
    const contractsDir = path.join(surfaceDir, 'contracts');
    if (!existsSync(contractsDir)) return { declared: {}, declaredBy: null };
    const releaseFiles = readdirSync(contractsDir)
        .filter((n) => /^release\.v[\d.]+\.json$/.test(n))
        .sort((a, b) => rank(a.replace(/^release\.|\.json$/g, '')) - rank(b.replace(/^release\.|\.json$/g, '')))
        .reverse();
    let declared = {};
    let declaredBy = null;
    for (const name of releaseFiles) {
        const expected = (JSON.parse(readFileSync(path.join(contractsDir, name), 'utf8')).expected) || {};
        if (expected.valid_geometry_count !== undefined) return { declared: expected, declaredBy: name };
        if (!declaredBy && expected.project_count !== undefined) { declared = expected; declaredBy = name; }
    }
    return { declared, declaredBy };
}

/* ---- The audit, once per published surface -------------------------------- */
const audits = [];
for (const surface of withCorpus) {
    const rows = [];
    for (const name of surface.parts) {
        const parsed = JSON.parse(readFileSync(path.join(surface.partsDir, name), 'utf8'));
        const part = Array.isArray(parsed) ? parsed : (parsed.projects || parsed.rows || []);
        rows.push(...part);
    }
    const { declared, declaredBy } = declaredCounts(surface.dir);
    const audit = auditProjectRows(rows);
    const built = audit.entries.filter((e) => e.expected_href);
    const noGeometry = audit.entries.filter((e) => e.has_identity && !e.has_geometry);
    const at = surface.name;

    check(`${at}: the corpus was found and read from its parts`,
        rows.length > 0, `${surface.parts.length} parts, ${rows.length} rows`);
    check(`${at}: a release contract declaring the corpus counts was found`,
        Boolean(declaredBy) && declared.valid_geometry_count !== undefined,
        declaredBy || 'no release contract declares a geometry count');
    check(`${at}: the corpus is the size its own release contract declares`,
        rows.length === declared.project_count,
        `read ${rows.length}, declared ${declared.project_count}`);
    check(`${at}: every row carries an REPD identity`,
        audit.with_identity === rows.length, `${audit.with_identity} of ${rows.length}`);
    check(`${at}: the rows that cannot be linked are exactly the ones the contract declares`,
        audit.no_geometry === declared.missing_geometry_count,
        `no geometry ${audit.no_geometry}, declared missing ${declared.missing_geometry_count}`);
    check(`${at}: every linkable row matches the declared valid-geometry count`,
        audit.linkable === declared.valid_geometry_count,
        `linkable ${audit.linkable}, declared ${declared.valid_geometry_count}`);
    /* The point of the whole exercise: not that a link exists, but that it
       lands somewhere that can compute. */
    check(`${at}: every link is built against the canonical receiver`,
        built.length > 0 && built.every((e) => e.expected_href.startsWith(CANONICAL_RECEIVER)),
        `${built.length} links, all on ${CANONICAL_RECEIVER}`);
    check(`${at}: no link is built against a retired receiver`,
        built.length > 0 && built.every((e) => !isRetiredReceiver(e.expected_href)),
        'zero links to a page that carries no engine');
    check(`${at}: every link carries the REPD identity the arrival resolves on`,
        built.length > 0 && built.every((e) => /[?&]repd_ref=/.test(e.expected_href)),
        'repd_ref present on every link');
    /* A row with an identity but no geometry must be REPORTED, never given a
       link that silently goes to the map's default view — that is a MAP button
       that looks alive and answers a question about the wrong place. */
    check(`${at}: a row without geometry is given no link at all, rather than a wrong one`,
        noGeometry.every((e) => e.expected_href === null),
        `${noGeometry.length} rows correctly left without a link`);

    audits.push({
        surface: surface.name,
        parts_dir: path.relative(PARENT, surface.partsDir).replace(/\\/g, '/'),
        parts: surface.parts.length,
        rows: rows.length,
        declared_by: declaredBy,
        declared,
        with_identity: audit.with_identity,
        linkable: audit.linkable,
        no_geometry: audit.no_geometry,
        links_built: built.length,
        unlinkable_repd_refs: noGeometry.map((e) => e.repd_ref).slice(0, 40)
    });
}

const report = {
    schema: 'globalgrid2050.testcode.repd-rows.v2',
    generated_utc: new Date().toISOString(),
    estate_root: PARENT.replace(/\\/g, '/'),
    surfaces_source: published.source,
    published_surfaces: published.pipelineDirs,
    surfaces_without_a_corpus: withoutCorpus.map((s) => s.name),
    canonical_receiver: CANONICAL_RECEIVER,
    total_rows_audited: audits.reduce((a, s) => a + s.rows, 0),
    total_links_built: audits.reduce((a, s) => a + s.links_built, 0),
    audits
};
writeFileSync(path.join(process.cwd(), 'repd-rows.json'), JSON.stringify(report, null, 2) + '\n');

console.log(`surfaces published     ${published.pipelineDirs.join(', ') || 'none'} (from ${published.source})`);
console.log(`surfaces audited       ${withCorpus.map((s) => s.name).join(', ') || 'none'}`);
console.log(`surfaces with no corpus ${withoutCorpus.map((s) => s.name).join(', ') || 'none'}`);
console.log(`canonical receiver     ${CANONICAL_RECEIVER}\n`);
console.log('surface          parts   rows  identity  linkable  no-geom  links');
for (const a of audits) {
    console.log(`${a.surface.padEnd(16)}${String(a.parts).padStart(5)}${String(a.rows).padStart(7)}${String(a.with_identity).padStart(10)}${String(a.linkable).padStart(10)}${String(a.no_geometry).padStart(9)}${String(a.links_built).padStart(7)}`);
}
console.log(`\n${report.total_rows_audited} rows audited across ${audits.length} published surface(s)\n`);

let failed = 0;
for (const c of checks) {
    if (!c.ok) failed += 1;
    console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.detail ? '  -- ' + c.detail : ''}`);
}
console.log('');
for (const n of notes) console.log(`note  ${n.name}  -- ${n.detail}`);
console.log(`(a note is a measurement with no pass or fail, and is not counted below.)`);
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
if (failed) { console.error(`${failed} FAILED`); process.exit(1); }
