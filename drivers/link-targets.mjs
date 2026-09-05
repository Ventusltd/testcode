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
 * TWO WAYS THIS GATE WAS GREEN WHILE THE FAULT WAS LIVE, both measured
 * 2026-09-05, both fixed below:
 *
 *   1. It could not see HTML. SCAN accepted only .js and .mjs. The page served
 *      at https://globalgrid2050.com/uk_renewables_pipeline/v9.7/ carries
 *          <a href="../../repd_grid_atlasv8/">MAP ATLAS</a>
 *      in its nav bar, and that URL answers HTTP 200. This driver printed "no
 *      LIVE consumer builds a deep link against a retired receiver" while a
 *      reader could click it. "0 live sites" was true of the JavaScript and
 *      false of the HTML. It now reads .html, and resolves every anchor
 *      against the URL the file is published at, because the fault was written
 *      as a RELATIVE href and no amount of searching for the absolute string
 *      would ever have found it.
 *
 *   2. It decided what was live from a directory-name regex. See the block on
 *      classification below: nine directories the homepage links right now
 *      were being excluded from the verdict as superseded history, and the
 *      build cut that morning was counted live only by falling off the end of
 *      the function.
 *
 * Run: node drivers/link-targets.mjs
 *      node drivers/link-targets.mjs --estate DIR   read a different estate
 *          root. This is how the gate is shown going red and then green on a
 *          controlled input; a check nobody has watched fail is a claim.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { homepageSurfaces } from '../lib/published-surfaces.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const estateFlag = process.argv.indexOf('--estate');
const PARENT = estateFlag >= 0 && process.argv[estateFlag + 1]
    ? path.resolve(process.cwd(), process.argv[estateFlag + 1])
    : path.resolve(ROOT, '..');
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
/* A line that is always true is a measurement, not a check, and counting it in
   "N/N checks passed" is how a suite inflates its own denominator with things
   that could never have gone red. These are printed separately and excluded
   from the total. */
const notes = [];
const note = (name, detail) => notes.push({ name, detail });

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

/* ---- Which surfaces the estate actually publishes -------------------------
   This used to be a directory-name regex, /^v9(\.\d+)*$/, with the highest
   name declared live and every other name declared "superseded history" and
   excluded from the verdict. Two things that regex got wrong, both measured:

     - uk_renewables_pipeline/202609051156/ — the build cut that morning and
       the FIRST pipeline link on the homepage — matches no version pattern at
       all, so it reached 'live' only by falling off the end of the function.
       A timestamped release directory being treated correctly by accident is
       not the same as being treated correctly.

     - v7, v9, v9.4, v9.5, v9.5.1, v9.6, v9.6.1, v9.6.2 and v9.7 are all linked
       from https://globalgrid2050.com/ right now, and every one of their index
       pages served <a href="../../repd_grid_atlasv8/">MAP ATLAS</a>. They were
       excluded from the verdict as history WHILE THE HOMEPAGE PUBLISHED THEM.

   A directory name is not a publication decision; the homepage is. So the set
   of supported surfaces is read from globalgrid2050/index.html — the same
   bytes served at the root of the site. A surface the homepage links has to be
   right. A directory it does not link is reported with its count and left
   alone, which is still the estate's rule about dated publications: an erratum,
   not a rewrite. The difference is that "left alone" is now a decision the
   homepage made, and it can be changed by unlinking the page. */
const published = homepageSurfaces(PARENT);

/* ---- Where the estate builds links --------------------------------------- */
/* Only the surfaces that emit project deep links. Kept explicit rather than
   scanning everything: a driver that greps the whole estate finds every URL
   ever written in a comment and drowns the real finding.

   `servedAt` is the URL a file is read at, and it is what makes a relative
   href checkable. Without it a `../../repd_grid_atlasv8/` cannot be resolved
   to a route at all, and this driver records the href as unresolved rather
   than passing over it.

   pipelinenews is a build repo, not a site, so most of its markup has no
   address. Its TEMPLATES do: ui/templates/*.html is what a published version
   shell is generated from, and it is served at
   uk_renewables_pipeline/<version>/index.html. That depth is all a relative
   href needs, and it matters — the template that generates every future shell
   was carrying <a href="../../repd_grid_atlasv8/">MAP ATLAS</a> itself, which
   is the difference between fixing the output and fixing the thing that makes
   the output. */
