/* run.mjs — the estate's test engine. Offline first, always.
 *
 *   node run.mjs                 offline gates only. This is the default,
 *                                because this is the one that must pass before
 *                                anything else is allowed to happen.
 *   node run.mjs --with-network  offline gates, then the network ones, and only
 *                                if every offline gate passed.
 *   node run.mjs --list          what is registered, and what is not green.
 *   node run.mjs --registry P    run a different registry. This exists so the
 *                                runner itself can be shown going red: a gate
 *                                that has never been watched fail is a claim,
 *                                not a measurement.
 *
 * The ordering is the point, and it is enforced here rather than described:
 * a network gate cannot run until every offline gate has passed, because a
 * gate that needs the network cannot tell you anything when the network is
 * what has changed.
 *
 * ABSENT IS NOT PASSED, AND IT IS NOT NEUTRAL EITHER.
 * ---------------------------------------------------------------------------
 * Until 2026-09-05 this file printed the right words and then did the wrong
 * thing. `offlineFailures` counted 'fail' and 'timeout' and not 'absent', so a
 * registry naming clones that do not exist produced, verbatim:
 *
 *     0 passed · 0 failed · 3 not present
 *     A gate that is not present has not passed. It is reported as absent,
 *     never counted as green — a skip is not a pass.
 *     EXIT=0
 *
 * — and the network phase ran anyway, with ZERO offline gates having passed.
 * The ordering rule the header above calls "enforced here rather than
 * described" was bypassed by deleting a directory. A gate you can silence by
 * removing its clone is a gate an accident can remove.
 *
 * So absence blocks, exactly like failure, unless the registry says in writing
 * that a gate is optional (`"required": false`). Nothing is optional today.
 *
 * Each gate runs in its OWN child process. That is not ceremony: a gate signals
 * failure by exiting non-zero, so importing them into one process would let the
 * first failure kill the run and hide the state of every gate after it. A
 * report that stops at the first problem is how a second problem survives to
 * production.
 *
 * It reports what happened. It does not grade the estate.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCheckout, branchOf } from './lib/checkout.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const withNetwork = process.argv.includes('--with-network');
const listOnly = process.argv.includes('--list');
const registryFlag = process.argv.indexOf('--registry');
const registryPath = registryFlag >= 0 && process.argv[registryFlag + 1]
    ? path.resolve(process.cwd(), process.argv[registryFlag + 1])
    : path.join(ROOT, 'engines.json');

if (!existsSync(registryPath)) {
    console.error(`no registry at ${registryPath}`);
    process.exit(1);
}
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
/* The registry's own directory is the estate root the paths are relative to,
   so --registry can point at a fixture estate without lying about ../ */
const BASE = path.dirname(registryPath);

/* A gate is required unless the registry says otherwise, in writing. */
const isRequired = (engine) => engine.required !== false;

if (listOnly) {
    console.log(`${registry.engines.length} gates registered — ${registryPath}\n`);
    for (const e of registry.engines) {
        console.log(`${e.network ? 'network' : 'offline'}  ${isRequired(e) ? 'required' : 'OPTIONAL'}  ${e.id.padEnd(28)} ${e.repo}`);
        if (e.status) console.log(`         ${e.status}`);
        for (const d of e.known_defects || []) console.log(`         known: ${d}`);
    }
    process.exit(0);
}

/* Which checkout a gate is run against, and say it out loud.
   ------------------------------------------------------------------------
   The first run of this engine proved the gridatlas composition against
   ../gridatlas, which on this machine is parked on a candidate branch at an
   older generation. It passed, and it was measuring the wrong bytes. A gate
   that reports PASS about a checkout nobody asked about is worse than no gate.

   The first fix — "prefer a sibling on main" — traded that for something
   worse, because it was written as

       candidates.find((c) => c.branch === 'main') || candidates[0]

   and the `||` is a silent fallback to readdir order. Measured going from
   exit 0 to exit 1 across two runs with nothing changed on disk.

   So the registry now says which checkout, in writing. Default: the declared
   `path`, and only that. An engine that genuinely has to choose between
   sibling clones declares `"checkout": { "search": "siblings", "branch": "…" }`
   and gets exactly-one-or-fail from lib/checkout.mjs. There is no fallback in
   either branch of that choice. */
function checkoutFor(engine) {
    const policy = engine.checkout;
    if (!policy || policy === 'declared') {
        const dir = path.resolve(BASE, engine.path);
        return existsSync(dir)
            ? { ok: true, dir, branch: branchOf(dir), why: `declared path ${engine.path}` }
            : { ok: false, dir, branch: null, why: `no clone at ${engine.path}` };
    }
    if (policy.search === 'siblings') {
        const direct = path.resolve(BASE, engine.path);
        return resolveCheckout({
            parent: path.dirname(direct),
            base: path.basename(direct),
            declared: policy.declared || null,
            branch: policy.branch || 'main',
            mustContain: policy.must_contain || []
        });
    }
    return { ok: false, dir: null, branch: null, why: `unknown checkout policy ${JSON.stringify(policy)}` };
}

