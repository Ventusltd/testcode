/** Uses actual exported files and bundle modules from the driver's Git archive. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const consumer = join(dirname(fileURLToPath(import.meta.url)), 'consumer.mjs');
let args, temporary;
before(async () => {
  assert.ok(process.env.TESTCODE_PROSPECTING_EXPORT_SPEC, 'Generated input closure is required; missing inputs must fail');
  args = JSON.parse(await readFile(process.env.TESTCODE_PROSPECTING_EXPORT_SPEC, 'utf8')).args;
  assert.ok(Array.isArray(args) && args.length === 10);
  temporary = await mkdtemp(join(tmpdir(), 'testcode-export-consumer-unit-'));
});
after(async () => {
  if (temporary) {
    assert.equal(dirname(resolve(temporary)), resolve(tmpdir()));
    assert.ok(basename(temporary).startsWith('testcode-export-consumer-unit-'));
    await rm(temporary, { recursive: true, force: true });
  }
});
const value = (flags, name) => flags[flags.indexOf(name) + 1];
function replaced(name, replacement) {
  const result = [...args];
  result[result.indexOf(name) + 1] = replacement;
  return result;
}
function run(flags = args) {
  const child = spawnSync(process.execPath, [consumer, ...flags], { encoding: 'utf8', timeout: 10000 });
  assert.equal(child.error, undefined, 'Consumer must execute');
  assert.equal(child.stderr, '', 'Consumer must suppress exception details');
  const receipt = JSON.parse(child.stdout);
  assert.equal(receipt.schema, 'testcode.prospecting-export-consumer.v1');
  assert.equal(child.stdout.includes(temporary), false, 'Private temporary path must not enter receipt');
  assert.equal(child.stdout.includes(value(args, '--export-dir')), false, 'Input path must not enter receipt');
  return { code: child.status, receipt };
}

test('actual export passes complete receipt and real parser controls', () => {
  const { code, receipt } = run();
  assert.equal(code, 0);
  assert.equal(receipt.pass, true);
  assert.equal(receipt.controls.length, 13);
  assert.ok(receipt.checks.every(check => check.pass));
});
test('missing required flag is a configuration failure', () => {
  const flags = [...args];
  flags.splice(flags.indexOf('--expected'), 2);
  const { code, receipt } = run(flags);
  assert.equal(code, 2);
  assert.equal(receipt.error_kind, 'CONFIGURATION_INVALID');
});
test('missing actual export files fail rather than skipping', () => {
  const { code, receipt } = run(replaced('--export-dir', join(temporary, 'missing-private-path')));
  assert.equal(code, 2);
  assert.equal(receipt.error_kind, 'INPUT_READ_FAILED');
});
test('incorrect trusted manifest pin fails the positive control', () => {
  const { code, receipt } = run(replaced('--manifest-sha256', '0'.repeat(64)));
  assert.equal(code, 1);
  assert.equal(receipt.pass, false);
  assert.equal(receipt.checks.find(check => check.name === 'real_bundle_parser_accepts_export').pass, false);
  assert.equal(receipt.controls.length, 0);
});
test('CSV corruption fails even though the real UI parser accepts its JSON', async () => {
  const directory = join(temporary, 'csv-mutation');
  await mkdir(directory);
  for (const name of ['priority.json', 'manifest.json', 'priority.csv']) {
    await copyFile(join(value(args, '--export-dir'), name), join(directory, name));
  }
  await writeFile(join(directory, 'priority.csv'), 'changed export bytes\n', { flag: 'a' });
  const { code, receipt } = run(replaced('--export-dir', directory));
  assert.equal(code, 1);
  assert.equal(receipt.checks.find(check => check.name === 'real_bundle_parser_accepts_export').pass, true);
  assert.equal(receipt.checks.find(check => check.name === 'export_csv_receipt').pass, false);
});
test('an adapter accepting every mutated input cannot pass the proof', async () => {
  const wrapper = join(temporary, 'accept-all-wrapper.mjs');
  const target = JSON.stringify(pathToFileURL(value(args, '--bundle')).href);
  await writeFile(wrapper, `import {parsePriorityBundle as real} from ${target};\nlet cached;\nexport async function parsePriorityBundle(...args) { return cached ??= await real(...args); }\n`);
  const { code, receipt } = run(replaced('--bundle', wrapper));
  assert.equal(code, 1);
  assert.equal(receipt.pass, false);
  assert.equal(receipt.error_kind, undefined);
  assert.ok(receipt.controls.filter(control => !control.pass).length >= 12);
});
test('a structurally valid export cannot substitute a different committed inventory', async () => {
  const expected = JSON.parse(await readFile(value(args, '--expected'), 'utf8'));
  [expected.official_ids[0], expected.official_ids[1]] = [expected.official_ids[1], expected.official_ids[0]];
  const path = join(temporary, 'wrong-source-inventory.json');
  await writeFile(path, JSON.stringify(expected));
  const { code, receipt } = run(replaced('--expected', path));
  assert.equal(code, 1);
  assert.equal(receipt.checks.find(check => check.name === 'official_inventory_matches_committed_source').pass, false);
  assert.equal(receipt.checks.find(check => check.name === 'real_bundle_parser_accepts_export').pass, true);
});
test('caught fetch during real parser import still fails the offline proof', async () => {
  const wrapper = join(temporary, 'network-wrapper.mjs');
  const target = JSON.stringify(pathToFileURL(value(args, '--bundle')).href);
  await writeFile(wrapper, `try { await fetch('https://example.org/blocked'); } catch {}\nexport {parsePriorityBundle} from ${target};\n`);
  const { code, receipt } = run(replaced('--bundle', wrapper));
  assert.equal(code, 1);
  assert.equal(receipt.checks.find(check => check.name === 'network_not_used').pass, false);
  assert.equal(receipt.checks.find(check => check.name === 'real_bundle_parser_accepts_export').pass, true);
});