const SCAN = [
    {
        repo: 'globalgrid2050',
        repoRoot: path.join(PARENT, 'globalgrid2050'),
        dir: path.join(PARENT, 'globalgrid2050', 'uk_renewables_pipeline'),
        exts: ['.js', '.mjs', '.html'],
        servedAt: (rel) => new URL(rel, 'https://globalgrid2050.com/').href
    },
    {
        repo: 'pipelinenews',
        repoRoot: path.join(PARENT, 'pipelinenews'),
        dir: path.join(PARENT, 'pipelinenews'),
        exts: ['.js', '.mjs', '.html'],
        skip: ['node_modules', '.git', 'releases', 'build'],
        servedAt: (rel) => (rel.startsWith('ui/templates/')
            ? 'https://globalgrid2050.com/uk_renewables_pipeline/{version}/index.html'
            : null)
    }
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

const posix = (p) => p.replace(/\\/g, '/');
const findings = [];
const unresolved = [];

for (const target of SCAN) {
    const files = walk(target.dir, target.exts, target.skip, []);
    for (const file of files) {
        let source;
        try { source = readFileSync(file, 'utf8'); } catch { continue; }
        const rel = posix(path.relative(PARENT, file));

        if (path.extname(file) === '.html') {
            /* ---- HTML: an anchor is a link, and it is usually relative ------
               No guard on repd_ref/atlasUrl here: those names belong to the
               JavaScript that builds a per-row link. A nav button is a plain
               <a href> and carries none of them, which is the second reason
               this gate could not see the fault it was written for.

               Comments are removed before anything is read, so the note in
               202609051156/index.html explaining what the button USED to open
               is not counted as the thing it stopped doing. A mention is not a
               link, in HTML too. */
            const markup = source.replace(/<!--[\s\S]*?-->/g, '');
            const base = target.servedAt(posix(path.relative(target.repoRoot, file)));
            const byRoute = new Map();
            for (const m of markup.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi)) {
                const href = m[1].trim();
                if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue;
                let resolved = null;
                if (/^https?:\/\//i.test(href)) resolved = href;
                else if (base) { try { resolved = new URL(href, base).href; } catch { resolved = null; } }
                if (!resolved) {
                    /* A relative href in a repo with no declared origin cannot
                       be resolved to a receiver. Recorded with its file, never
                       just dropped: an unreadable href is not a clean one, and
                       one on a LIVE surface is a hole in this gate's coverage
                       that has to be visible as a failure rather than as a
                       silent zero. */
                    unresolved.push({ repo: target.repo, file: rel, href });
                    continue;
                }
                const bare = strip(resolved);
                for (const route of [canonical, ...retired]) {
                    if (bare !== strip(route)) continue;
                    const key = strip(route);
                    byRoute.set(key, (byRoute.get(key) || 0) + 1);
                }
            }
            for (const [route, count] of byRoute) {
                findings.push({
                    repo: target.repo,
                    file: rel,
                    kind_of_site: 'html anchor',
                    route,
                    retired: retiredStripped.includes(route),
                    builds: count,
                    mentions_only: 0
                });
            }
            continue;
        }

        /* A deep link is a URL that carries the identity parameter, or a
           builder named for the atlas. Both shapes, because the estate has
           written it both ways. */
        if (!/repd_ref|atlasUrl|buildDeepLink|atlasLink/.test(source)) continue;
        for (const route of [canonical, ...retired]) {
            const bare = strip(route);
            if (!source.includes(bare)) continue;
            /* A MENTION IS NOT A LINK.
               Lane B caught this on the first real use: this driver flagged
               three files that name the retired route in order to ASSERT ITS
               ABSENCE. A proof saying "this must never appear" was being
               reported as the very thing it prevents, which is how a gate
               teaches people to ignore it.

               So classify the line the route sits on. Assigned, concatenated
               or handed to new URL() is a link; inside an assertion, a
               negation or a comment it is a statement ABOUT a link, counted
               separately and reported rather than judged. */
            /* A REFUSAL LIST IS NOT A LINK EITHER.
               Second time this driver has had to learn the distinction. A
               consumer that compiles in the engine's contract necessarily
               carries the RETIRED routes too -- that is what lets it refuse
               one before the live document has been read, and dropping them
               would make the compiled copy less safe, not more. Those entries
               sit inside the `retired:` array of a COMPILED_CONTRACT block and
               are already checked against the published contract, entry for
               entry, further down this file. Counting them as links would fail
               a consumer for holding the very list that protects it. */
            const compiledBlock = (source.match(/const COMPILED_CONTRACT[\s\S]*?\n\}\);/) || [""])[0];
            const compiledRetired = compiledBlock
                ? new Set([...compiledBlock.matchAll(/route:\s*"([^"]+)"/g)].map((m) => strip(m[1])).slice(1))
                : new Set();
            const lines = source.split('\n').filter((l) => l.includes(bare));
            const isAssertion = (line) =>
                /assert|expect|doesNotMatch|toBe|!==|===|must not|never|retired|forbidden|\bnot\b/i.test(line)
                || /^\s*(\/\/|\*|\/\*)/.test(line)
                || (compiledRetired.has(bare) && compiledBlock.includes(line.trim()));
            const buildLines = lines.filter((l) => !isAssertion(l));
            findings.push({
                repo: target.repo,
                file: rel,
                kind_of_site: 'script',
                route: bare,
                retired: retiredStripped.includes(bare),
                builds: buildLines.length,
                mentions_only: lines.length - buildLines.length
            });
        }
    }
}

