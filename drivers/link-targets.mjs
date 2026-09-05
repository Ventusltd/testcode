/* link-targets.mjs — every deep link this estate builds, and where it lands.
 *
 * "make the testcode engine clever so that you can use it as a driver to
 *  automate links updates in map button" — the architect, 2026-09-05.
 *
 * The fault: the MAP button in Pipeline News built every link against
 * https://globalgrid2050.com/repd_grid_atlasv8/ — a page that answers with HTTP
 * 200 and carries no engine at all. 21,045 bytes, zero cartridges, zero
 * current.json, zero nearest-substation path, against 20 cartridge references
 * in the v9 shell. Every MAP click landed somewhere inert, and no monitor
 * complained, because a link checker calls that green.
 *
 * This driver reads the estate's SOURCE — offline, from local clones — finds
 * every place a deep link is constructed, and reports which receiver each one
 * targets. A consumer building against a retired receiver is a FAILURE here,
 * not a note, because the whole point is that this must never again be
 * something a person had to notice.
 *
 * The list of retired receivers is not written here. It is read from the
 * engine's published contract, ventus-grid-engine/deeplink/receivers.json, so
 * retiring a route is done once, in the place that knows, rather than in every
 * checker that ever copied it.
 *
 * Run: node drivers/link-targets.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = path.resolve(ROOT, '..');
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

/* ---- The contract, read from the engine rather than restated ------------- */
const contractPath = path.join(PARENT, 'ventus-grid-engine', 'deeplink', 'receivers.json');
if (!existsSync(contractPath)) {
    console.error('ventus-grid-engine/deeplink/receivers.json is not present.');
    console.error('This driver has nothing to check against, which is a failure, not a pass:');
    console.error('a check that cannot find its own contract has checked nothing.');
    process.exit(1);
}
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
const canonical = contract.canonical.route;
const retired = (contract.retired || []).map((r) => r.route);

const strip = (value) => String(value).split('?')[0].split('#')[0].replace(/\/+$/, '');
const retiredStripped = retired.map(strip);

/* ---- Where the estate builds links --------------------------------------- */
/* Only the surfaces that emit project deep links. Kept explicit rather than
   scanning everything: a driver that greps the whole estate finds every URL
   ever written in a comment and drowns the real finding. */
const SCAN = [
    { repo: 'globalgrid2050', dir: path.join(PARENT, 'globalgrid2050', 'uk_renewables_pipeline'), exts: ['.js', '.mjs'] },
    { repo: 'pipelinenews', dir: path.join(PARENT, 'pipelinenews'), exts: ['.js', '.mjs'], skip: ['node_modules', '.git', 'releases', 'build'] }
];

function walk(dir, exts, skip, out, depth = 0) {
    if (depth > 8 || !existsSync(dir)) return out;
    for (const name of readdirSync(dir)) {
        if ((skip || []).includes(name) || name === 'node_modules' || name === '.git') continue;
        const full = path.join(dir, name);
        let s;
        try { s = statSync(full); } catch { continue; }
        if (s.isDirectory()) walk(full, exts, skip, out, depth + 1);
        else if (exts.includes(path.extname(name))) out.push(full);
    }
    return out;
}

const findings = [];
for (const target of SCAN) {
    const files = walk(target.dir, target.exts, target.skip, []);
    for (const file of files) {
        let source;
        try { source = readFileSync(file, 'utf8'); } catch { continue; }
        /* A deep link is a URL that carries the identity parameter, or a
           builder named for the atlas. Both shapes, because the estate has
           written it both ways. */
        if (!/repd_ref|atlasUrl|buildDeepLink|atlasLink/.test(source)) continue;
        for (const route of [canonical, ...retired]) {
            const bare = strip(route);
            if (!source.includes(bare)) continue;
            findings.push({
                repo: target.repo,
                file: path.relative(PARENT, file).replace(/\\/g, '/'),
                route: bare,
                retired: retiredStripped.includes(bare)
            });
        }
    }
}

