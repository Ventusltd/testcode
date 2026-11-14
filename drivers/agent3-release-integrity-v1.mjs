#!/usr/bin/env node
/**
 * Agent 3 release integrity v1 — read-only, independent, fail-closed.
 * OFFLINE source bytes + Git trees are necessary, never sufficient, for release.
 * No fetch, deploy, pointer change, writer, or approval operation exists here.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PINS = Object.freeze({
  official_csv: {
    sha256: '48e76c49f33a1090e78108d1ea9bfe689b35963ea3be1bb4f6516d038a5ff862',
    bytes: 5219160, rows: 14968, columns: 53, unique_refs: 14967,
    duplicate_ref: '7679'
  },
  official_xlsx: {
    sha256: '87811e249395a05b223db6855952334f425e66cc9a2106caea0e38fd9e5037ea',
    bytes: 5378656
  },
  official_commit: '213d1a79e876d80775f1be50caec94a8c449e09b',
  historical_commit: '9092ff8a8fcd4c83191d00bc928377412ad05f42',
  trees: {
    'uk_renewables_pipeline/202609082224': '6247a0c3c00e8e88324d9ea55b22d67dbbb1be90',
    'uk_renewables_pipeline/202611132345': '0c7a4ed5ea369e4a4e71a45cfa6fe9c186fae773',
    'uk_renewables_pipeline/202611140306': '365d7df093368c39c3878daacf65449ba32e7267'
  },
  operative_id: '202611140306',
  published_rows: 7775
});

const HASH64 = /^[a-f0-9]{64}$/;
const HASH40 = /^[a-f0-9]{40}$/;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const verdict = errors => errors.length ? 'FAIL' : 'PASS';

// Strict RFC 4180-compatible CSV parsing: preserve literal raw record to
// distinguish an identical official duplicate from an invented same-ID row.
export function parseCsv(raw) {
  const s = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
  const records = [];
  let cells = [], field = '', quote = false, endedQuote = false, start = 0;
  const error = message => { throw new Error('CSV: ' + message); };
  const push = (end) => {
    cells.push(field);
    records.push({ cells, raw: s.slice(start, end) });
    cells = []; field = ''; start = end + 1; endedQuote = false;
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quote = false; endedQuote = true; }
      else field += ch;
      continue;
    }
    if (ch === ',' || ch === '\r' || ch === '\n') {
      if (ch === ',') { cells.push(field); field = ''; endedQuote = false; }
      else {
        const end = i;
        if (ch === '\r') {
          if (s[i + 1] !== '\n') error('bare CR');
          i++;
        }
        push(end);
        start = i + 1;
      }
    } else if (ch === '"' && field === '' && !endedQuote) {
      quote = true;
    } else if (ch === '"') {
      error('unescaped quote');
    } else if (endedQuote) {
      error('content after closing quote');
    } else {
      field += ch;
    }
  }
  if (quote) error('unterminated quoted field');
  if (field || cells.length || endedQuote) push(s.length);
  if (records.length && records[0].cells.length) {
    records[0].cells[0] = records[0].cells[0].replace(/^\uFEFF/, '');
  }
  return records;
}

export function auditOfficialCsv(bytes, spec = PINS.official_csv) {
  const errors = [], observations = {
    sha256: sha256(bytes), bytes: bytes.length, rows: null,
    columns: null, unique_refs: null, duplicate_refs: []
  };
  if (!HASH64.test(spec.sha256) || observations.sha256 !== spec.sha256)
    errors.push('official CSV SHA256 differs from independent immutable pin');
  if (bytes.length !== spec.bytes) errors.push('official CSV byte length mismatch');
  let records;
  try { records = parseCsv(bytes); }
  catch (e) { return { status: 'FAIL', errors: [...errors, String(e)], observations }; }
  if (records.length < 2) return { status: 'FAIL', errors: [...errors, 'empty CSV'], observations };
  const header = records[0].cells;
  observations.columns = header.length;
  observations.rows = records.length - 1;
  if (header.length !== spec.columns) errors.push('53-column source schema not preserved');
  if (observations.rows !== spec.rows) errors.push('raw source row count mismatch');
  const refIndex = header.findIndex(h => /^ref[\s_.-]*id$/i.test(h.trim()));
  if (refIndex < 0) errors.push('missing Ref ID column');
  const seen = new Map(), duplicates = [];
  for (const record of records.slice(1)) {
    if (record.cells.length !== header.length) errors.push('malformed source record with wrong column count');
    if (refIndex < 0) continue;
    const ref = String(record.cells[refIndex] || '').trim();
    if (!/^[0-9]+$/.test(ref)) { errors.push('missing or malformed Ref ID'); continue; }
    if (seen.has(ref)) {
      duplicates.push(ref);
      if (record.raw !== seen.get(ref)) errors.push('non-identical duplicate Ref ID ' + ref);
    } else seen.set(ref, record.raw);
  }
  observations.unique_refs = seen.size;
  observations.duplicate_refs = duplicates;
  if (seen.size !== spec.unique_refs) errors.push('canonical Ref ID cardinality mismatch');
  if (duplicates.length !== 1 || duplicates[0] !== spec.duplicate_ref)
    errors.push('undocumented duplicate Ref IDs (only identical 7679 is allowed)');
  // The reported Ref15915 and month-first dates are NOT general identity waivers.
  // Geometry may legitimately be missing, but out-of-range provided WGS84
  // latitude/longitude values may not be silently accepted.
  const lat = header.findIndex(h => /^latitude$/i.test(h.trim()));
  const lon = header.findIndex(h => /^longitude$/i.test(h.trim()));
  if (lat >= 0 && lon >= 0) {
    for (const r of records.slice(1)) {
      for (const [idx, bound] of [[lat, 90], [lon, 180]]) {
        const v = String(r.cells[idx] || '').trim();
        if (v && (!Number.isFinite(Number(v)) || Math.abs(Number(v)) > bound))
          errors.push('invalid provided WGS84 coordinate');
      }
    }
  }
  return { status: verdict(errors), errors: [...new Set(errors)], observations };
}

export function auditBinary(bytes, spec = PINS.official_xlsx) {
  const errors = [];
  const observed = { sha256: sha256(bytes), bytes: bytes.length };
  if (!HASH64.test(spec.sha256) || observed.sha256 !== spec.sha256)
    errors.push('official XLSX SHA256 differs from independent immutable pin');
  if (bytes.length !== spec.bytes) errors.push('official XLSX byte length mismatch');
  return { status: verdict(errors), errors, observations: observed };
}

export function auditReleaseTrees(trees, versions, pins = PINS) {
  const errors = [], observations = {};
  for (const [path, expected] of Object.entries(pins.trees)) {
    const observed = trees?.[path] ?? null;
    observations[path] = observed;
    if (!HASH40.test(String(expected)) || observed !== expected)
      errors.push('immutable release Git tree mismatch or absent: ' + path);
  }
  const operative = versions?.release_candidate?.operative?.id ?? null;
  if (operative !== pins.operative_id)
    errors.push('unexpected operative Pipeline News pointer: ' + String(operative));
  return { status: verdict(errors), errors, observations, operative };
}

export const REQUIRED_GATES = Object.freeze([
  'source_provenance', 'publisher_rights', 'integrated_ci', 'browser_1440',
  'browser_390', 'csv_export', 'map_click', 'public_served_bytes', 'rollback'
]);

/** Status checks never turn SKIPPED, warning-only, unknown or absent into PASS.
 *  Synthetic all-PASS evidence is a unit-test case, NOT release certification.
 */
