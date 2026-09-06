import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {compact,proveEquivalent,replaceMapEngine,replaceOptionalModule} from './token-compaction.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const generation=process.argv[2];assert(/^\d{12}$/.test(generation||''));
const owner=process.env.GRIDATLAS_REPO||'C:/Users/vikra/atlas-labels-20260906';
const blob=(repo,p,sha='HEAD')=>execFileSync('git',['show',`${sha}:${p}`],{cwd:repo,maxBuffer:64*1024*1024});
const hash=b=>createHash('sha256').update(b).digest('hex');
const prefix=`sandbox/${generation}/`;
const manifest=JSON.parse(blob(root,prefix+'publication.json'));
for(const item of manifest.files){const b=blob(root,prefix+item.path);assert.equal(b.length,item.bytes,item.path);assert.equal(hash(b),item.sha256,item.path);}
const p=JSON.parse(blob(root,prefix+'atlas/source-provenance.json'));
assert.equal(p.generation,generation);assert(/^[a-f0-9]{40}$/.test(p.ownerCommit));
for(const name of ['map-controls-layout.js','teleprinter-bootstrap.js'])assert.deepEqual(blob(root,prefix+'atlas/'+name),blob(root,`sandbox/${p.parent}/atlas/${name}`),'Carried '+name);
const inheritedPins=execFileSync('git',['ls-tree','--name-only','HEAD',`sandbox/${p.parent}/atlas/tool-layers.json`],{cwd:root,encoding:'utf8'}).trim();
if(inheritedPins)assert.deepEqual(blob(root,prefix+'atlas/tool-layers.json'),blob(root,inheritedPins),'Carried original tool identities');
const engine=blob(owner,p.engine.path,p.ownerCommit),module=blob(owner,p.module.path,p.ownerCommit),parent=blob(root,p.parentCartridge.path);
assert.equal(hash(engine),p.engine.sha256);assert.equal(hash(module),p.module.sha256);assert.equal(hash(parent),p.parentCartridge.sha256);
let assembled=replaceMapEngine(parent.toString(),engine.toString(),module.toString());
for(const extra of p.optionalModules||[]){const bytes=blob(owner,extra.path,p.ownerCommit);assert.equal(hash(bytes),extra.sha256);assembled=replaceOptionalModule(assembled,bytes.toString(),extra.schema);}
assert.equal(hash(assembled),p.assembledSha256);
const expected='/* '+generation+'; source and token/AST compaction receipts in source-provenance.json. */\n'+compact(assembled);
const current=JSON.parse(blob(root,prefix+'atlas/current.json'));
const cartridge=current.cartridges.find(c=>c.id==='substation-intelligence');
const actual=blob(root,prefix+'atlas/'+cartridge.path.slice(2)).toString();
assert.equal(actual,expected);proveEquivalent(assembled,actual);
assert.equal(hash(actual),p.payloadSha256);assert.equal(hash(actual),cartridge.sha256);assert(actual.length<=368640);
assert.equal((actual.match(/gridatlas\.measurement-dock\.v1/g)||[]).length,1,'One measurement module, never accumulated duplicates');
for(const c of current.cartridges){const q=c.path.startsWith('/testcode/')?'sandbox/'+c.path.slice(10):prefix+'atlas/'+c.path.replace(/^\.\//,'');assert.equal(hash(blob(root,q)),c.sha256,c.id);}
console.log(`PASS ${generation}: ${manifest.files.length} published-file identities, complete cartridge dependencies, owner reconstruction and executable token/AST parity (${actual.length}/368640 characters)`);
