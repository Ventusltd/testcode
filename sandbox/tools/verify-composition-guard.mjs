import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),generation=process.argv[2];assert(/^\d{12}$/.test(generation||''));
const blob=(p,ref='HEAD')=>execFileSync('git',['show',ref+':'+p],{cwd:root,maxBuffer:64*1024*1024});const hash=b=>createHash('sha256').update(b).digest('hex');
const prefix=`sandbox/${generation}/`,manifest=JSON.parse(blob(prefix+'publication.json')),p=JSON.parse(blob(prefix+'atlas/source-provenance.json'));
assert.equal(p.schema,'gridatlas.composition-guard.v1');assert.equal(p.generation,generation);assert.equal(manifest.generation,generation);assert.equal(p.sourceCommit,manifest.source_commit);
for(const f of manifest.files){const b=blob(prefix+f.path);assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256);}
const source=q=>blob(q,p.sourceCommit),contract=source(p.contract.path),before=source(`sandbox/${p.parent}/atlas/index.html`);
assert.equal(hash(contract),p.contract.sha256);assert.equal(hash(before),p.parentIndexSha256);
const hook="      invariant(Array.isArray(current.cartridge_order) && Array.isArray(current.cartridges), 'cartridge registry malformed');";
const expected=before.toString().replace('Test Code Atlas '+p.parent,'Test Code Atlas '+generation).replace(hook,hook+'\n'+contract.toString().replace('export function','function')+'\n      validateAtlasComposition(current);');
assert.equal(blob(prefix+'atlas/index.html').toString(),expected);assert.equal(hash(expected),p.indexSha256);
const current=JSON.parse(blob(prefix+'atlas/current.json')),parent=JSON.parse(source(`sandbox/${p.parent}/atlas/current.json`));
for(const c of parent.cartridges)if(c.path.startsWith('./'))c.path=`/testcode/${p.parent}/atlas/${c.path.slice(2)}`;
assert.deepEqual(current.cartridges,parent.cartridges);assert.deepEqual(current.cartridge_order,parent.cartridge_order);
assert.deepEqual(current.layout_cartridge,parent.layout_cartridge);
for(const c of current.cartridges){assert(c.path.startsWith('/testcode/'));const q='sandbox/'+c.path.slice(10);assert.equal(hash(blob(q)),c.sha256);assert.deepEqual(blob(q),source(q));}
for(const f of manifest.files.filter(f=>f.path.startsWith('atlas/')&&!['atlas/current.json','atlas/index.html','atlas/source-provenance.json'].includes(f.path)))assert.deepEqual(blob(prefix+f.path),source(`sandbox/${p.parent}/${f.path}`),f.path);
assert.equal(hash(blob(prefix+'atlas/map-controls-layout.js')),current.layout_cartridge.sha256);
console.log(`PASS ${generation}: ${manifest.files.length} published files, exact router reconstruction, unchanged four cartridges and carried initialization`);
