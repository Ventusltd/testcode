import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const generation=process.argv[2];assert(/^\d{12}$/.test(generation||''));
const blob=(p,ref='HEAD')=>execFileSync('git',['show',`${ref}:${p}`],{cwd:root,maxBuffer:64*1024*1024});
const hash=b=>createHash('sha256').update(b).digest('hex');
const prefix=`sandbox/${generation}/`,manifest=JSON.parse(blob(prefix+'publication.json'));
assert.equal(manifest.generation,generation);
assert.equal(new Set(manifest.files.map(f=>f.path)).size,manifest.files.length);
for(const f of manifest.files){assert(!f.path.includes('..'));const b=blob(prefix+f.path);assert.equal(b.length,f.bytes,f.path);assert.equal(hash(b),f.sha256,f.path);}
const p=JSON.parse(blob(prefix+'atlas/source-provenance.json'));assert.equal(p.schema,'gridatlas.tool-host-candidate.v1');assert.equal(p.generation,generation);assert.equal(manifest.source_commit,p.sourceCommit);
assert(/^[a-f0-9]{40}$/.test(p.sourceCommit));
const source=q=>blob(q,p.sourceCommit);
const current=JSON.parse(blob(prefix+'atlas/current.json')),parent=JSON.parse(source(`sandbox/${p.parent}/atlas/current.json`));
assert.equal(current.previous_generation,p.parent);assert.equal(current.generation,generation);
assert.deepEqual(current.cartridge_order,parent.cartridge_order);
const carried=parent.cartridges.map(c=>({...c,path:c.path.startsWith('./')?`/testcode/${p.parent}/atlas/${c.path.slice(2)}`:c.path}));
assert.deepEqual(current.cartridges,carried,'No cartridge code or capabilities may change with a host-only release');
for(const c of current.cartridges){assert(c.path.startsWith('/testcode/'));const q='sandbox/'+c.path.slice(10);assert.equal(hash(blob(q)),c.sha256);assert.equal(hash(source(q)),c.sha256);}
for(const f of manifest.files.filter(f=>f.path==='atlas/map-controls-layout.js'||f.path.startsWith('atlas/data/'))){assert.deepEqual(blob(prefix+f.path),source(`sandbox/${p.parent}/${f.path}`),f.path);}
const original=source(`sandbox/${p.appGeneration}/atlas/teleprinter-bootstrap.js`);assert.equal(hash(original),p.originalBootstrapSha256);
const pins=JSON.parse(source(`sandbox/${p.appGeneration}/atlas/tool-layers.json`)),actualPins=JSON.parse(blob(prefix+'atlas/tool-layers.json'));
assert.deepEqual(actualPins.owners,pins.owners,'Original iframe owner identities must survive');
const tools=pins.tools.map(t=>{const o=pins.owners.find(o=>o.applications.some(a=>a.id===t.id));assert(o);return{...t,owner:{repository:o.repository,commit:o.commit,release:o.release,manifestSha256:o.manifestSha256}};});
const registry=[...tools];for(const o of pins.owners)for(const a of o.applications)if(!registry.some(t=>t.id===a.id))registry.push({id:a.id,title:'DC/AC LV Topology Review',entry:'../layer-apps/'+a.entry,owner:{repository:o.repository,commit:o.commit,release:o.release,manifestSha256:o.manifestSha256}});
assert.deepEqual(actualPins.tools,tools);assert.deepEqual(actualPins.registry,registry);assert.equal(actualPins.hostGeneration,p.hostGeneration);
let expected=original.toString().replaceAll("from '../teleprinter/",`from '/testcode/${p.appGeneration}/teleprinter/`)
 .replace("from '../tool-layers/host.js'",`from '/testcode/${p.hostGeneration}/tool-layers/host.js'`)
 .replace(/^mountToolLayers\([^\n]+$/m,`mountToolLayers(${JSON.stringify(tools)},new URL('/testcode/${p.appGeneration}/atlas/teleprinter-bootstrap.js',location.origin).href,${JSON.stringify(registry)});`)
 .replace("new URL('../teleprinter/', import.meta.url)",`new URL('/testcode/${p.appGeneration}/teleprinter/', location.origin)`);
if(p.layout){
 const initializer="import {mountMapControlsLayout} from './map-controls-layout.js';\nmountMapControlsLayout();\n";
 const parentBootstrap=source(`sandbox/${p.parent}/atlas/teleprinter-bootstrap.js`);
 assert.equal(hash(parentBootstrap),p.layout.parentBootstrapSha256);assert.equal(p.layout.initializer,initializer);
 assert.equal(parentBootstrap.toString(),`import '/testcode/${p.appGeneration}/atlas/teleprinter-bootstrap.js';\n`+initializer);
 assert.equal(hash(blob(prefix+'atlas/map-controls-layout.js')),p.layout.sha256);assert.equal(current.layout_cartridge.sha256,p.layout.sha256);
 expected+='\n'+initializer;
}else assert.equal(generation,'202609060447','New hosts must preserve and attest the existing layout initializer');
assert.equal(blob(prefix+'atlas/teleprinter-bootstrap.js').toString(),expected);assert.equal(hash(expected),p.bootstrapSha256);
const seen=new Set(),queue=[`sandbox/${p.hostGeneration}/tool-layers/host.js`];
while(queue.length){const q=queue.shift();if(seen.has(q))continue;seen.add(q);const bytes=source(q),receipt=p.dependencies.find(d=>d.path===q);assert(receipt,q);assert.equal(receipt.bytes,bytes.length);assert.equal(receipt.sha256,hash(bytes));assert.deepEqual(blob(q),bytes,'Immutable host dependency');for(const m of bytes.toString().matchAll(/from ['"]([^'"]+)['"]/g)){assert(m[1].startsWith('./'));queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(q),m[1])));}}
assert.equal(p.dependencies.length,seen.size);assert.equal(seen.size,8);
console.log(`PASS ${generation}: ${manifest.files.length} published files, four unchanged cartridges, ${seen.size} pinned host modules, original app owners and bootstrap reconstruction`);
