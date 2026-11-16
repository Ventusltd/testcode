/**
 * Point TESTCODE_PROSPECTING_UI_DIR at automation/news/prospecting-ui extracted
 * from the driver's pinned public UI commit. No copied adapter or fixture bodies.
 * Missing inputs fail; these are Node consumer tests, not browser/device tests.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const consumer = join(dirname(fileURLToPath(import.meta.url)), 'consumer.mjs');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const observed = '2026-11-16T18:00:00Z';
const original = '2026-10-01T18:00:00Z';
let directory, adapter, fixture, articleFixture;

before(async () => {
  const ui = process.env.TESTCODE_PROSPECTING_UI_DIR;
  assert.ok(ui, 'TESTCODE_PROSPECTING_UI_DIR must identify the pinned UI archive');
  adapter = join(resolve(ui), 'adapter.mjs');
  // The real committed producer fixtures are inputs; absence is never skipped.
  const fixtures = await import(pathToFileURL(join(resolve(ui), 'tests', 'fixture.mjs')).href);
  fixture = fixtures.fixture;
  articleFixture = fixtures.article;
  assert.equal(typeof fixture, 'function');
  assert.equal(typeof articleFixture, 'function');
  await readFile(adapter);
  directory = await mkdtemp(join(tmpdir(), 'testcode-prospecting-consumer-'));
});
after(async () => {
  if (directory) {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('testcode-prospecting-consumer-'));
    await rm(directory, { recursive: true, force: true });
  }
});

function scenario() {
  const payload = fixture();
  const project = payload.records.find(row => row.id === 'REPD-1018');
  const article = articleFixture();
  article.pub_date = original;
  article.first_seen = original;
  article.source.fetched_at = original;
  article.last_seen = observed;
  article.freshness = { state: 'STALE', basis: 'publication time', timestamp: original, age_days: 46 };
  article.retrieval_freshness = { state: 'WITHIN_WINDOW', basis: 'latest accepted observation', timestamp: observed, age_days: 0 };
  project.evidence = [article];
  project.research_state = 'PROVISIONAL';
  const reason = project.reasons.find(item => item.name === 'research_follow_up');
  project.score += 5 - reason.points;
  reason.points = 5;
  Object.assign(payload.input_receipts.find(receipt => receipt.id === 'news_evidence'), {
    state: 'PROVISIONAL', sha256: 'b'.repeat(64), rights_state: 'ACCEPTED_RECEIPTS_SUPPLIED',
    generated_at: observed, source_run_at: observed,
    freshness: { state: 'WITHIN_WINDOW', basis: 'source run time', timestamp: observed, age_days: 0 },
  });
  return {
    payload,
    expected: {
      project_id: project.id, project_present: true, follow_up_points: 5, observation_state: 'WITHIN_WINDOW',
      observed_at: observed, published_at: original, first_seen: original, source_fetched_at: original,
    },
  };
}

async function invoke({ payload, expected }, options = {}) {
  const label = createHash('sha256').update(JSON.stringify({ payload, expected, options })).digest('hex');
  const artifact = join(directory, `${label}.artifact.json`);
  const expectedFile = join(directory, `${label}.expected.json`);
  const bytes = Buffer.from(JSON.stringify(payload));
  await writeFile(artifact, bytes);
  await writeFile(expectedFile, JSON.stringify(expected));
  const args = [consumer, '--adapter', options.adapter || adapter, '--artifact', artifact,
    '--expected', expectedFile, '--artifact-sha256', options.sha || sha256(bytes)];
  if (options.omitArtifact) args.splice(args.indexOf('--artifact'), 2);
  if (options.missingArtifact) args[args.indexOf('--artifact') + 1] = join(directory, 'private-path-must-not-be-reported.json');
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.error, undefined, 'consumer process must start and complete');
  assert.equal(result.stderr, '', 'consumer must not expose exception output');
  const report = JSON.parse(result.stdout);
  assert.equal(report.schema, 'testcode.prospecting-consumer.v1');
  assert.equal(result.stdout.includes(directory), false, 'report must not contain local paths');
  assert.equal(result.stdout.includes('TEST ONLY'), false, 'report must not contain source input');
  return { status: result.status, report };
}

test('real adapter preserves distinct original and latest-observation clocks', async () => {
  const { status, report } = await invoke(scenario());
  assert.equal(status, 0);
  assert.equal(report.pass, true);
  assert.ok(report.checks.length >= 15);
  assert.ok(report.checks.every(check => check.pass));
});

function removeTarget(input) {
  input.payload.records = input.payload.records.filter(row => row.id !== input.expected.project_id);
  input.payload.records.forEach((row, index) => { row.rank = index + 1; });
  input.payload.returned_count = input.payload.records.length;
}

test('correctly excluded project passes without claiming UI article-clock coverage', async () => {
  const input = scenario();
  input.expected.project_present = false;
  removeTarget(input);
  const { status, report } = await invoke(input);
  assert.equal(status, 0);
  assert.equal(report.pass, true);
  assert.deepEqual(report.checks.map(check => check.name), [
    'artifact_sha256', 'ui_adapter_accepts_artifact', 'project_membership',
    'raw_project_membership', 'artifact_bytes_unchanged', 'network_not_used',
  ]);
  assert.ok(report.checks.every(check => check.pass));
});

test('unexpected promotion fails even when all article clocks and scores match', async () => {
  const input = scenario();
  input.expected.project_present = false;
  const { status, report } = await invoke(input);
  assert.equal(status, 1);
  assert.equal(report.pass, false);
  assert.deepEqual(report.checks.filter(check => !check.pass).map(check => check.name), [
    'project_membership', 'raw_project_membership',
  ]);
});

test('unexpected exclusion fails when project presence is required', async () => {
  const input = scenario();
  removeTarget(input);
  const { status, report } = await invoke(input);
  assert.equal(status, 1);
  assert.equal(report.pass, false);
  assert.equal(report.checks.find(check => check.name === 'ui_adapter_accepts_artifact')?.pass, true);
  assert.equal(report.checks.find(check => check.name === 'project_membership')?.pass, false);
  assert.equal(report.checks.find(check => check.name === 'raw_project_membership')?.pass, false);
});

const mutations = {
  research_follow_up_points(payload) {
    const row = payload.records[0];
    row.reasons.find(reason => reason.name === 'research_follow_up').points = 0;
    row.score -= 5; // Remains schema-valid: the semantic comparison must catch it.
  },
  observed_at(payload) {
    payload.records[0].evidence[0].retrieval_freshness = {
      state: 'STALE', basis: 'wrong original receipt clock', timestamp: original, age_days: 46,
    };
  },
  published_at(payload) {
    const item = payload.records[0].evidence[0];
    item.pub_date = '2026-10-02T18:00:00Z';
    item.freshness.timestamp = item.pub_date;
    item.freshness.age_days = 45;
  },
  first_seen_preserved(payload) { payload.records[0].evidence[0].first_seen = observed; },
  source_fetched_at_preserved(payload) { payload.records[0].evidence[0].source.fetched_at = observed; },
  last_seen_preserved(payload) { payload.records[0].evidence[0].last_seen = original; },
};
for (const [name, mutate] of Object.entries(mutations)) {
  test(`detects schema-valid artifact mutation: ${name}`, async () => {
    const input = scenario();
    mutate(input.payload);
    const { status, report } = await invoke(input);
    assert.equal(status, 1);
    assert.equal(report.pass, false);
    assert.equal(report.checks.find(check => check.name === 'ui_adapter_accepts_artifact')?.pass, true);
    assert.equal(report.checks.find(check => check.name === name)?.pass, false);
  });
}

test('missing CLI input fails with sanitized configuration error', async () => {
  const { status, report } = await invoke(scenario(), { omitArtifact: true });
  assert.equal(status, 2);
  assert.equal(report.pass, false);
  assert.equal(report.error_kind, 'CONFIGURATION_INVALID');
});
test('unavailable artifact fails without reporting its local path', async () => {
  const { status, report } = await invoke(scenario(), { missingArtifact: true });
  assert.equal(status, 2);
  assert.equal(report.error_kind, 'INPUT_READ_FAILED');
});
test('SHA mismatch fails in the actual product parser', async () => {
  const { status, report } = await invoke(scenario(), { sha: '0'.repeat(64) });
  assert.equal(status, 1);
  assert.equal(report.error_kind, 'ARTIFACT_REJECTED');
  assert.equal(report.checks.find(check => check.name === 'artifact_sha256')?.pass, false);
  assert.equal(report.checks.find(check => check.name === 'ui_adapter_accepts_artifact')?.pass, false);
});
test('failed adapter import is sanitized', async () => {
  const { status, report } = await invoke(scenario(), { adapter: join(directory, 'private-import-path.mjs') });
  assert.equal(status, 2);
  assert.equal(report.error_kind, 'ADAPTER_IMPORT_FAILED');
});
test('a caught fetch attempt during adapter import still fails the offline proof', async () => {
  const wrapper = join(directory, 'fetch-attempt.mjs');
  await writeFile(wrapper, `try { await fetch('https://example.org/offline-test'); } catch {}\nexport { parseArtifact } from ${JSON.stringify(pathToFileURL(adapter).href)};\n`);
  const { status, report } = await invoke(scenario(), { adapter: wrapper });
  assert.equal(status, 1);
  assert.equal(report.pass, false);
  assert.equal(report.checks.find(check => check.name === 'network_not_used')?.pass, false);
  assert.equal(report.checks.find(check => check.name === 'ui_adapter_accepts_artifact')?.pass, true);
});
