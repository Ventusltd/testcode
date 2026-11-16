#!/usr/bin/env node
/** Real bundle parser and complete export receipts. No DOM or acquisition. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SCHEMA = 'testcode.prospecting-export-consumer.v1';
const FLAGS = ['--bundle', '--export-dir', '--alternate-dir', '--expected', '--manifest-sha256'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const encoded = value => Buffer.from(JSON.stringify(value));
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
const equal = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

function argumentsFor(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!FLAGS.includes(key) || key in args || !value || value.startsWith('--')) throw new Error();
    args[key] = value;
  }
  if (!FLAGS.every(flag => flag in args) || !/^[a-f0-9]{64}$/.test(args['--manifest-sha256'])) throw new Error();
  return args;
}

export async function consume(argv) {
  const checks = [], controls = [];
  const check = (name, pass) => checks.push({ name, pass: pass === true });
  const failure = error_kind => ({ code: 2, report: { schema: SCHEMA, pass: false, checks, controls, error_kind } });
  let args;
  try { args = argumentsFor(argv); } catch { return failure('CONFIGURATION_INVALID'); }
  let priority, manifest, csv, alternatePriority, alternateManifest, expected;
  try {
    [priority, manifest, csv, alternatePriority, alternateManifest] = await Promise.all([
      readFile(join(args['--export-dir'], 'priority.json')),
      readFile(join(args['--export-dir'], 'manifest.json')),
      readFile(join(args['--export-dir'], 'priority.csv')),
      readFile(join(args['--alternate-dir'], 'priority.json')),
      readFile(join(args['--alternate-dir'], 'manifest.json')),
    ]);
    expected = JSON.parse(await readFile(args['--expected'], 'utf8'));
    if (!Array.isArray(expected.official_ids) || !Array.isArray(expected.solar1000_ids) || !expected.official_receipt) throw new Error();
  } catch { return failure('INPUT_READ_FAILED'); }

  let attempts = 0;
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => { attempts += 1; throw new Error('offline fetch blocked'); };
  const finish = () => {
    check('network_not_used', attempts === 0);
    const pass = checks.length > 0 && checks.every(item => item.pass);
    return { code: pass ? 0 : 1, report: { schema: SCHEMA, pass, checks, controls,
      artifact_sha256: { 'priority.json': sha(priority), 'priority.csv': sha(csv), 'manifest.json': sha(manifest) } } };
  };
  try {
    let parser;
    try { parser = (await import(pathToFileURL(resolve(args['--bundle'])).href)).parsePriorityBundle; }
    catch { return failure('BUNDLE_IMPORT_FAILED'); }
    if (typeof parser !== 'function') return failure('BUNDLE_API_INVALID');

    check('manifest_pin_matches', sha(manifest) === args['--manifest-sha256']);
    let bundle;
    try {
      bundle = await parser(priority, manifest, args['--manifest-sha256']);
      check('real_bundle_parser_accepts_export', true);
    } catch {
      check('real_bundle_parser_accepts_export', false);
      return finish();
    }
    const spec = bundle.manifest;
    const receiptMatches = (name, bytes) => equal(spec?.files?.[name], { bytes: bytes.length, sha256: sha(bytes) });
    check('export_json_receipt', receiptMatches('priority.json', priority));
    check('export_csv_receipt', receiptMatches('priority.csv', csv));
    const anchored = value => equal(value?.manifest?.inventory?.official_ids, expected.official_ids)
      && equal(value?.manifest?.inventory?.solar1000_ids, expected.solar1000_ids)
      && equal(value?.manifest?.input_receipts?.find(item => item.id === 'official_repd'), expected.official_receipt);
    check('official_inventory_matches_committed_source', equal(spec?.inventory?.official_ids, expected.official_ids));
    check('solar1000_matches_committed_order', equal(spec?.inventory?.solar1000_ids, expected.solar1000_ids));
    check('official_receipt_matches_committed_source', equal(spec?.input_receipts?.find(item => item.id === 'official_repd'), expected.official_receipt));
    check('official_and_solar_counts', spec?.official_count === 7775 && spec?.solar_count === 3604 && spec?.solar1000_count === 1000);
    check('ranked_subset_is_separate', bundle.model?.records?.length === 1000 && bundle.byId?.size === 1000
      && bundle.members?.size === 7775 && spec?.unranked_state === 'OUTSIDE_RANKED_SUBSET');
    check('absent_optional_evidence_remains_unknown', bundle.model?.records?.every(row => row.evidence.length === 0 && row.heat.state === 'UNKNOWN') === true
      && spec.input_receipts.filter(item => item.id !== 'official_repd').every(item => item.state === 'UNKNOWN'));

    async function rejects(name, action, message) {
      let rejection = false;
      try { await action(); } catch (error) { rejection = error instanceof Error && message.test(error.message); }
      controls.push({ name, kind: 'EXPECTED_REJECTION', pass: rejection });
      check(name, rejection);
    }
    const repinned = mutate => {
      const value = JSON.parse(manifest.toString('utf8'));
      mutate(value);
      const raw = encoded(value);
      return parser(priority, raw, sha(raw));
    };
    await rejects('missing_manifest_pin_rejected', () => parser(priority, manifest), /pinned manifest/);
    await rejects('wrong_manifest_pin_rejected', () => parser(priority, manifest, '0'.repeat(64)), /Manifest digest mismatch/);
    await rejects('tampered_manifest_bytes_rejected', () => parser(priority, Buffer.concat([manifest, Buffer.from(' ')]), args['--manifest-sha256']), /Manifest digest mismatch/);
    const alteredPriority = Buffer.from(priority);
    alteredPriority[4] ^= 1;
    await rejects('tampered_priority_bytes_rejected', () => parser(alteredPriority, manifest, sha(manifest)), /hash mismatch/);
    await rejects('repinned_input_receipt_mismatch_rejected', () => repinned(value => { value.input_receipts[0].manifest_sha256 = '0'.repeat(64); }), /Source receipt differs/);
    await rejects('repinned_profile_mismatch_rejected', () => repinned(value => { value.profile_sha256 = '0'.repeat(64); }), /model differs/);
    await rejects('repinned_clock_mismatch_rejected', () => repinned(value => { value.as_of = '2026-11-17T17:40:00Z'; }), /model differs/);
    await rejects('repinned_pilot_order_rejected', () => repinned(value => { value.inventory.solar1000_ids.reverse(); }), /order or membership/);
    await rejects('repinned_duplicate_inventory_rejected', () => repinned(value => { value.inventory.official_ids[1] = value.inventory.official_ids[0]; }), /identity inventory/);
    await rejects('repinned_inventory_digest_rejected', () => repinned(value => { value.inventory_sha256 = '0'.repeat(64); }), /Inventory digest mismatch/);
    await rejects('incomplete_export_manifest_rejected', () => repinned(value => { delete value.files['priority.csv']; }), /Unexpected bundle files/);
    await rejects('cross_export_manifest_rejected', () => parser(priority, alternateManifest, sha(alternateManifest)), /hash mismatch|file receipt mismatch/);
    const alternate = await parser(alternatePriority, alternateManifest, sha(alternateManifest));
    check('alternate_export_is_independently_valid', anchored(alternate) && alternate.model.as_of !== bundle.model.as_of);

    // A newly trusted manifest can be structurally valid yet identify another
    // source inventory. This is caught by the independent committed-data check,
    // not represented as a rejection by the UI parser itself.
    const shifted = JSON.parse(manifest.toString('utf8'));
    const pilots = new Set(expected.solar1000_ids.map(id => 'REPD-' + id));
    const index = shifted.inventory.official_ids.findIndex(id => !pilots.has(id) && !bundle.byId.has(id));
    if (index < 0) throw new Error('No inventory control available');
    shifted.inventory.official_ids[index] = 'REPD-999999999';
    shifted.inventory_sha256 = sha(Buffer.from(JSON.stringify(stable(shifted.inventory), null, 2) + '\n'));
    const shiftedBytes = encoded(shifted);
    const shiftedBundle = await parser(priority, shiftedBytes, sha(shiftedBytes));
    const detected = !anchored(shiftedBundle);
    controls.push({ name: 'repinned_source_inventory_drift_detected', kind: 'SOURCE_ASSOCIATION', pass: detected });
    check('repinned_source_inventory_drift_detected', detected);
    const badCsv = Buffer.concat([csv, Buffer.from('tampered\n')]);
    check('tampered_csv_receipt_detected', !receiptMatches('priority.csv', badCsv));
    check('all_negative_controls_executed', controls.length === 13);
    return finish();
  } catch {
    return failure('CONSUMER_EXECUTION_FAILED');
  } finally {
    globalThis.fetch = savedFetch;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let result;
  try { result = await consume(process.argv.slice(2)); }
  catch { result = { code: 2, report: { schema: SCHEMA, pass: false, checks: [], controls: [], error_kind: 'CONSUMER_FAILED' } }; }
  process.stdout.write(JSON.stringify(result.report) + '\n');
  process.exitCode = result.code;
}
