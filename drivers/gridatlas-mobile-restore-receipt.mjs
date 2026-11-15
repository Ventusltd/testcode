#!/usr/bin/env node
/*
 * Agent 3 — GridAtlas mobile MAP evidence validator (non-publishing).
 *
 * An opened URL, a complete composer, a nearest result in hidden DOM, and
 * even a successful click do NOT prove the result is visible to the user.
 * This test deliberately keeps calculation success and presentation success
 * as separate, mandatory gates. It reads actual independently captured
 * browser receipts. It does not run GridAtlas or alter any release.
 *
 * Usage:
 *   node drivers/gridatlas-mobile-restore-receipt.mjs --selftest
 *   node drivers/gridatlas-mobile-restore-receipt.mjs receipts.json
 *
 * Input: {schema: 'testcode.gridatlas-mobile-restore-receipts.v1',
 *         source_head: 40-hex SHA, receiver_generation: string,
 *         cases: [receipt, ...]}
 * A receipt must describe one real user click from Pipeline News.
 * Every case must contain a trace/screenshot URL for review. Synthetic
 * selftests demonstrate the validator's ability to reject false greens;
 * they are not product/engine/browser tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SCHEMA = 'testcode.gridatlas-mobile-restore-receipts.v1';
const SHA = /^[0-9a-f]{40}$/i;
const KNOWN = new Set(['solar', 'bess', 'wind_onshore']);
const REPD = /^[1-9][0-9]*$/;

export function evaluateReceipt(receipt, manifest) {
  const errors = [];
  const need = (ok, message) => { if (!ok) errors.push(message); };
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const isBool = v => typeof v === 'boolean';
  const int = v => Number.isInteger(v);
  const bool = (key, wanted = true) => {
    need(isBool(receipt[key]) && receipt[key] === wanted,
      key + ' must be explicitly ' + wanted);
  };
  const nonblank = key => need(text(receipt[key]), key + ' missing');

  need(REPD.test(String(receipt.repd_ref || '')), 'invalid or missing repd_ref');
  need(KNOWN.has(receipt.technology), 'technology missing or outside recorded test classes');
  need(int(receipt.viewport_width) && receipt.viewport_width > 0,
    'viewport_width missing');
  need(int(receipt.viewport_height) && receipt.viewport_height > 0,
    'viewport_height missing');
  nonblank('source_map_click_url');
  nonblank('destination_url');
  nonblank('browser_trace_url');
  nonblank('screenshot_url');
  need(text(receipt.composer_generation) && receipt.composer_generation === manifest.receiver_generation,
    'composed generation does not match pinned receiver generation');
  need(int(receipt.cartridges_verified) && receipt.cartridges_verified >= 6,
    'fewer than six verified composed cartridges');
  bool('cartridge_sha_verified');
  need(Array.isArray(receipt.runtime_failures) && receipt.runtime_failures.length === 0,
    'GridAtlas runtime failures absent/uncleared');
  need(Array.isArray(receipt.page_errors) && receipt.page_errors.length === 0,
    'browser JS page errors absent/uncleared');
  bool('technology_layer_enabled');
  bool('nearest_in_dom');
  bool('first_restore_click_registered');
  bool('after_restore_minimised', false);
  bool('visible_nearest_after_restore');
  bool('measurement_card_visible');
  need(int(receipt.control_width_px) && receipt.control_width_px >= 44,
    'restore target width under 44px or missing');
  need(int(receipt.control_height_px) && receipt.control_height_px >= 44,
    'restore target height under 44px or missing');
  need(receipt.collapsed_control_glyph === '+' || receipt.collapsed_control_glyph === '＋',
    'collapsed control does not advertise restore (+)');
  need(text(receipt.collapsed_control_accessible_name) &&
       /restore|expand|open|show/i.test(receipt.collapsed_control_accessible_name),
    'collapsed control lacks a restore/expand accessible name');
  need(int(receipt.stable_visible_ms) && receipt.stable_visible_ms >= 1500,
    'nearest result not observed visibly stable for 1500ms');

  if (text(receipt.destination_url)) {
    try {
      const u = new URL(receipt.destination_url);
      need(u.protocol === 'https:' && u.host === 'ventusltd.github.io' &&
        u.pathname.replace(/\/+$/, '') === '/gridatlas/atlas',
        'destination is not the canonical GridAtlas receiver');
      need(u.searchParams.get('repd_ref') === String(receipt.repd_ref),
        'destination repd_ref differs from clicked project');
      need(u.searchParams.get('technology') === receipt.technology,
        'destination technology differs from clicked project');
      for (const k of ['latitude', 'longitude']) {
        const n = Number(u.searchParams.get(k));
        need(u.searchParams.has(k) && Number.isFinite(n) &&
          (k === 'latitude' ? Math.abs(n) <= 90 : Math.abs(n) <= 180),
          'destination ' + k + ' missing/invalid');
      }
    } catch {
      errors.push('destination_url is not a valid absolute URL');
    }
  }
  // Hidden DOM is useful for separating engine computation from a UX defect,
  // but it can never rescue an invisible answer or first-click re-minimise.
  return { repd_ref: String(receipt.repd_ref || ''),
    technology: receipt.technology || 'unknown',
    viewport: String(receipt.viewport_width) + 'x' + String(receipt.viewport_height),
    status: errors.length ? 'FAIL' : 'PASS', errors };
}

export function evaluateManifest(manifest) {
  const errors = [];
  if (!manifest || manifest.schema !== SCHEMA) errors.push('invalid manifest schema');
  if (!SHA.test(String(manifest?.source_head || ''))) errors.push('source_head must pin an exact 40-character SHA');
  if (typeof manifest?.receiver_generation !== 'string' || !/^\d{12}$/.test(manifest.receiver_generation))
    errors.push('receiver_generation missing or invalid');
  if (!Array.isArray(manifest?.cases) || manifest.cases.length < 1)
    errors.push('no actual browser receipts');
  const outcomes = (Array.isArray(manifest?.cases) ? manifest.cases : [])
    .map(r => evaluateReceipt(r, manifest || {}));
  const keys = new Set();
  for (const r of outcomes) {
    const key = r.repd_ref + ':' + r.technology + ':' + r.viewport;
    if (keys.has(key)) errors.push('duplicate case ' + key);
    keys.add(key);
  }
  if (outcomes.some(o => o.status !== 'PASS')) errors.push('one or more cases failed');
  return {schema: SCHEMA, status: errors.length ? 'FAIL' : 'PASS',
    source_head: manifest?.source_head || null,
    receiver_generation: manifest?.receiver_generation || null,
    checked: outcomes.length, outcomes, errors};
}

function selfTest() {
  const m = {schema: SCHEMA,
    source_head: 'a'.repeat(40), receiver_generation: '202611132345', cases: []};
  const good = {repd_ref: '12588', technology: 'solar',
    viewport_width: 390, viewport_height: 844,
    source_map_click_url: 'https://globalgrid2050.com/uk_renewables_pipeline/202611151300/',
    destination_url: 'https://ventusltd.github.io/gridatlas/atlas/?repd_ref=12588&technology=solar&latitude=51.7&longitude=-1.2&zoom=12',
    browser_trace_url: 'https://example.invalid/fixture-trace',
    screenshot_url: 'https://example.invalid/fixture-image',
    composer_generation: '202611132345', cartridges_verified: 6,
    cartridge_sha_verified: true, runtime_failures: [], page_errors: [],
    technology_layer_enabled: true, nearest_in_dom: true,
    first_restore_click_registered: true, after_restore_minimised: false,
    visible_nearest_after_restore: true, measurement_card_visible: true,
    control_width_px: 44, control_height_px: 44,
    collapsed_control_glyph: '+', collapsed_control_accessible_name: 'Restore project card',
    stable_visible_ms: 1500};
  assert.equal(evaluateManifest({...m, cases: [good]}).status, 'PASS');
  for (const mutation of [
    {after_restore_minimised: true},
    {visible_nearest_after_restore: false},
    {first_restore_click_registered: false},
    {cartridges_verified: 0},
    {cartridge_sha_verified: false},
    {runtime_failures: ['cartridge error']},
    {collapsed_control_glyph: '−'},
    {collapsed_control_accessible_name: 'Minimise'},
    {stable_visible_ms: 200},
    {control_width_px: 32},
    {destination_url: good.destination_url.replace('repd_ref=12588', 'repd_ref=12589')},
    {browser_trace_url: ''},
  ]) {
    const verdict = evaluateManifest({...m, cases: [{...good, ...mutation}]});
    assert.equal(verdict.status, 'FAIL', JSON.stringify(mutation));
  }
  assert.equal(evaluateManifest({...m, cases: [good, good]}).status, 'FAIL');
  assert.equal(evaluateManifest({...m, source_head: '', cases: [good]}).status, 'FAIL');
  console.log('SELFTEST PASS: 15 mutation/control cases (synthetic validator only; no GridAtlas browser execution)');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--selftest')) selfTest();
  else {
    const file = process.argv[2];
    if (!file) {
      console.error('Usage: node drivers/gridatlas-mobile-restore-receipt.mjs [--selftest | receipts.json]');
      process.exit(2);
    }
    let verdict;
    try { verdict = evaluateManifest(JSON.parse(readFileSync(file, 'utf8'))); }
    catch (e) { console.error('FAIL: cannot read/parse receipt: ' + e.message); process.exit(2); }
    console.log(JSON.stringify(verdict, null, 2));
    process.exit(verdict.status === 'PASS' ? 0 : 1);
  }
}
