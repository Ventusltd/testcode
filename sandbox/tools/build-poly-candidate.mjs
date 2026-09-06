import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {compact,proveEquivalent,replaceMapEngine,PARSER} from './token-compaction.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2), arg=(key,fallback)=>{const i=args.indexOf('--'+key);return i<0?fallback:args[i+1];};
const owner=arg('owner',process.env.GRIDATLAS_REPO||'C:/Users/vikra/atlas-labels-20260906');
const ownerCommit=arg('commit');assert(/^[a-f0-9]{40}$/.test(ownerCommit),'Pin the full source commit');
const enginePath=arg('engine'),modulePath=arg('module'),parent=arg('parent','202609060300');
assert(/^\d{12}$/.test(parent));
const now=new Date(),generation=now.toISOString().replace(/[-:T]/g,'').slice(0,12);
const destination=path.join(root,'sandbox',generation);assert(!fs.existsSync(destination),'Immutable generation already exists');
const blob=(repo,p,sha='HEAD')=>execFileSync('git',['show',`${sha}:${p}`],{cwd:repo,maxBuffer:64*1024*1024});
const hash=b=>createHash('sha256').update(b).digest('hex');
const write=(p,b)=>{const f=path.join(destination,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,b);};
const current=JSON.parse(blob(root,`sandbox/${parent}/atlas/current.json`));
const cartridge=current.cartridges.find(c=>c.id==='substation-intelligence');assert(cartridge);
const parentPath=cartridge.path.startsWith('/testcode/')?'sandbox/'+cartridge.path.slice(10):`sandbox/${parent}/atlas/${cartridge.path.replace(/^\.\//,'')}`;
const before=blob(root,parentPath);assert.equal(hash(before),cartridge.sha256);
const engine=blob(owner,enginePath,ownerCommit),module=blob(owner,modulePath,ownerCommit);
// The parser selects the carried engine boundary. All sibling modules remain byte-identical before compaction.
const assembled=replaceMapEngine(before.toString(),engine.toString(),module.toString());
const payload='/* '+generation+'; source and token/AST compaction receipts in source-provenance.json. */\n'+compact(assembled);
proveEquivalent(assembled,payload);
assert(payload.length<=368640,'The established cartridge size ceiling remains in force');
for(const entry of current.cartridges) {
  if(entry.path.startsWith('./'))entry.path=`/testcode/${parent}/atlas/${entry.path.slice(2)}`;
}
cartridge.path=`./cartridges/${generation}-substation-intelligence.js`;
cartridge.sha256=hash(payload);cartridge.generation=generation;cartridge.version='testcode-'+generation;
const title=arg('title','Polygon and circle measurements outside the active drawing area');
current.generation=generation;current.previous_generation=parent;current.composition_id=generation+'-testcode-atlas';current.live_route=`/testcode/${generation}/atlas/`;
current.testcode_increment={change:title,owner_commit:ownerCommit,owner_engine:enginePath,owner_module:modulePath,status:'candidate awaiting browser, CI and served-byte checks'};
write('atlas/'+cartridge.path.slice(2),payload);
write('atlas/current.json',JSON.stringify(current,null,2)+'\n');
for(const name of ['index.html','map-controls-layout.js','teleprinter-bootstrap.js']) {
  let bytes=blob(root,`sandbox/${parent}/atlas/${name}`);
  if(name==='index.html')bytes=Buffer.from(bytes.toString().replace('Test Code Atlas '+parent,'Test Code Atlas '+generation));
  write('atlas/'+name,bytes);
}
const shards=execFileSync('git',['ls-tree','-r','--name-only','HEAD',`sandbox/${parent}/atlas/data/repd-identities`],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const p of shards)write('atlas/data/repd-identities/'+path.basename(p),blob(root,p));
const provenance={schema:'gridatlas.poly-candidate-provenance.v1',generation,parent,ownerCommit,engine:{path:enginePath,sha256:hash(engine)},module:{path:modulePath,sha256:hash(module)},parentCartridge:{path:parentPath,sha256:hash(before)},assembledSha256:hash(assembled),payloadSha256:hash(payload),characters:payload.length,parser:PARSER,proof:'Exact token text and complete syntax tree match before/after compaction; unchanged strings, CSS and regular expressions.'};
write('atlas/source-provenance.json',JSON.stringify(provenance,null,2)+'\n');
write('index.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GridAtlas ${generation}</title><body style="background:#0d1117;color:#7fe3d0;font:18px system-ui;padding:24px"><h1>GridAtlas ${generation}</h1><p>${title}</p><p><a style="color:inherit" href="atlas/">Open GridAtlas</a></p><p><a style="color:inherit" href="/testcode/${parent}/atlas/">Previous GridAtlas</a></p></body></html>`);
const files=[];
function list(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())list(p);else{const b=fs.readFileSync(p);files.push({path:path.relative(destination,p).split(path.sep).join('/'),bytes:b.length,sha256:hash(b)});}}}
list(destination);write('publication.json',JSON.stringify({generation,lane:'codex',name:title,builtUTC:now.toISOString(),source_commit:ownerCommit,parent,status:'candidate awaiting browser and served-byte checks',files},null,2)+'\n');
console.log(JSON.stringify({generation,characters:payload.length,files:files.length,ownerCommit}));
