import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const parent='202609060441',hostGeneration='202609052015',appGeneration='202609051906';
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const blob=p=>execFileSync('git',['show',sourceCommit+':'+p],{cwd:root,maxBuffer:64*1024*1024});
const hash=b=>createHash('sha256').update(b).digest('hex');
const generation=new Date().toISOString().replace(/[-:T]/g,'').slice(0,12),destination=path.join(root,'sandbox',generation);
assert(!fs.existsSync(destination),'Immutable generation already exists');
const write=(p,b)=>{const file=path.join(destination,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,b);};
const current=JSON.parse(blob(`sandbox/${parent}/atlas/current.json`));
for(const cartridge of current.cartridges)if(cartridge.path.startsWith('./'))cartridge.path=`/testcode/${parent}/atlas/${cartridge.path.slice(2)}`;
current.generation=generation;current.previous_generation=parent;current.composition_id=generation+'-testcode-atlas';current.live_route=`/testcode/${generation}/atlas/`;
current.testcode_increment={change:'Recover an unavailable design tool without resetting the Atlas polygon',source_commit:sourceCommit,host_generation:hostGeneration,original_apps_generation:appGeneration,status:'candidate awaiting actual browser, CI and served-byte checks'};
write('atlas/current.json',JSON.stringify(current,null,2)+'\n');
for(const name of ['index.html','map-controls-layout.js']){let b=blob(`sandbox/${parent}/atlas/${name}`);if(name==='index.html')b=Buffer.from(b.toString().replace('Test Code Atlas '+parent,'Test Code Atlas '+generation));write('atlas/'+name,b);}
const identityPaths=execFileSync('git',['ls-tree','-r','--name-only',sourceCommit,`sandbox/${parent}/atlas/data/repd-identities`],{cwd:root,encoding:'utf8'}).trim().split('\n');
for(const p of identityPaths)write('atlas/data/repd-identities/'+path.basename(p),blob(p));
const pins=JSON.parse(blob(`sandbox/${appGeneration}/atlas/tool-layers.json`));
const tools=pins.tools.map(tool=>{const owner=pins.owners.find(owner=>owner.applications.some(app=>app.id===tool.id));assert(owner);return{...tool,owner:{repository:owner.repository,commit:owner.commit,release:owner.release,manifestSha256:owner.manifestSha256}};});
const registry=[...tools];
for(const owner of pins.owners)for(const app of owner.applications)if(!registry.some(tool=>tool.id===app.id))registry.push({id:app.id,title:'DC/AC LV Topology Review',entry:'../layer-apps/'+app.entry,owner:{repository:owner.repository,commit:owner.commit,release:owner.release,manifestSha256:owner.manifestSha256}});
const originalBootstrap=blob(`sandbox/${appGeneration}/atlas/teleprinter-bootstrap.js`);
let bootstrap=originalBootstrap.toString().replaceAll("from '../teleprinter/",`from '/testcode/${appGeneration}/teleprinter/`)
 .replace("from '../tool-layers/host.js'",`from '/testcode/${hostGeneration}/tool-layers/host.js'`)
 .replace(/^mountToolLayers\([^\n]+$/m,`mountToolLayers(${JSON.stringify(tools)},new URL('/testcode/${appGeneration}/atlas/teleprinter-bootstrap.js',location.origin).href,${JSON.stringify(registry)});`)
 .replace("new URL('../teleprinter/', import.meta.url)",`new URL('/testcode/${appGeneration}/teleprinter/', location.origin)`);
write('atlas/teleprinter-bootstrap.js',bootstrap);
write('atlas/tool-layers.json',JSON.stringify({...pins,tools,registry,hostGeneration},null,2)+'\n');
const dependencies=[],queue=[`sandbox/${hostGeneration}/tool-layers/host.js`],seen=new Set();
while(queue.length){const p=queue.shift();if(seen.has(p))continue;seen.add(p);const bytes=blob(p);dependencies.push({path:p,sha256:hash(bytes),bytes:bytes.length});for(const match of bytes.toString().matchAll(/from ['"]([^'"]+)['"]/g)){assert(match[1].startsWith('./'),'Only explicit sibling modules are accepted');queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(p),match[1])));}}
write('atlas/source-provenance.json',JSON.stringify({schema:'gridatlas.tool-host-candidate.v1',generation,parent,sourceCommit,hostGeneration,appGeneration,originalBootstrapSha256:hash(originalBootstrap),bootstrapSha256:hash(bootstrap),dependencies,scope:'Only consumer tool-host composition changes. All four executable Atlas cartridges and original iframe application paths are retained.'},null,2)+'\n');
write('index.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recoverable design tools</title><body style="background:#0d1117;color:#7fe3d0;font:18px system-ui;padding:24px"><h1>Recoverable design tools</h1><p>Retry an unavailable tool while keeping your Atlas polygon and other open tools.</p><p><a style="color:inherit" href="atlas/">Open GridAtlas</a></p></body></html>`);
const files=[];function list(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())list(p);else{const b=fs.readFileSync(p);files.push({path:path.relative(destination,p).split(path.sep).join('/'),bytes:b.length,sha256:hash(b)});}}}list(destination);
write('publication.json',JSON.stringify({generation,lane:'codex',name:'Recoverable design tools with preserved Atlas drawings',source_commit:sourceCommit,source_repository:'Ventusltd/testcode',parent,status:'candidate awaiting browser and served-byte checks',files},null,2)+'\n');
console.log(JSON.stringify({generation,sourceCommit,files:files.length,hostModules:dependencies.length}));
