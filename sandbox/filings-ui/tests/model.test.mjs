/** Synthetic UI contract tests; root fixtures were validated by pinned Python FIGURES. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildViewModel, FigureModelError, MAX_CLAIMS } from '../model.mjs';

const fixtures = JSON.parse(readFileSync(new URL('../fixtures.json', import.meta.url), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const finance = () => clone(fixtures.cases.finance);
const energy = () => clone(fixtures.cases.energy);
function reject(change, base = finance) {
  const input = base(); change(input, input.claims[0]);
  assert.throws(() => buildViewModel(input), FigureModelError);
}

test('every pinned Python-valid case is consumed with exact unchanged claims', () => {
  assert.equal(fixtures.contract.commit, 'e0deabac45d35240f6c38f4303b8d50c90412e06');
  assert.equal(fixtures.contract.sha256, '7db9f5334529bd51e3d1dc64abbd7ec0180b69e832c196d37cc93caf09e133c2');
  for (const input of Object.values(fixtures.cases)) {
    const model = buildViewModel(input);
    assert.deepEqual(model.rows.map(row => row.claim), input.claims);
    assert.equal(model.entityId, input.entityId);
    assert.equal(model.publishable, false);
  }
});

test('decimal precision beyond safe integers and trailing zeros survive display', () => {
  const model = buildViewModel(finance());
  assert.equal(model.rows[0].display.amount, '9007199254740993.1200 USD');
  assert.equal(model.rows[1].display.amount, '1.20 × 1e9 USD');
  assert.equal(model.rows[1].claim.original_unit, 'billion USD');
});

test('numeric floats, nonfinite, exponent and ambiguous decimal strings fail', () => {
  for (const value of [1.2, 1, true, null, 'NaN', 'Infinity', '1e9', '1,200', '01.2', '.2', '1.', ' 1.20', '1.20\n', '9'.repeat(101)]) {
    reject((_, c) => { c.value = value; });
  }
});

test('funding stages stay distinct and never become paid by inference', () => {
  for (const stage of ['announced', 'committed', 'disbursed', 'reported']) {
    const input = finance(); input.claims[0].finance_stage = stage;
    const row = buildViewModel(input).rows[0];
    assert.equal(row.claim.finance_stage, stage);
    assert.equal(row.display.financeStage.toLowerCase(), stage);
  }
  reject((_, c) => { c.finance_stage = 'funded'; });
});

test('power energy finance and type labels cannot be interchanged', () => {
  const model = buildViewModel(energy());
  assert.equal(model.rows[0].display.amount, '480.00 MW');
  assert.equal(model.rows[0].display.quantityKind, 'Project demand');
  assert.equal(model.rows[1].display.amount, '10.50 MWh');
  assert.equal(model.rows[1].display.quantityKind, 'Storage energy');
  reject((_, c) => { c.unit = 'MWh'; }, energy);
  reject((_, c) => { c.unit = 'MW'; });
  reject((_, c) => { c.currency = 'USD'; }, energy);
});

test('negative reported finance and signed zero preserve source lexical precision', () => {
  const input = finance(); input.claims[0].value = '-12345678901234567890.00100';
  assert.equal(buildViewModel(input).rows[0].claim.value, '-12345678901234567890.00100');
  const zero = energy(); zero.claims[0].value = '-0.00';
  assert.equal(buildViewModel(zero).rows[0].display.amount, '-0.00 MW');
  reject((_, c) => { c.value = '-0.01'; }, energy);
});

test('entity binding is exact and group figures are not assigned to a site', () => {
  reject(input => { input.entityId = 'site:synthetic'; });
  reject((_, c) => { c.entity.id = 'group:similar-name'; });
  reject((_, c) => { c.entity.consolidation_group_id = 'group:other'; });
  const model = buildViewModel(finance());
  assert.equal(model.rows[0].display.entityScope, 'Consolidated group');
  assert.equal(Object.hasOwn(model, 'total'), false);
});

test('unsafe and ambiguous source links fail before any model is returned', () => {
  for (const url of ['javascript:alert(1)', 'http://example.org/a', 'https://user:pass@example.org/a',
    'https://example.org:8443/a', 'https://localhost/a', 'https://127.1/a', 'https://2130706433/a',
    'https://0x7f000001/a', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://224.0.0.1/a',
    'https://example.internal/a', 'https://example.org\\@evil.org/a', 'https://exam ple.org/a',
    'https://%65xample.org/a']) {
    reject((_, c) => { c.provenance.document_url = url; });
  }
  reject((_, c) => { c.entity.identity_evidence_url = 'https://127.1/a'; });
});

test('explicit HTTPS443 and source anchors remain unchanged; IP-literal subset is unsupported', () => {
  const input = finance(); input.claims[0].provenance.document_url = 'https://EXAMPLE.org:443/report#page=12';
  assert.equal(buildViewModel(input).rows[0].claim.provenance.document_url, 'https://EXAMPLE.org:443/report#page=12');
  reject((_, c) => { c.provenance.document_url = 'https://8.8.8.8/document'; });
});

test('source date precision is retained with timezone-local retrieval comparison', () => {
  const input = finance(); const c = input.claims[0];
  c.provenance.retrieved_at = '2026-11-16T00:30:00+08:00';
  c.provenance.published_date = '2026-11-16';
  const row = buildViewModel(input).rows[0];
  assert.equal(row.display.retrievedAt, '2026-11-16T00:30:00+08:00');
  assert.equal(row.display.period, '2027');
  reject((_, c) => { c.provenance.retrieved_at = '2026-11-15T16:30:00Z'; });
});

test('invalid calendar dates timezone offsets and final newlines are rejected', () => {
  for (const value of ['2026-02-30', '0000', '2026-13', '2026-1', '2026-11-16\n']) {
    reject((_, c) => { c.as_of = value; });
  }
  for (const value of ['2026-11-16', '2026-11-16T12:00:00', '2026-11-16T24:00:00Z',
    '2026-11-16T12:00:00+24:00', '2026-11-16T12:00:00+01:60', '2026-11-16T12:00:00Z\n']) {
    reject((_, c) => { c.provenance.retrieved_at = value; });
  }
});

test('future periods require forecast and forecast is not an audited actual', () => {
  reject((_, c) => { c.basis = 'reported'; });
  reject((_, c) => { c.assurance = 'audited'; });
  const input = finance(); const c = input.claims[0];
  c.basis = 'reported'; c.assurance = 'audited'; c.reporting_period = {start: '2026-01', end: '2026-09'};
  const row = buildViewModel(input).rows[0];
  assert.equal(row.display.basis, 'Reported');
  assert.equal(row.display.assurance, 'Audited (source assertion)');
  assert.match(row.display.status, /not independently verified/);
});

test('missing quantity fails while absent optional dates display Unknown', () => {
  reject((_, c) => { c.value = null; });
  const input = finance(); const c = input.claims[0]; c.as_of = null; c.provenance.published_date = null;
  const row = buildViewModel(input).rows[0];
  assert.equal(row.display.asOf, 'Unknown'); assert.equal(row.display.publishedDate, 'Unknown');
  reject((_, c) => { c.as_of = null; c.reporting_period = null; });
});

test('source page section hash and revision are preserved with explicit supersession', () => {
  const input = finance(); const c = input.claims[0];
  c.revision = {id: 'r2', supersedes_claim_id: 'fixture:previous', restated: true};
  c.provenance.page = '12'; c.provenance.section = 'Capital allocation';
  const row = buildViewModel(input).rows[0];
  assert.equal(row.display.sourceLocator, 'Page 12 · Capital allocation');
  assert.equal(row.claim.provenance.sha256, c.provenance.sha256);
  assert.equal(row.display.revision, 'r2 · Restated · Supersedes fixture:previous');
  reject((_, c) => { c.revision.restated = true; });
  reject((_, c) => { c.revision.supersedes_claim_id = c.claim_id; });
});

test('forged verified status or missing source evidence cannot render', () => {
  reject((_, c) => { c.status = 'VERIFIED'; });
  reject((_, c) => { c.provenance.sha256 = null; });
  reject((_, c) => { c.provenance.sha256 += '\n'; });
  reject((_, c) => { c.provenance.page = null; c.provenance.section = null; });
});

test('duplicate claim IDs are rejected and caller order is retained without aggregation', () => {
  const input = finance();
  assert.deepEqual(buildViewModel(input).rows.map(r => r.id), input.claims.map(c => c.claim_id));
  reject(input => { input.claims.push(clone(input.claims[0])); });
});

test('bounded arrays reject oversized sparse and non-array input', () => {
  reject(input => { input.claims = null; });
  reject(input => { input.claims = new Array(1); });
  reject(input => { input.claims = Array.from({length: MAX_CLAIMS + 1}, (_, i) => ({...input.claims[0], claim_id: `fixture:${i}`})); });
});

test('unknown unavailable and available-empty are explicit distinct states', () => {
  for (const state of ['unknown', 'unavailable', 'available']) {
    const model = buildViewModel({entityId: 'issuer:synthetic', claims: [], state});
    assert.equal(model.state, state); assert.equal(model.rows.length, 0); assert.equal(model.publishable, false);
  }
  assert.match(buildViewModel(fixtures.cases.unknown).message, /does not mean zero/);
  assert.match(buildViewModel(fixtures.cases.unavailable).message, /does not mean zero/);
  assert.equal(buildViewModel({entityId: 'issuer:synthetic', claims: [], state: 'available'}).stateLabel, 'No figures supplied');
  reject(input => { input.state = 'unknown'; });
  reject(input => { input.state = 'unavailable'; });
  reject(input => { input.state = 'verified'; });
});

test('unknown fields and non-JSON data cannot slip into a render model', () => {
  reject(input => { input.extra = 'unapproved'; });
  reject((_, c) => { c.customer = 'private'; });
  reject((_, c) => { c.entity.extra = 'private'; });
  reject((_, c) => { Object.defineProperty(c, 'metric', {get: () => 'getter must not run', enumerable: true}); });
  reject(input => { Object.setPrototypeOf(input, {injected: true}); });
});

test('hostile markup remains literal data and all returned claims are detached', () => {
  const input = clone(fixtures.cases.hostile_text), before = clone(input);
  const model = buildViewModel(input);
  assert.equal(model.rows[0].claim.metric, input.claims[0].metric);
  assert.match(model.rows[0].claim.metric, /</);
  model.rows[0].claim.metric = 'changed';
  model.rows[0].claim.entity.id = 'changed';
  assert.deepEqual(input, before);
});

test('unknown kinds scales currencies and invalid identifier suffixes fail', () => {
  reject((_, c) => { c.quantity_kind = 'capacity'; });
  reject((_, c) => { c.scale = 1000; });
  reject((_, c) => { c.currency = 'US$'; });
  reject((_, c) => { c.currency = 'USD\n'; });
  reject((_, c) => { c.claim_id += '\n'; });
  reject(input => { input.entityId += '\n'; });
});

test('partial or reversed periods fail instead of inventing a reporting window', () => {
  reject((_, c) => { c.reporting_period = {start: '2026', end: '2026-09'}; });
  reject((_, c) => { c.reporting_period = {start: '2026-10', end: '2026-09'}; });
  reject((_, c) => { c.reporting_period = {end: '2026-09'}; });
});

test('custom iterators cannot populate unknown state or bypass the 100-row bound', () => {
  let invoked = false;
  const empty = [];
  empty[Symbol.iterator] = function* () { invoked = true; yield finance().claims[0]; };
  assert.throws(() => buildViewModel({entityId: 'group:synthetic', claims: empty, state: 'unknown'}), FigureModelError);
  const short = [finance().claims[0]];
  short[Symbol.iterator] = function* () {
    invoked = true;
    for (let i = 0; i <= MAX_CLAIMS; i += 1) yield {...finance().claims[0], claim_id: `fixture:iterator:${i}`};
  };
  assert.throws(() => buildViewModel({entityId: 'group:synthetic', claims: short, state: 'available'}), FigureModelError);
  assert.equal(invoked, false, 'caller iterators must never execute');
});

test('array extra properties prototypes and accessors fail without executing caller code', () => {
  reject(input => { input.claims.extra = 'not JSON array data'; });
  reject(input => { input.claims[Symbol('extra')] = 'hidden'; });
  reject(input => { Object.setPrototypeOf(input.claims, Object.create(Array.prototype)); });
  let accessed = false;
  reject(input => {
    Object.defineProperty(input.claims, '0', {get() { accessed = true; return finance().claims[0]; }, enumerable: true});
  });
  assert.equal(accessed, false, 'index accessors must not execute');
});

test('Python strip-compatible NEL text boundaries fail while internal NEL stays literal', () => {
  reject((_, c) => { c.metric = '\u0085Synthetic metric'; });
  reject((_, c) => { c.metric = 'Synthetic metric\u0085'; });
  const input = finance(); input.claims[0].metric = 'Synthetic\u0085metric';
  assert.equal(buildViewModel(input).rows[0].claim.metric, 'Synthetic\u0085metric');
});