export function auditAcceptance(evidence, pins = PINS) {
  const errors = [], unverified = [], gates = {};
  for (const name of REQUIRED_GATES) {
    const gate = evidence?.[name];
    if (!gate) { unverified.push(name + ': missing evidence'); gates[name] = 'UNVERIFIED'; continue; }
    if (gate.status === 'SKIPPED' || gate.status === 'FAIL' || gate.status === 'CANCELLED') {
      errors.push(name + ': ' + gate.status); gates[name] = 'FAIL'; continue;
    }
    if (gate.status !== 'PASS') {
      unverified.push(name + ': not independently PASS'); gates[name] = 'UNVERIFIED'; continue;
    }
    if (!HASH64.test(String(gate.receipt_sha256 || '')) ||
        !HASH40.test(String(gate.commit_sha || '')) ||
        !gate.independent_reviewer || gate.independent_reviewer === 'producer') {
      unverified.push(name + ': missing immutable receipt or independent reviewer');
      gates[name] = 'UNVERIFIED'; continue;
    }
    gates[name] = 'PASS';
  }
  const check = (name, condition, message) => {
    if (gates[name] === 'PASS' && !condition) { errors.push(message); gates[name] = 'FAIL'; }
  };
  const e = evidence || {};
  check('source_provenance', e.source_provenance?.official_csv_sha256 === pins.official_csv.sha256 &&
      e.source_provenance?.official_xlsx_sha256 === pins.official_xlsx.sha256,
      'source evidence does not match official Q3 SHA256 pins');
  check('publisher_rights', e.publisher_rights?.unverified_sources === 0 &&
      e.publisher_rights?.licence_review === 'independent',
      'unverified or unreviewed publisher/source rights');
  const jobs = e.integrated_ci?.required_jobs;
  check('integrated_ci', Array.isArray(jobs) && jobs.length > 0 &&
      jobs.every(j => j && j.status === 'completed' && j.conclusion === 'success' &&
        j.warning_only !== true && j.skipped !== true && HASH40.test(String(j.sha || ''))),
      'CI contains missing, skipped, warning-only or failed required jobs');
  check('browser_1440', e.browser_1440?.width === 1440 && e.browser_1440?.js_errors === 0 &&
      e.browser_1440?.real_browser === true, 'desktop browser acceptance absent');
  check('browser_390', e.browser_390?.width === 390 && e.browser_390?.js_errors === 0 &&
      e.browser_390?.real_browser === true, 'mobile browser acceptance absent');
  check('csv_export', e.csv_export?.downloaded === true &&
      e.csv_export?.unique_repd_refs === pins.published_rows &&
      e.csv_export?.rows === pins.published_rows, 'actual CSV download identity/count failed');
  check('map_click', e.map_click?.clicked === true &&
      e.map_click?.receiver_verified === true && e.map_click?.wrong_repd_refs === 0,
      'MAP control or GridAtlas receiver identity not verified');
  check('public_served_bytes', HASH64.test(String(e.public_served_bytes?.expected_sha256 || '')) &&
      e.public_served_bytes?.expected_sha256 === e.public_served_bytes?.served_sha256 &&
      e.public_served_bytes?.http_status === 200,
      'publicly served bytes do not match independent expected SHA256');
  check('rollback', e.rollback?.dry_run === true &&
      e.rollback?.previous_pointer === pins.operative_id &&
      e.rollback?.restored_tree === pins.trees['uk_renewables_pipeline/202611140306'] &&
      e.rollback?.historical_files_untouched === true,
      'non-destructive rollback failed previous pointer or release-tree hash');
  return {
    status: errors.length ? 'FAIL' : unverified.length ? 'UNVERIFIED' : 'READY_FOR_INDEPENDENT_REVIEW',
    release_authorised: false, gates, errors, unverified
  };
}

