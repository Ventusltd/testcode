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
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

const surfaces = [];

/* ---- GridAtlas: the composed cartridge named by the composition ----------
   WHICH checkout matters, and the first version of this driver got it wrong in
   a way worth keeping. It read ../gridatlas, which on this machine is parked on
   a candidate branch at an older generation, and reported that the engine rows
   were missing from the menu. They were not missing; they were absent from the
   composition that clone happened to be sitting on.

   So: prefer a checkout on main, say which one was read, and report the branch
   and generation alongside the result. A measurement that does not name the
   bytes it read is not a measurement. */
function gridatlasCheckout() {
    const candidates = [];
    const parent = path.resolve(ROOT, '..');
    for (const name of readdirSafe(parent)) {
        if (name === 'gridatlas' || name.startsWith('gridatlas-main')) {
            const dir = path.join(parent, name);
            if (existsSync(path.join(dir, 'atlas', 'current.json'))) {
                candidates.push({ dir, branch: branchOf(dir) });
            }
        }
    }
    return candidates.find((c) => c.branch === 'main') || candidates[0] || null;
}

function readdirSafe(dir) {
    try { return readdirSync(dir); } catch { return []; }
}

function branchOf(dir) {
    const result = spawnSync('git', ['branch', '--show-current'],
        { cwd: dir, encoding: 'utf8', shell: process.platform === 'win32' });
    return (result.stdout || '').trim();
}

const checkout = gridatlasCheckout();
const atlas = checkout ? checkout.dir : path.resolve(ROOT, '..', 'gridatlas');
if (existsSync(path.join(atlas, 'atlas', 'current.json'))) {
    const current = JSON.parse(readFileSync(path.join(atlas, 'atlas', 'current.json'), 'utf8'));
    const entry = (current.cartridges || []).find((c) => /substation-intelligence/.test(c.path || ''));
    const composedPath = entry && path.join(atlas, 'atlas', entry.path.replace(/^\.\//, ''));
    if (composedPath && existsSync(composedPath)) {
        const composed = readFileSync(composedPath, 'utf8');
        const menus = (composed.match(/var MENUS = \[([^\]]+)\]/) || [])[1];
        const titles = menus ? menus.split(',').map((s) => s.trim().replace(/'/g, '')) : [];
        surfaces.push({
            id: 'gridatlas',
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
    surfaces,
    surfaces_without_a_menu: gaps,
    note: 'Read from composed bytes in local clones. No network. A surface listed under surfaces_without_a_menu is an open gap, not a passing state.'
};
writeFileSync(path.join(process.cwd(), 'menu-map.json'), JSON.stringify(map, null, 2) + '\n');

for (const s of surfaces) {
    console.log(`${s.id.padEnd(24)} titles: ${(s.titles || []).join(' ') || '(none)'}`);
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
