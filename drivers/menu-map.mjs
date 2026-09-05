/* menu-map.mjs — map every menu on every surface, offline.
 *
 * "menus driver (map all menus)" — the architect, 2026-09-05.
 *
 * Menus are where this estate has repeatedly lost things: a control moved into
 * a collapsed panel and read as "branding has been lost"; an attribution box
 * that overlapped the EDIT panel's own controls; a File menu that listed 11 of
 * 44 engine nodes because it filtered on one node type. None of those was
 * visible to any gate, because nothing knew what the menus were supposed to
 * contain.
 *
 * This reads the COMPOSED BYTES of each surface's menu source from the local
 * clones — never the network, never a part that might not have been composed —
 * and emits menu-map.json. It fails when a surface the registry says has a menu
 * turns out to have none, and when a menu loses a title it previously carried.
 *
 * Run: node drivers/menu-map.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCheckout } from '../lib/checkout.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARENT = path.resolve(ROOT, '..');
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

const surfaces = [];

/* ---- GridAtlas: the composed cartridge named by the composition ----------
   WHICH checkout matters, and this driver has now got it wrong twice.

   First: it read ../gridatlas, which on this machine is parked on a candidate
   branch at an older generation, and reported that the engine rows were
   missing from the menu. They were not missing; they were absent from the
   composition that clone happened to be sitting on.

   Then the fix for that was written as

       candidates.find((c) => c.branch === 'main') || candidates[0]

   which is worse, because it is not a rule, it is a rule with a silent escape
   hatch. Measured 2026-09-05: the identical command twenty minutes apart gave
   `groups: 5, 5/5, exit 0` and then `groups: 1, 4/5, exit 1`, with nothing
   changed on disk, and both runs labelled the surface `gridatlas` without ever
   naming the directory they read. Reproduced on demand by making `git`
   unanswerable: when no candidate answers 'main' the `||` takes candidates[0],
   which is whatever readdirSync returned first, and readdir order is not a
   contract.

   So: exactly one checkout on the declared branch, or this gate fails and says
   which candidates it saw and what branch each was on. There is no fallback,
   because a measurement that cannot name the bytes it read is not a
   measurement, and quietly reading the wrong bytes is the fault this driver
   exists to catch. */
const checkout = resolveCheckout({
    parent: PARENT,
    base: 'gridatlas',
    branch: process.env.GRIDATLAS_BRANCH || 'main',
    mustContain: ['atlas/current.json']
});

check('exactly one gridatlas checkout was selected, by an explicit rule rather than by readdir order',
    checkout.ok,
    `${checkout.ok ? path.basename(checkout.dir) : 'NONE'} — ${checkout.why}`);