function flag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

function localTrees(repo) {
  const trees = {};
  for (const path of Object.keys(PINS.trees)) {
    try {
      trees[path] = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD:' + path],
        { encoding: 'utf8', timeout: 30000 }).trim();
    } catch { trees[path] = null; }
  }
  return trees;
}

export function offlineAudit(csv, xlsx, trees, versions, evidence = null) {
  const source_csv = auditOfficialCsv(csv);
  const source_xlsx = auditBinary(xlsx);
  const releases = auditReleaseTrees(trees, versions);
  const acceptance = auditAcceptance(evidence);
  const offline_status = [source_csv, source_xlsx, releases].every(r => r.status === 'PASS')
    ? 'PASS' : 'FAIL';
  return {
    schema: 'testcode.agent3.release-integrity.v1',
    pinned_evidence_commit: PINS.official_commit,
    reference_release_commit: PINS.historical_commit,
    source_csv, source_xlsx, releases, offline_status, acceptance,
    publication_status: 'HOLD',
    note: 'Offline integrity PASS is not publisher rights, browser, public served-byte, or release approval.'
  };
}

function main() {
  const args = process.argv.slice(2);
  const csv = flag(args, '--source-csv'), xlsx = flag(args, '--source-xlsx');
  const repo = flag(args, '--release-repo'), versions = flag(args, '--versions');
  const out = flag(args, '--out'), evidence = flag(args, '--evidence');
  if (![csv, xlsx, repo, versions].every(Boolean)) {
    throw new Error('required: --source-csv FILE --source-xlsx FILE --release-repo DIR --versions FILE [--evidence FILE] [--out FILE]');
  }
  const report = offlineAudit(readFileSync(csv), readFileSync(xlsx),
    localTrees(resolve(repo)), JSON.parse(readFileSync(versions, 'utf8')),
    evidence ? JSON.parse(readFileSync(evidence, 'utf8')) : null);
  const payload = JSON.stringify(report, null, 2) + '\n';
  if (out) writeFileSync(out, payload);
  process.stdout.write(payload);
  if (report.offline_status !== 'PASS' || report.acceptance.status === 'FAIL') process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (e) { console.error(String(e.stack || e)); process.exitCode = 2; }
}
