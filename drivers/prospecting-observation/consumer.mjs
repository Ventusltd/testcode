#!/usr/bin/env node
/** Offline Node proof of the real UI adapter; this does not exercise a DOM. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SCHEMA = 'testcode.prospecting-consumer.v1';
const FLAGS = ['--adapter', '--artifact', '--expected', '--artifact-sha256'];
const EXPECTED_FIELDS = [
  'project_id', 'follow_up_points', 'observation_state', 'observed_at',
  'published_at', 'first_seen', 'source_fetched_at',
];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function configuration(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i], value = argv[i + 1];
    if (!FLAGS.includes(flag) || flag in args || !value || value.startsWith('--')) {
      throw new Error('invalid arguments');
    }
    args[flag] = value;
  }
  if (!FLAGS.every(flag => flag in args) || !/^[a-f0-9]{64}$/.test(args['--artifact-sha256'])) {
    throw new Error('missing arguments or invalid digest');
  }
  return args;
}

function expectedValues(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).length !== EXPECTED_FIELDS.length
      || !EXPECTED_FIELDS.every(key => Object.hasOwn(value, key))) return false;
  if (typeof value.project_id !== 'string' || !value.project_id || value.project_id.length > 128
      || !Number.isFinite(value.follow_up_points) || value.follow_up_points < 0
      || !['WITHIN_WINDOW', 'STALE'].includes(value.observation_state)) return false;
  return ['observed_at', 'published_at', 'first_seen', 'source_fetched_at'].every(key => {
    const stamp = value[key];
    if (typeof stamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(stamp)) return false;
    const parsed = new Date(stamp);
    return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 19) === stamp.slice(0, 19);
  });
}

export async function consume(argv) {
  const checks = [];
  const check = (name, pass) => checks.push({ name, pass: pass === true });
  const fail = (error_kind, code = 2) => ({ code, report: { schema: SCHEMA, pass: false, checks, error_kind } });
  let args;
  try { args = configuration(argv); } catch { return fail('CONFIGURATION_INVALID'); }

  let bytes, expected;
  try {
    bytes = await readFile(args['--artifact']);
    expected = JSON.parse(await readFile(args['--expected'], 'utf8'));
  } catch { return fail('INPUT_READ_FAILED'); }
  if (!expectedValues(expected)) return fail('EXPECTED_INVALID');

  // Install before import, so even adapter module initialization cannot fetch.
  // The pinned adapter is inspected offline; this guard is not an OS sandbox.
  const originalFetch = globalThis.fetch;
  let fetchAttempts = 0;
  globalThis.fetch = async () => {
    fetchAttempts += 1;
    throw new Error('offline fetch blocked');
  };
  try {
    let adapter;
    try { adapter = await import(pathToFileURL(resolve(args['--adapter'])).href); }
    catch {
      check('network_not_used', fetchAttempts === 0);
      return fail('ADAPTER_IMPORT_FAILED');
    }
    if (typeof adapter.parseArtifact !== 'function') return fail('ADAPTER_API_INVALID');

    const before = sha256(bytes);
    check('artifact_sha256', before === args['--artifact-sha256']);
    let model, raw;
    try {
      // The product's real parser validates the same bytes and caller-supplied SHA.
      model = await adapter.parseArtifact(bytes, args['--artifact-sha256']);
      raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      check('ui_adapter_accepts_artifact', true);
    } catch {
      check('ui_adapter_accepts_artifact', false);
      check('network_not_used', fetchAttempts === 0);
      return fail('ARTIFACT_REJECTED', 1);
    }

    const rows = Array.isArray(model?.records) ? model.records.filter(row => row?.id === expected.project_id) : [];
    const rawRows = Array.isArray(raw?.records) ? raw.records.filter(row => row?.id === expected.project_id) : [];
    check('project_row_unique', rows.length === 1);
    check('raw_project_row_unique', rawRows.length === 1);
    const row = rows.length === 1 ? rows[0] : null;
    const rawRow = rawRows.length === 1 ? rawRows[0] : null;
    const reasons = Array.isArray(row?.reasons) ? row.reasons.filter(reason => reason?.name === 'research_follow_up') : [];
    check('research_follow_up_points', reasons.length === 1 && reasons[0].points === expected.follow_up_points);

    // expected.json identifies one article by its containing project. Refuse
    // ambiguous evidence instead of making a passing claim about only a subset.
    const evidence = Array.isArray(row?.evidence) ? row.evidence : [];
    const rawEvidence = Array.isArray(rawRow?.evidence) ? rawRow.evidence : [];
    check('view_evidence_unique', evidence.length === 1);
    check('raw_evidence_unique', rawEvidence.length === 1);
    const article = evidence.length === 1 ? evidence[0] : null;
    const original = rawEvidence.length === 1 ? rawEvidence[0] : null;
    check('observation_state', article?.retrieval_freshness?.state === expected.observation_state);
    check('observed_at', article?.retrieval_freshness?.timestamp === expected.observed_at);
    check('published_at', article?.pub_date === expected.published_at);
    check('raw_published_at', original?.pub_date === expected.published_at);
    check('first_seen_preserved', original?.first_seen === expected.first_seen);
    check('source_fetched_at_preserved', original?.source?.fetched_at === expected.source_fetched_at);
    check('last_seen_preserved', original?.last_seen === expected.observed_at);
    check('artifact_bytes_unchanged', sha256(bytes) === before);
    check('network_not_used', fetchAttempts === 0);
    const pass = checks.every(result => result.pass);
    return { code: pass ? 0 : 1, report: { schema: SCHEMA, pass, checks } };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let result;
  try { result = await consume(process.argv.slice(2)); }
  catch { result = { code: 2, report: { schema: SCHEMA, pass: false, checks: [], error_kind: 'CONSUMER_FAILED' } }; }
  // Never serialize exception messages, local paths, raw inputs or stack traces.
  process.stdout.write(`${JSON.stringify(result.report)}\n`);
  process.exitCode = result.code;
}