const atlas = checkout.ok ? checkout.dir : null;
if (atlas) {
    const current = JSON.parse(readFileSync(path.join(atlas, 'atlas', 'current.json'), 'utf8'));
    const entry = (current.cartridges || []).find((c) => /substation-intelligence/.test(c.path || ''));
    const composedPath = entry && path.join(atlas, 'atlas', entry.path.replace(/^\.\//, ''));
    if (composedPath && existsSync(composedPath)) {
        const composed = readFileSync(composedPath, 'utf8');
        const menus = (composed.match(/var MENUS = \[([^\]]+)\]/) || [])[1];
        const titles = menus ? menus.split(',').map((s) => s.trim().replace(/'/g, '')) : [];
        surfaces.push({
            id: 'gridatlas',
            checkout: path.basename(atlas),
            branch: checkout.branch,
            checkout_why: checkout.why,
            generation: current.generation,
            source: entry.path,
            titles,
            groups: [...new Set((composed.match(/appendGroup\([^,]+,\s*'([^']+)'/g) || [])
                .map((m) => m.replace(/.*'([^']+)'.*/, '$1')))],
            estate_links: (composed.match(/data-gm-estate/g) || []).length > 0,
            engine_rows: composed.includes('data-gm-engine'),
            studies: composed.includes('data-gm-study'),
            attribution_in_about: /panels\.About/.test(composed) && composed.includes('custom-map-attrib')
        });
    }
}

/* ---- The shared estate menu module --------------------------------------- */
const estateMenu = path.resolve(ROOT, '..', 'spiders',
    'species', 'seer-spider', 'estate-menu', 'estate-menu.js');
if (existsSync(estateMenu)) {
    const source = readFileSync(estateMenu, 'utf8');
    surfaces.push({
        id: 'estate-menu',
        source: 'spiders/species/seer-spider/estate-menu/estate-menu.js',
        titles: ['FILE', 'EDIT', 'VIEW', 'SCOPE', 'GRID', 'ABOUT']
            .filter((t) => source.includes(t)),
        bytes: source.length
    });
}

/* ---- The grid engine receiver -------------------------------------------- */
const receiver = path.resolve(ROOT, '..', 'ventus-grid-engine', 'index.html');
if (existsSync(receiver)) {
    const page = readFileSync(receiver, 'utf8');
    surfaces.push({
        id: 'grid-engine-receiver',
        source: 'ventus-grid-engine/index.html',
        titles: ['FILE', 'EDIT', 'VIEW', 'SCOPE', 'GRID', 'ABOUT'].filter((t) => page.includes(t)),
        takes_focus_param: page.includes('qp.get("focus")')
    });
}

/* ---- What the map must satisfy ------------------------------------------- */
const registry = JSON.parse(readFileSync(path.join(ROOT, 'engines.json'), 'utf8'));
const expected = (registry.surfaces || []).filter((s) => s.has_menu).map((s) => s.id);

check('every surface the registry says has a menu was found and has one',
    expected.every((id) => {
        const found = surfaces.find((s) => s.id === id || (id === 'grid-engine-receiver' && s.id === id));
        return found && found.titles && found.titles.length > 0;
    }),
    expected.join(', '));

const atlasSurface = surfaces.find((s) => s.id === 'gridatlas');
check('the GridAtlas menu still carries all six titles',
    atlasSurface && atlasSurface.titles.length === 6,
    atlasSurface ? atlasSurface.titles.join(' ') : 'gridatlas not found');

check('the six titles are the estate vocabulary, not a renamed set',
    atlasSurface && ['File', 'Edit', 'View', 'Scope', 'Grid', 'About']
        .every((t) => atlasSurface.titles.includes(t)),
    atlasSurface ? atlasSurface.titles.join(' ') : '');

check('the attribution is routed into About rather than left on the map',
    atlasSurface && atlasSurface.attribution_in_about,
    'custom-map-attrib reaches panels.About');

check('the engine modules are reachable from a menu',
    atlasSurface && atlasSurface.engine_rows, 'data-gm-engine present');

/* Pipeline News is registered as having NO menu. That is not a pass, it is the
   open item: the architect asked for the same menus there and they do not yet
   exist. Recording it as a known gap is the difference between a map and a
   flattering picture. */
const gaps = (registry.surfaces || []).filter((s) => !s.has_menu).map((s) => s.id);

const map = {
    schema: 'globalgrid2050.testcode.menu-map.v1',
    generated_utc: new Date().toISOString(),
    gridatlas_checkout: {
        selected: checkout.ok ? path.basename(checkout.dir) : null,
        branch: checkout.branch,
        why: checkout.why,
        candidates: checkout.candidates
    },
    surfaces,
    surfaces_without_a_menu: gaps,
    note: 'Read from composed bytes in local clones. No network. A surface listed under surfaces_without_a_menu is an open gap, not a passing state.'
};
writeFileSync(path.join(process.cwd(), 'menu-map.json'), JSON.stringify(map, null, 2) + '\n');

/* Print the bytes before the verdict. The version of this driver that could
   give two answers never printed which directory it read. */
console.log(`gridatlas checkout       ${checkout.ok ? path.basename(checkout.dir) : 'NOT SELECTED'} (${checkout.branch || 'branch unknown'})`);
console.log(`                         ${checkout.why}`);
if (checkout.candidates && checkout.candidates.length) {
    console.log(`candidates seen          ${checkout.candidates.join(', ')}`);
}
console.log('');
for (const s of surfaces) {
    console.log(`${s.id.padEnd(24)} titles: ${(s.titles || []).join(' ') || '(none)'}`);
    if (s.generation) console.log(`${''.padEnd(24)} generation: ${s.generation}`);
    if (s.groups) console.log(`${''.padEnd(24)} groups: ${s.groups.length}`);
}
console.log(`\nsurfaces with no menu yet: ${gaps.join(', ') || 'none'}`);

let failed = 0;
console.log('');
for (const c of checks) {
    if (!c.ok) failed += 1;
    console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.detail ? '  -- ' + c.detail : ''}`);
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
if (failed) { console.error(`${failed} FAILED`); process.exit(1); }