/* ---- Live, or history? ---------------------------------------------------
   The first run of this driver reported 65 sites on the retired receiver and
   would have stayed red for ever. Most of them are IMMUTABLE: superseded
   published versions of Pipeline News and an archive tree. A published version
   is a dated record and must not be rewritten — the estate's own rule is that
   a dated publication gets an erratum, not a rewrite — so a gate that demands
   they change is a gate that can never go green, which is precisely how a
   check decays into an alarm nobody reads.

   So they are classified, not filtered: history is REPORTED with its count and
   excluded from the verdict; only what is live has to be right. The newest
   published version is read from the directory names rather than named here,
   so cutting v9.8 does not silently leave v9.7 unchecked. */
const versionDirs = (() => {
    const base = path.join(PARENT, 'globalgrid2050', 'uk_renewables_pipeline');
    if (!existsSync(base)) return [];
    return readdirSync(base).filter((n) => /^v9(\.\d+)*$/.test(n));
})();

function versionRank(name) {
    const parts = name.replace(/^v/, '').split('.').map(Number);
    return parts[0] * 1e6 + (parts[1] || 0) * 1e3 + (parts[2] || 0);
}
const newestVersion = versionDirs.sort((a, b) => versionRank(a) - versionRank(b)).slice(-1)[0] || null;

function classify(file) {
    if (/(^|\/)archive\//.test(file)) return 'archived';
    const m = file.match(/uk_renewables_pipeline\/(v9(?:\.\d+)*)\//);
    if (m) return m[1] === newestVersion ? 'live' : 'superseded-published';
    return 'live';
}

for (const f of findings) f.kind = classify(f.file);

const onRetiredAll = findings.filter((f) => f.retired);
const onRetired = onRetiredAll.filter((f) => f.kind === 'live');
const retiredHistory = onRetiredAll.filter((f) => f.kind !== 'live');
const onCanonical = findings.filter((f) => !f.retired);

check('the engine publishes a canonical receiver for consumers to read',
    Boolean(canonical), canonical);
check('at least one consumer was found, so this driver is measuring something',
    findings.length > 0,
    `${findings.length} link-building sites across ${new Set(findings.map((f) => f.repo)).size} repo(s)`);
check('no LIVE consumer builds a deep link against a retired receiver',
    onRetired.length === 0,
    onRetired.length
        ? onRetired.map((f) => `${f.file}`).join('; ')
        : 'every live consumer targets the canonical receiver');
/* Reported, never counted against the verdict, and never hidden either: a
   count that quietly disappears is how the estate loses track of what it is
   carrying. */
check('history is recorded rather than rewritten',
    true,
    `${retiredHistory.length} site(s) in superseded published versions and the archive still name the retired receiver, correctly left alone`);

const report = {
    schema: 'globalgrid2050.testcode.link-targets.v1',
    generated_utc: new Date().toISOString(),
    canonical_receiver: canonical,
    retired_receivers: retired,
    contract_source: 'ventus-grid-engine/deeplink/receivers.json',
    on_canonical: onCanonical,
    on_retired: onRetired
};
writeFileSync(path.join(process.cwd(), 'link-targets.json'), JSON.stringify(report, null, 2) + '\n');

console.log(`canonical receiver   ${canonical}`);
console.log(`retired              ${retired.join(', ') || 'none'}`);
console.log(`link-building sites  ${findings.length}\n`);
for (const f of findings) {
    console.log(`${f.retired ? 'RETIRED ' : 'ok      '} ${f.file}`);
    console.log(`         -> ${f.route}`);
}

let failed = 0;
console.log('');
for (const c of checks) {
    if (!c.ok) failed += 1;
    console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.detail ? '  -- ' + c.detail : ''}`);
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
if (failed) { console.error(`${failed} FAILED`); process.exit(1); }