/* ---- Live, or history? ---------------------------------------------------
   The first run of this driver reported 65 sites on the retired receiver and
   would have stayed red for ever. Some of them are IMMUTABLE: an archive tree
   and superseded published bundles that the homepage no longer offers. A
   published version is a dated record and must not be rewritten — the estate's
   own rule is that a dated publication gets an erratum, not a rewrite — so a
   gate that demands they change is a gate that can never go green, which is
   precisely how a check decays into an alarm nobody reads.

   So they are classified, not filtered. What changed is WHO decides: the
   homepage, by linking a surface, rather than a regex over directory names. */
function classify(file) {
    const rel = posix(file);
    if (/(^|\/)archive\//.test(rel)) return 'archived';
    if (!rel.startsWith('globalgrid2050/')) return 'live';
    if (!published.ok) return 'unknown';
    return published.publishes(rel.slice('globalgrid2050/'.length)) ? 'live' : 'not-published';
}

for (const f of findings) f.kind = classify(f.file);

const onRetiredAll = findings.filter((f) => f.retired && f.builds > 0);
const retiredMentionsOnly = findings.filter((f) => f.retired && f.builds === 0);
const onRetired = onRetiredAll.filter((f) => f.kind === 'live');
const retiredHistory = onRetiredAll.filter((f) => f.kind !== 'live');
const onCanonical = findings.filter((f) => !f.retired);

check('the engine publishes a canonical receiver for consumers to read',
    Boolean(canonical), canonical);

/* The surface list is itself a measurement, and a wrong one silences this
   gate, so it is checked rather than assumed. */
check('the set of supported surfaces was read from the homepage the estate serves',
    published.ok,
    `${published.source}: ${published.why}; pipeline surfaces published: ${published.pipelineDirs.join(', ') || 'none'}`);

const unresolvedLive = unresolved.filter((u) => classify(u.file) === 'live');
check('every relative href on a LIVE surface could be resolved to a URL',
    unresolvedLive.length === 0,
    unresolvedLive.length === 0
        ? `every anchor on a published surface resolved against its origin; ${unresolved.length} unresolvable href(s) remain, all in the archive or in unpublished directories, because their repo declares no publish origin`
        : `${unresolvedLive.length} relative href(s) on a published surface could not be resolved — unreadable, therefore unchecked: ${[...new Set(unresolvedLive.map((u) => u.file))].slice(0, 6).join('; ')}`);

/* ---- THE COMPILED COPY, AND THE GATE THAT MAKES IT SAFE ------------------
 *
 * On 2026-09-05 the live consumer was measured unable to paint a single one of
 * its 7,680 rows until a cross-origin fetch of receivers.json completed, because
 * it held no route of its own and its link builder is synchronous. It now
 * compiles the engine's contract in and fetches the published one to verify it.
 *
 * That is only defensible with THIS check. A hard-coded route the estate cannot
 * notice drifting is the original fault -- seven plugins each holding a route
 * that had quietly stopped being true. A hard-coded route compared against the
 * engine's published document on every offline run is a cache with an expiry
 * the estate can see. The difference is entirely this block, so it fails hard
 * rather than warning: if the compiled copy and the published document ever
 * disagree, the consumer must be corrected before anything ships.
 *
 * It reads the consumer's SOURCE rather than trusting a declaration in it, and
 * it locates the module by name rather than by a path list, so cutting v9.8
 * does not leave the check pointing at a file nobody serves. */
const compiledConsumers = walk(
    path.join(PARENT, 'globalgrid2050', 'uk_renewables_pipeline'), ['.js'], [], [],
).filter((file) => path.basename(file).startsWith('atlas-receiver-')
    && classify(posix(path.relative(PARENT, file))) === 'live');

const compiled = compiledConsumers.map((file) => {
    const source = readFileSync(file, 'utf8');
    const block = source.match(/const COMPILED_CONTRACT\s*=\s*Object\.freeze\(([\s\S]*?)\n\}\);/);
    const routes = block ? [...block[1].matchAll(/route:\s*"([^"]+)"/g)].map((m) => strip(m[1])) : [];
    return {
        file: posix(path.relative(PARENT, file)),
        present: Boolean(block),
        canonical: routes[0] || null,
        retired: routes.slice(1),
    };
});

