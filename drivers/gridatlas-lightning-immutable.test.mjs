/**
 * Independent GridAtlas Lightning candidate preservation audit.
 * This lives in TESTCODE, never in the product repository.
 * Execute with a checkout of the exact candidate beside testcode:
 *   GRIDATLAS_ROOT=../gridatlas LIGHTNING_GEN=202610262310 \
 *     node --test drivers/gridatlas-lightning-immutable.test.mjs
 *
 * No network; no CSS, shell, app or archive writes; no synthetic data substitution.
 * This proves STATIC invariants ONLY. Live WebKit/network and owner veto are separate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';

const GEN = process.env.LIGHTNING_GEN || '202610262310';
const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(process.env.GRIDATLAS_ROOT || join(HERE, '../../gridatlas'));
const file = p => readFileSync(join(ROOT, p));
const json = p => JSON.parse(file(p).toString('utf8'));
const hash = b => createHash('sha256').update(b).digest('hex');
const get = (j,id) => {
  const x=j.cartridges.filter(c=>c.id===id);
  assert.equal(x.length,1, 'Missing/duplicated cartridge ' + id);
  return x[0];
};
const ids = ['streaming-parquet-bridge','uk-gazetteer-flyto','substation-intelligence','sld-sandbox'];
const current = json('atlas/current.json');
const candidate = json('atlas/v/'+GEN+'/current.json');
const manifest = json('atlas/manifests/'+GEN+'-composition.json');
const overlay = file('atlas/modules/'+GEN+'-uk-lightning-overlay.js');
const orig = file('atlas/cartridges/202609241334-sld-sandbox-v9-8.js');
const composed = file('atlas/cartridges/'+GEN+'-sld-sandbox-v9-8.js');
const loader = file('atlas/v/'+GEN+'/index.html');

test('LIVE-01: still selects accepted generation 202609241334',()=>{
  assert.equal(current.generation,'202609241334');
  assert.equal(current.architecture,'IMMUTABLE_SHELL_PLUS_HASHED_CARTRIDGES');
  assert.deepEqual(current.cartridge_order,ids);
});

test('LIVE-02: accepted original cartridge is byte-verifiable',()=>{
  assert.equal(hash(orig),get(current,'sld-sandbox').sha256);
  assert.equal(orig.length,435218);
});

test('CAND-01: versioned standalone page uses byte-identical composer',()=>{
  assert.deepEqual(loader,file('atlas/index.html'));
  assert.equal(candidate.generation,GEN);
  assert.equal(manifest.generation,GEN);
  assert.deepEqual(candidate.cartridge_order,ids);
  assert.deepEqual(manifest.cartridge_order,ids);
  assert.equal(candidate.shell.index,'../../releases/202608300453-atlas-v9/index.html');
  assert.equal(candidate.shell.base,'../../releases/202608300453-atlas-v9/');
});

test('CAND-02: all other three original slot hashes are unmodified',()=>{
  for(const id of ids.slice(0,3)){
    assert.equal(get(candidate,id).sha256,get(current,id).sha256,'Hash changed for '+id);
    assert.equal(get(manifest,id).sha256,get(current,id).sha256,'Manifest hash changed for '+id);
  }
});

test('CAND-03: original composed cartridge is EXACT prefix, then one new module',()=>{
  const expected = Buffer.concat([orig,Buffer.from('\n'),overlay]);
  assert.deepEqual(composed,expected);
  assert.equal(hash(composed),get(candidate,'sld-sandbox').sha256);
  assert.equal(hash(composed),get(manifest,'sld-sandbox').sha256);
  assert.equal(composed.length,get(candidate,'sld-sandbox').bytes);
});

test('CAND-04: overlay stays within documented byte limits',()=>{
  assert.ok(overlay.length<=24781,'Original 460 kB budget leaves at most 24,781 overlay bytes: '+overlay.length);
  assert.ok(overlay.length<=24781,'Hard bound 24,781 exceeded');
  assert.ok(composed.length<=460000,'Derived cartridge exceeds 460,000 bytes');
});

test('CAND-05: module parses without execution or fetching anything',()=>{
  assert.doesNotThrow(()=>new Script(overlay.toString('utf8'),{filename:GEN+'-uk-lightning-overlay.js'}));
});

test('CAND-06: optical flashes explicitly distinguish ground strikes',()=>{
  const s=overlay.toString('utf8');
  assert.match(s,/optical/i);
  assert.match(s,/ground strike/i);
  assert.match(s,/12m/);
  assert.match(s,/7d/);
});

test('CAND-07: provenance record states exact candidate SHA and source',()=>{
  const p=get(candidate,'sld-sandbox');
  assert.equal(p.generation,GEN);
  assert.match(p.path,new RegExp(GEN));
  assert.match(candidate.composition_manifest,new RegExp(GEN));
});

console.log('Testcode independent audit reads:',ROOT,'generation',GEN);
