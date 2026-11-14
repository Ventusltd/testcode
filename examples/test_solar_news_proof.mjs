import test from 'node:test';
import assert from 'node:assert/strict';
import { audit, dateDay } from '../drivers/solar-news-proof.mjs';

const NOW = new Date('2026-11-14T13:00:00Z');
function fixtures() {
  const top = Array.from({ length: 200 }, (_, i) => ({ repd_ref: String(10000 + i) }));
  const projects = Object.fromEntries(top.map(r => [r.repd_ref, {
    repd_ref: r.repd_ref, signals: [],
    planning_file: { url: 'https://www.gov.uk/search-register-planning-decisions',
      kind: 'search_page', verified: false }
  }]));
  projects['10000'].signals = [{
    repd_ref: '10000', title: 'Botley West solar decision',
    link: 'https://www.solarpowerportal.co.uk/solar-projects/example',
    publisher: 'Solar Power Portal', date: '2026-11-11',
    family: 'trade', confidence: 'confirmed', basis: 'Botley West exact alias'
  }];
  const candidate = {
    schema: 'project-signals.v1', generated_at: '2026-11-14T12:30:00Z',
    counts: { projects: 200 },
    sources: [{ team: 'trade', id: 'solar-power-portal', status: 'ok' }],
    projects
  };
  return { top, candidate };
}

test('calendar parser refuses impossible dates, not mere prefixes', () => {
  assert.equal(dateDay('2026-02-30'), null);
  assert.equal(dateDay('2026-99-01'), null);
  assert.equal(dateDay('2026-11-14abc'), null);
  assert.notEqual(dateDay('2026-11-14'), null);
});

test('valid exactly 200 canonical refs and dated fresh article pass structural gate', () => {
  const { top, candidate } = fixtures();
  const r = audit(top, candidate, null, NOW);
  assert.equal(r.status, 'PASS', r.errors.join('; '));
  assert.equal(r.facts.projects, 200);
  assert.equal(r.facts.search_fallbacks, 200);
  assert.equal(r.facts.recent_nonreviewed_news, 1);
});

test('201st or swapped identity is not an acceptable top-200', () => {
  const { top, candidate } = fixtures();
  delete candidate.projects['10001'];
  candidate.projects['999999'] = { repd_ref: '999999', signals: [],
    planning_file: { url: 'https://www.gov.uk/search-register-planning-decisions', kind: 'search_page', verified: false }};
  assert.equal(Object.keys(candidate.projects).length, 200);
  assert.equal(audit(top, candidate, null, NOW).status, 'FAIL');
});

test('article with impossible or future calendar date fails closed', () => {
  for (const bad of ['2026-02-30', '2026-11-15', '2026-11-14garbage']) {
    const { top, candidate } = fixtures();
    candidate.projects['10000'].signals[0].date = bad;
    assert.equal(audit(top, candidate, null, NOW).status, 'FAIL', bad);
  }
});

test('unchanged link with refreshed timestamp is not fresh news', () => {
  const { top, candidate } = fixtures();
  const previous = structuredClone(candidate);
  previous.generated_at = '2026-11-13T15:00:00Z';
  const r = audit(top, candidate, previous, NOW);
  assert.equal(r.status, 'FAIL');
  assert(r.errors.some(s => s.includes('refreshed generated_at')));
});

test('failed entire source ledger and invalid planning verification fail closed', () => {
  const { top, candidate } = fixtures();
  candidate.sources[0].status = 'failed';
  candidate.projects['10002'].planning_file.verified = true;
  const r = audit(top, candidate, null, NOW);
  assert.equal(r.status, 'FAIL');
  assert(r.errors.some(s => s.includes('no successful')));
  assert(r.errors.some(s => s.includes('generic planning search')));
});

test('one article about two distinct projects is flagged but not automatically erased', () => {
  const { top, candidate } = fixtures();
  const next = structuredClone(candidate.projects['10000'].signals[0]);
  next.repd_ref = '10001';
  candidate.projects['10001'].signals = [next];
  const r = audit(top, candidate, null, NOW);
  assert.equal(r.status, 'PASS', r.errors.join('; '));
  assert.equal(r.facts.cross_project_article_urls, 1);
  assert(r.warnings.some(s => s.includes('event-level')));
});

test('undeclared source rights are not called verified by this proof', () => {
  const { top, candidate } = fixtures();
  const r = audit(top, candidate, null, NOW);
  assert(r.warnings.some(s => s.includes('licences')));
});