check('the live consumer compiles in the contract rather than waiting on a fetch to build a link',
    compiled.length > 0 && compiled.every((c) => c.present),
    compiled.length
        ? compiled.map((c) => `${c.file} ${c.present ? 'has' : 'MISSING'} COMPILED_CONTRACT`).join('; ')
        : 'no live atlas-receiver module found, so this check measured nothing');

check("the compiled-in canonical receiver equals the engine's published one",
    compiled.length > 0 && compiled.every((c) => c.canonical === strip(canonical)),
    compiled.map((c) => `${c.file}: ${c.canonical} vs published ${strip(canonical)}`).join('; '));

check('the compiled-in contract carries every route the engine has retired',
    compiled.length > 0 && compiled.every((c) => retiredStripped.every((r) => c.retired.includes(r))),
    compiled.map((c) => `${c.file}: retired [${c.retired.join(', ')}] vs published [${retiredStripped.join(', ')}]`).join('; '));

check('the compiled-in canonical receiver is not itself a retired route',
    compiled.length > 0 && compiled.every((c) => !retiredStripped.includes(c.canonical)),
    'a compiled contract naming a dead receiver is the original defect, cached');
check('at least one consumer was found, so this driver is measuring something',
    findings.length > 0,
    `${findings.length} link-building sites across ${new Set(findings.map((f) => f.repo)).size} repo(s)`);

/* The scanner has to be able to see the file type the fault was written in.
   It could not, for a day and a half, and reported green the whole time. */
const htmlFindings = findings.filter((f) => f.kind_of_site === 'html anchor');
check('the scanner reads the markup as well as the scripts',
    SCAN.every((t) => t.exts.includes('.html')),
    `${htmlFindings.length} receiver anchor(s) found in HTML, which the .js/.mjs-only scanner could not see at all`);

check('no LIVE consumer builds a deep link against a retired receiver',
    onRetired.length === 0,
    onRetired.length
        ? onRetired.map((f) => `${f.file} (${f.kind_of_site})`).join('; ')
        : 'every live consumer targets the canonical receiver');
/* Reported, never counted against the verdict, and never hidden either: a
   count that quietly disappears is how the estate loses track of what it is
   carrying. */
note('a route named only to assert its absence is not counted as a link',
    `${retiredMentionsOnly.length} file(s) name the retired route only in an assertion or a comment`);
note('history is recorded rather than rewritten',
    `${retiredHistory.length} site(s) in the archive or in directories the homepage does not link still name the retired receiver, correctly left alone`);

const report = {
    schema: 'globalgrid2050.testcode.link-targets.v2',
    generated_utc: new Date().toISOString(),
    estate_root: posix(PARENT),
    canonical_receiver: canonical,
    retired_receivers: retired,
    contract_source: 'ventus-grid-engine/deeplink/receivers.json',
    published_surfaces_source: published.source,
    published_pipeline_surfaces: published.pipelineDirs,
    unresolved_relative_hrefs: unresolved.length,
    unresolved_relative_hrefs_on_live_surfaces: unresolvedLive.length,
    on_canonical: onCanonical,
    on_retired: onRetired,
    on_retired_not_published: retiredHistory
};
writeFileSync(path.join(process.cwd(), 'link-targets.json'), JSON.stringify(report, null, 2) + '\n');

console.log(`canonical receiver   ${canonical}`);
console.log(`retired              ${retired.join(', ') || 'none'}`);
console.log(`surfaces published   ${published.pipelineDirs.join(', ') || 'none'} (from ${published.source})`);
console.log(`link-building sites  ${findings.length}  (${htmlFindings.length} in HTML)\n`);
for (const f of findings) {
    if (f.retired && f.builds > 0 && f.kind === 'live') {
        console.log(`RETIRED  ${f.file}  [${f.kind_of_site}, LIVE]`);
        console.log(`         -> ${f.route}`);
    }
}
console.log(`(${findings.length - onRetired.length} further site(s) on the canonical receiver, in the archive, or in unpublished directories — see link-targets.json)`);

let failed = 0;
console.log('');
for (const c of checks) {
    if (!c.ok) failed += 1;
    console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.detail ? '  -- ' + c.detail : ''}`);
}
console.log('');
for (const n of notes) console.log(`note  ${n.name}  -- ${n.detail}`);
console.log(`(a note is a measurement with no pass or fail. It is not counted below,`);
console.log(` because a line that could not have gone red is not evidence that it did not.)`);
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
if (failed) { console.error(`${failed} FAILED`); process.exit(1); }
