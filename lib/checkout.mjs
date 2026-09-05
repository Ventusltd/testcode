/* checkout.mjs — WHICH clone a gate read, decided explicitly and out loud.
 *
 * The defect this replaces, measured 2026-09-05: `node drivers/menu-map.mjs`
 * run twice, twenty minutes apart, with nothing changed on disk, reported
 *
 *     groups: 5   5/5 checks passed   exit 0
 *     groups: 1   4/5 checks passed   exit 1
 *
 * Both runs printed the surface as `gridatlas` and neither named the directory
 * it had actually read. The cause was this line, in two files:
 *
 *     candidates.find((c) => c.branch === 'main') || candidates[0]
 *
 * When no candidate answers `main` — because no clone is on main, or because
 * `git branch --show-current` did not answer at all — the `||` silently takes
 * `candidates[0]`, which is whatever `readdirSync` happened to return first.
 * readdirSync order is not part of any contract, so the gate's verdict was not
 * a property of the estate. Reproduced by making `git` unanswerable: identical
 * command, identical bytes, exit 0 became exit 1.
 *
 * The rule here instead:
 *
 *   1. An explicitly declared path wins, and if it is not there that is a
 *      failure, not a search.
 *   2. Otherwise candidates are enumerated in SORTED order and matched against
 *      a declared branch. Exactly one match is a result. Zero is a failure.
 *      More than one is a failure, because the gate cannot know which was meant.
 *   3. A clone whose branch git would not tell us is UNKNOWN, never "not main".
 *   4. There is no fallback. A gate that cannot say which bytes it read has
 *      not measured anything, and must say so rather than pick one.
 *
 * Every path out of here carries `dir`, `branch` and `why`, so the caller can
 * print the bytes it read next to the verdict it reached.
 */
import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

/* null means "git would not say", which is not the same as "not on main".
   No `shell: true`: on Node 24 that raises DEP0190 on stderr, and this
   runner's summary of a gate is the last line the gate printed — so a
   deprecation warning from the runner's own plumbing was overwriting the
   gate's verdict in the report. Measured: the `menus` row read
   "(Use `node --trace-deprecation ...` to show where the warning was
   created)" instead of "6/6 checks passed". */
export function branchOf(dir) {
    const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd: dir, encoding: 'utf8' });
    if (result.error || result.status !== 0) return null;
    const name = (result.stdout || '').trim();
    return name && name !== 'HEAD' ? name : null;
}

/* parent      directory the clones sit in
   base        clone name, e.g. 'gridatlas'; siblings are `${base}-*`
   declared    an explicit path that ends the search when present
   branch      the branch a candidate must be on to be selected
   mustContain relative paths a candidate must actually have, so an empty
               directory of the right name cannot be chosen                  */
export function resolveCheckout({ parent, base, declared = null, branch = 'main', mustContain = [] }) {
    const has = (dir) => mustContain.every((rel) => existsSync(path.join(dir, ...rel.split('/'))));

    if (declared) {
        const dir = path.resolve(parent, declared);
        if (!existsSync(dir)) {
            return { ok: false, dir, branch: null, candidates: [], why: `declared checkout ${declared} is not present` };
        }
        if (!has(dir)) {
            return { ok: false, dir, branch: branchOf(dir), candidates: [], why: `declared checkout ${declared} does not carry ${mustContain.join(', ')}` };
        }
        return { ok: true, dir, branch: branchOf(dir), candidates: [], why: `declared in the registry as ${declared}` };
    }

    let names = [];
    try { names = readdirSync(parent); } catch { names = []; }
    const candidates = names
        .filter((n) => n === base || n.startsWith(`${base}-`))
        .sort()                                   /* deterministic, unlike readdir order */
        .map((n) => path.join(parent, n))
        .filter((dir) => has(dir))
        .map((dir) => ({ dir, branch: branchOf(dir) }));

    const shown = candidates.map((c) => `${path.basename(c.dir)}=${c.branch || 'UNKNOWN'}`);
    const onBranch = candidates.filter((c) => c.branch === branch);

    if (onBranch.length === 1) {
        return { ok: true, dir: onBranch[0].dir, branch, candidates: shown, why: `the one ${base} checkout on ${branch}` };
    }
    if (onBranch.length === 0) {
        return {
            ok: false, dir: null, branch: null, candidates: shown,
            why: `no ${base} checkout is on ${branch} — candidates: ${shown.join(', ') || 'none'}`
        };
    }
    return {
        ok: false, dir: null, branch: null, candidates: shown,
        why: `${onBranch.length} ${base} checkouts are on ${branch}, so which bytes to read is ambiguous: ${onBranch.map((c) => path.basename(c.dir)).join(', ')}`
    };
}
