/* run.mjs — the estate's test engine. Offline first, always.
 *
 *   node run.mjs                 offline gates only. This is the default,
 *                                because this is the one that must pass before
 *                                anything else is allowed to happen.
 *   node run.mjs --with-network  offline gates, then the network ones, and only
 *                                if every offline gate passed.
 *   node run.mjs --list          what is registered, and what is not green.
 *
 * The ordering is the point, and it is enforced here rather than described:
 * a network gate cannot run until every offline gate has passed, because a
 * gate that needs the network cannot tell you anything when the network is
 * what has changed.
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
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(readFileSync(path.join(ROOT, 'engines.json'), 'utf8'));

const withNetwork = process.argv.includes('--with-network');
const listOnly = process.argv.includes('--list');

if (listOnly) {
    console.log(`${registry.engines.length} gates registered\n`);
    for (const e of registry.engines) {
        console.log(`${e.network ? 'network' : 'offline'}  ${e.id.padEnd(28)} ${e.repo}`);
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

   So: when a sibling checkout of the same repository is on main, prefer it,
   and record the branch in the result. */
function resolveCheckout(engine) {
    const direct = path.resolve(ROOT, engine.path);
    const parent = path.dirname(direct);
    const base = path.basename(direct);
    let candidates = [];
    try {
        candidates = readdirSync(parent)
            .filter((name) => name === base || name.startsWith(`${base}-`))
            .map((name) => path.join(parent, name))
            .filter((dir) => existsSync(path.join(dir, '.git')) || existsSync(dir));
    } catch { candidates = [direct]; }
    if (!candidates.length) candidates = [direct];
    const withBranch = candidates.map((dir) => ({ dir, branch: branchOf(dir) }));
    const chosen = withBranch.find((c) => c.branch === 'main') || withBranch[0];
    return chosen;
}

function branchOf(dir) {
    const result = spawnSync('git', ['branch', '--show-current'],
        { cwd: dir, encoding: 'utf8', shell: process.platform === 'win32' });
    return (result.stdout || '').trim();
}

function run(engine) {
    const chosen = resolveCheckout(engine);
    const cwd = chosen.dir;
    if (!existsSync(cwd)) {
        return { id: engine.id, state: 'absent', detail: `no clone at ${engine.path}`, ms: 0 };
    }
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
        return { id: engine.id, state: 'timeout', detail: '15 minutes', ms, summary, checkout: path.basename(cwd), branch: chosen.branch };
    }
    return {
        id: engine.id,
        checkout: path.basename(cwd),
        branch: chosen.branch,
        state: result.status === 0 ? 'pass' : 'fail',
        code: result.status,
        ms,
        summary: summary.slice(0, 140)
    };
}

const offline = registry.engines.filter((e) => !e.network);
const network = registry.engines.filter((e) => e.network);
const results = [];

console.log(`offline gates — ${offline.length}\n`);
for (const engine of offline) {
    const outcome = run(engine);
    results.push({ ...outcome, phase: 'offline' });
    const mark = { pass: 'ok  ', fail: 'FAIL', absent: 'skip', timeout: 'TIME' }[outcome.state];
    console.log(`${mark}  ${outcome.id.padEnd(26)} ${String(outcome.branch || '?').padEnd(24)} ${(outcome.ms / 1000).toFixed(1)}s  ${outcome.summary || outcome.detail || ''}`);
}

const offlineFailures = results.filter((r) => r.state === 'fail' || r.state === 'timeout');

if (withNetwork) {
    if (offlineFailures.length) {
        console.log(`\nnetwork gates NOT RUN — ${offlineFailures.length} offline gate(s) did not pass.`);
        console.log('That ordering is the rule, not a convenience: a gate that needs the');
        console.log('network cannot tell you anything when the network is what has changed.');
    } else {
        console.log(`\nnetwork gates — ${network.length}\n`);
        for (const engine of network) {
            const outcome = run(engine);
            results.push({ ...outcome, phase: 'network' });
            const mark = { pass: 'ok  ', fail: 'FAIL', absent: 'skip', timeout: 'TIME' }[outcome.state];
            console.log(`${mark}  ${outcome.id.padEnd(26)} ${String(outcome.branch || '?').padEnd(24)} ${(outcome.ms / 1000).toFixed(1)}s  ${outcome.summary || outcome.detail || ''}`);
            if (engine.known_constraint) console.log(`      note: ${engine.known_constraint}`);
        }
    }
}

const report = {
    schema: 'globalgrid2050.testcode.run.v1',
    generated_utc: new Date().toISOString(),
    ran_network: withNetwork && !offlineFailures.length,
    results
};
writeFileSync(path.join(process.cwd(), 'testcode-run.json'), JSON.stringify(report, null, 2) + '\n');

const passed = results.filter((r) => r.state === 'pass').length;
const absent = results.filter((r) => r.state === 'absent').length;
const failed = results.filter((r) => r.state === 'fail' || r.state === 'timeout').length;

console.log(`\n${passed} passed · ${failed} failed · ${absent} not present`);
if (absent) {
    console.log('A gate that is not present has not passed. It is reported as absent,');
    console.log('never counted as green — a skip is not a pass.');
}
process.exit(failed ? 1 : 0);