function run(engine) {
    const required = isRequired(engine);
    const chosen = checkoutFor(engine);
    if (!chosen.ok) {
        return { id: engine.id, required, state: 'absent', detail: chosen.why, ms: 0, branch: chosen.branch || null };
    }
    const cwd = chosen.dir;
    const started = Date.now();
    const [command, ...args] = engine.command;
    const result = spawnSync(command, args, {
        cwd, encoding: 'utf8', shell: process.platform === 'win32', timeout: 15 * 60 * 1000
    });
    const ms = Date.now() - started;
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    /* The last line that says something. A gate's own summary is better
       evidence than anything this runner could invent about it. */
    const summary = output.trim().split('\n').filter(Boolean).slice(-1)[0] || '';
    if (result.error && result.error.code === 'ETIMEDOUT') {
        return { id: engine.id, required, state: 'timeout', detail: '15 minutes', ms, summary, checkout: path.basename(cwd), branch: chosen.branch };
    }
    return {
        id: engine.id,
        required,
        checkout: path.basename(cwd),
        branch: chosen.branch,
        state: result.status === 0 ? 'pass' : 'fail',
        code: result.status,
        ms,
        summary: summary.slice(0, 140)
    };
}

const MARK = { pass: 'ok  ', fail: 'FAIL', absent: 'GONE', timeout: 'TIME' };
const line = (o) => `${MARK[o.state]}  ${o.id.padEnd(26)} ${String(o.branch || '?').padEnd(24)} ${(o.ms / 1000).toFixed(1)}s  ${o.summary || o.detail || ''}`;

/* Blocking, not "failing": a required gate that is not there has told you
   nothing, and nothing is not permission to continue. */
const blocks = (r) => r.state === 'fail' || r.state === 'timeout' || (r.state === 'absent' && r.required);

const offline = registry.engines.filter((e) => !e.network);
const network = registry.engines.filter((e) => e.network);
const results = [];

console.log(`offline gates — ${offline.length}\n`);
for (const engine of offline) {
    const outcome = run(engine);
    results.push({ ...outcome, phase: 'offline' });
    console.log(line(outcome));
}

const offlineBlocking = results.filter(blocks);

if (withNetwork) {
    if (offlineBlocking.length) {
        const failed = offlineBlocking.filter((r) => r.state !== 'absent').length;
        const gone = offlineBlocking.filter((r) => r.state === 'absent').length;
        console.log(`\nnetwork gates NOT RUN — ${failed} offline gate(s) did not pass and ${gone} required gate(s) are not present.`);
        console.log('That ordering is the rule, not a convenience: a gate that needs the');
        console.log('network cannot tell you anything when the network is what has changed.');
        console.log('An absent gate blocks for the same reason a failing one does — it has');
        console.log('not told you the thing you were going to rely on.');
        for (const r of offlineBlocking) console.log(`      ${r.id}: ${r.state} — ${r.detail || r.summary || ''}`);
    } else {
        console.log(`\nnetwork gates — ${network.length}\n`);
        for (const engine of network) {
            const outcome = run(engine);
            results.push({ ...outcome, phase: 'network' });
            console.log(line(outcome));
            if (engine.known_constraint) console.log(`      note: ${engine.known_constraint}`);
        }
    }
}

const passed = results.filter((r) => r.state === 'pass').length;
const absent = results.filter((r) => r.state === 'absent').length;
const absentRequired = results.filter((r) => r.state === 'absent' && r.required).length;
const failed = results.filter((r) => r.state === 'fail' || r.state === 'timeout').length;
const blocking = results.filter(blocks).length;

const report = {
    schema: 'globalgrid2050.testcode.run.v2',
    generated_utc: new Date().toISOString(),
    registry: path.relative(ROOT, registryPath).replace(/\\/g, '/') || path.basename(registryPath),
    ran_network: withNetwork && !offlineBlocking.length,
    counts: { passed, failed, absent, absent_required: absentRequired, blocking },
    results
};
writeFileSync(path.join(process.cwd(), 'testcode-run.json'), JSON.stringify(report, null, 2) + '\n');

console.log(`\n${passed} passed · ${failed} failed · ${absent} not present (${absentRequired} of them required)`);
if (absent) {
    console.log('A gate that is not present has not passed. It is reported as absent,');
    console.log('never counted as green — a skip is not a pass — and while it is');
    console.log('required its absence blocks the run and the exit code, exactly as a');
    console.log('failure does.');
}
console.log(`${blocking} blocking`);
process.exit(blocking ? 1 : 0);
