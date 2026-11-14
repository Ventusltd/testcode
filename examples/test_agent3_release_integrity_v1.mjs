import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256, parseCsv, auditOfficialCsv, auditBinary,
  auditReleaseTrees, auditAcceptance, offlineAudit, PINS, REQUIRED_GATES
} from '../drivers/agent3-release-integrity-v1.mjs';

const HEAD = 'a'.repeat(40), RECEIPT = 'b'.repeat(64);
const csv = Buffer.from(
  'Ref ID,Latitude,Longitude\r\n7679,51.5,-0.1\r\n7679,51.5,-0.1\r\n15915,52.3,0.4\r\n');
const spec = { sha256: sha256(csv), bytes: csv.length, rows: 3,
  columns: 3, unique_refs: 2, duplicate_ref: '7679' };
const xlsx = Buffer.from('fixture-zip-xlsx-bytes');
const xspec = { sha256: sha256(xlsx), bytes: xlsx.length };
const tinyPins = {
  official_csv: { sha256: spec.sha256 }, official_xlsx: { sha256: xspec.sha256 },
  trees: { 'uk_renewables_pipeline/202609082224': HEAD,
    'uk_renewables_pipeline/202611132345': 'c'.repeat(40),
    'uk_renewables_pipeline/202611140306': 'd'.repeat(40) },
  operative_id: '202611140306', published_rows: 7775
};
const trees = structuredClone(tinyPins.trees);
const versions = { release_candidate: { operative: { id: '202611140306' } } };
const allEvidence = () => {
  const e = Object.fromEntries(REQUIRED_GATES.map(name => [name, {
    status: 'PASS', receipt_sha256: RECEIPT, commit_sha: HEAD,
    independent_reviewer: 'independent-engineering-reviewer'
  }]));
  Object.assign(e.source_provenance, {
    official_csv_sha256: tinyPins.official_csv.sha256,
    official_xlsx_sha256: tinyPins.official_xlsx.sha256
  });
  Object.assign(e.publisher_rights, {
    unverified_sources: 0, licence_review: 'independent'
  });
  e.integrated_ci.required_jobs = [{
    status: 'completed', conclusion: 'success', sha: HEAD,
    warning_only: false, skipped: false
  }];
  Object.assign(e.browser_1440, { width: 1440, js_errors: 0, real_browser: true });
  Object.assign(e.browser_390, { width: 390, js_errors: 0, real_browser: true });
  Object.assign(e.csv_export, { downloaded: true, rows: 7775, unique_repd_refs: 7775 });
  Object.assign(e.map_click, { clicked: true, receiver_verified: true, wrong_repd_refs: 0 });
  Object.assign(e.public_served_bytes, { expected_sha256: RECEIPT,
    served_sha256: RECEIPT, http_status: 200 });
  Object.assign(e.rollback, { dry_run: true, previous_pointer: tinyPins.operative_id,
    restored_tree: tinyPins.trees['uk_renewables_pipeline/202611140306'],
    historical_files_untouched: true });
  return e;
};

test('parser handles quoted multiline fields and retains raw record boundaries', () => {
  const rows = parseCsv('Ref ID,Name\r\n1,"Line one\nLine two"\r\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[1].cells[1], 'Line one\nLine two');
});

test('valid pinned 3-row fixture including identical 7679 duplicate PASS', () => {
  const r = auditOfficialCsv(csv, spec);
  assert.equal(r.status, 'PASS', r.errors.join('; '));
  assert.equal(r.observations.unique_refs, 2);
  assert.deepEqual(r.observations.duplicate_refs, ['7679']);
});

test('official CSV byte replacement is NOT accepted merely because counts match', () => {
  const bad = Buffer.from(csv.toString().replace('52.3', '53.3'));
  const r = auditOfficialCsv(bad, spec);
  assert.equal(r.observations.rows, 3);
  assert.equal(r.status, 'FAIL');
  assert(r.errors.some(s => s.includes('SHA256')));
});

test('fabricated Ref15915 value cannot receive a global exception', () => {
  const bad = Buffer.from(csv.toString().replace('15915,52.3', '15915,98.3'));
  const r = auditOfficialCsv(bad, { ...spec, sha256: sha256(bad), bytes: bad.length });
  assert.equal(r.status, 'FAIL');
  assert(r.errors.some(s => s.includes('coordinate')));
});

test('unapproved duplicate 15915 fails even under recomputed local SHA', () => {
  const bad = Buffer.from(csv.toString() + '15915,52.3,0.4\r\n');
  const r = auditOfficialCsv(bad, { ...spec, sha256: sha256(bad), bytes: bad.length,
    rows: 4, unique_refs: 2 });
  assert.equal(r.status, 'FAIL');
  assert(r.errors.some(s => s.includes('undocumented duplicate')));
});

test('same ID with a different row is not the documented identical duplicate', () => {
  const bad = Buffer.from(csv.toString().replace('7679,51.5,-0.1\r\n7679,51.5,-0.1',
    '7679,51.5,-0.1\r\n7679,52.0,-0.1'));
  const r = auditOfficialCsv(bad, { ...spec, sha256: sha256(bad), bytes: bad.length });
  assert.equal(r.status, 'FAIL');
  assert(r.errors.some(s => s.includes('non-identical')));
});

test('missing source row is not silently deduplicated to expected count', () => {
  const bad = Buffer.from(csv.toString().replace('15915,52.3,0.4\r\n', ''));
  assert.equal(auditOfficialCsv(bad, spec).status, 'FAIL');
});

test('missing Ref ID column fails, even with recomputed hash', () => {
  const bad = Buffer.from(csv.toString().replace('Ref ID,', 'Mystery,'));
  const r = auditOfficialCsv(bad, { ...spec, sha256: sha256(bad), bytes: bad.length });
  assert.equal(r.status, 'FAIL');
});

test('wrong number of CSV columns or malformed quotations fails closed', () => {
  const bad = Buffer.from(csv.toString().replace('15915,52.3,0.4', '15915,52.3'));
  const r = auditOfficialCsv(bad, { ...spec, sha256: sha256(bad), bytes: bad.length });
  assert.equal(r.status, 'FAIL');
  assert(r.errors.some(s => s.includes('column')));
  assert.throws(() => parseCsv('Ref ID,Name\n1,"unterminated'), /unterminated/);
});

test('official XLSX requires byte-for-byte independent SHA and byte size', () => {
  assert.equal(auditBinary(xlsx, xspec).status, 'PASS');
  assert.equal(auditBinary(Buffer.from('modified bytes'), xspec).status, 'FAIL');
});

test('three immutable Git trees and operative pointer PASS only when exact', () => {
  assert.equal(auditReleaseTrees(trees, versions, tinyPins).status, 'PASS');
  const changed = { ...trees, 'uk_renewables_pipeline/202611140306': '0'.repeat(40) };
  assert.equal(auditReleaseTrees(changed, versions, tinyPins).status, 'FAIL');
  const missing = { ...trees };
  delete missing['uk_renewables_pipeline/202609082224'];
  assert.equal(auditReleaseTrees(missing, versions, tinyPins).status, 'FAIL');
});

test('wrong live pointer to unverified V9.21 is not declared PASS', () => {
  const wrong = { release_candidate: { operative: { id: '202611141017' } } };
  assert.equal(auditReleaseTrees(trees, wrong, tinyPins).status, 'FAIL');
});

test('missing independent gate evidence is UNVERIFIED and cannot authorise publishing', () => {
  const r = auditAcceptance(null, tinyPins);
  assert.equal(r.status, 'UNVERIFIED');
  assert.equal(r.release_authorised, false);
  assert.equal(r.unverified.length, REQUIRED_GATES.length);
});

test('even fully synthetically filled evidence never authorises a release itself', () => {
  const r = auditAcceptance(allEvidence(), tinyPins);
  assert.equal(r.status, 'READY_FOR_INDEPENDENT_REVIEW');
  assert.equal(r.release_authorised, false);
});

test('unverified data-centre source rights veto acceptance', () => {
  const e = allEvidence();
  e.publisher_rights.unverified_sources = 258;
  const r = auditAcceptance(e, tinyPins);
  assert.equal(r.status, 'FAIL');
  assert(r.errors.some(s => s.includes('rights')));
});

test('skipped integrated acid test is FAIL, not green-with-warning', () => {
  const e = allEvidence();
  e.integrated_ci.required_jobs[0].conclusion = 'skipped';
  assert.equal(auditAcceptance(e, tinyPins).status, 'FAIL');
});

test('warning-only live CI is FAIL', () => {
  const e = allEvidence();
  e.integrated_ci.required_jobs[0].warning_only = true;
  assert.equal(auditAcceptance(e, tinyPins).status, 'FAIL');
});

test('zero completed integrated CI jobs cannot pass', () => {
  const e = allEvidence();
  e.integrated_ci.required_jobs = [];
  assert.equal(auditAcceptance(e, tinyPins).status, 'FAIL');
});

test('unreviewed source-rights gate does not become PASS', () => {
  const e = allEvidence();
  delete e.publisher_rights.independent_reviewer;
  assert.equal(auditAcceptance(e, tinyPins).status, 'UNVERIFIED');
});

test('publicly served bytes differ from pin: FAIL despite HTTP 200', () => {
  const e = allEvidence();
  e.public_served_bytes.served_sha256 = 'c'.repeat(64);
  assert.equal(auditAcceptance(e, tinyPins).status, 'FAIL');
});

test('missing mobile browser proof is UNVERIFIED', () => {
  const e = allEvidence();
  delete e.browser_390;
  assert.equal(auditAcceptance(e, tinyPins).status, 'UNVERIFIED');
});

test('CSV link without a real downloaded 7,775-unique-Ref file fails', () => {
  const e = allEvidence();
  e.csv_export.downloaded = false;
  assert.equal(auditAcceptance(e, tinyPins).status, 'FAIL');
});

test('MAP returns 200 but wrong receiving engine identity fails', () => {
  const e = allEvidence();
  e.map_click.receiver_verified = false;
  assert.equal(auditAcceptance(e, tinyPins).status, 'FAIL');
});

test('rollback changed the original release tree: FAIL', () => {
  const e = allEvidence();
  e.rollback.restored_tree = 'f'.repeat(40);
  assert.equal(auditAcceptance(e, tinyPins).status, 'FAIL');
});

test('missing official source is an error, never a silent pass', () => {
  assert.throws(() => auditOfficialCsv(null, spec));
});

test('rehearsal offline report remains publication HOLD despite local PASS', () => {
  // This test is deliberately synthetic, not the 5.2MB official intake.
  const r = auditOfficialCsv(csv, spec);
  assert.equal(r.status, 'PASS');
  assert.equal(auditAcceptance(null, tinyPins).status, 'UNVERIFIED');
  assert.equal(PINS.official_csv.rows, 14968);
  assert.equal(PINS.official_csv.columns, 53);
});
