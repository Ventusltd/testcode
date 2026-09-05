import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildToolSourceScopes} from './source-scopes.mjs';

const sha=raw=>createHash('sha256').update(raw).digest('hex');
function fixture() {
  const bodies=new Map([['apps/one/index.html',Buffer.from('<script src="app.js"></script>')],['apps/one/app.js',Buffer.from('const original=1;')],['apps/two/index.html',Buffer.from('<p>Sibling</p>')],['shared/grid.geojson',Buffer.from('{"type":"FeatureCollection","features":[]}')]]);
  const manifest={schema:'globalgrid.original-runtime.v1',generation:'202609051858',applications:[{id:'one',entry:'apps/one/index.html'},{id:'two',entry:'apps/two/index.html'}],files:[...bodies].map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha(bytes)})),externalLiteralUrls:['https://example.test/library.js'],rootOriginDependencies:['/shared.json'],crossOwnerNavigation:[{path:'sibling/index.html',commit:'a'.repeat(40)}]};
  const reads=[];const owner={repository:'Ventusltd/fixture',commit:'a'.repeat(40),release:manifest.generation,manifestSha256:''};
  const tool={id:'one',title:'One',entry:'../layer-apps/apps/one/index.html',owner};
  const pin=()=>{const raw=Buffer.from(JSON.stringify(manifest));owner.manifestSha256=sha(raw);return raw;};
  const readCandidate=async path=>{reads.push(path);const b=bodies.get(path.replace(/^layer-apps\//,''));if(!b)throw Error('Missing fixture candidate');return b;};
  const run=()=>{const raw=pin();return buildToolSourceScopes([tool],async()=>raw,readCandidate);};
  return {bodies,manifest,reads,owner,tool,pin,readCandidate,run};
}

test('own source and shared data are included while sibling runtime remains separate',async()=>{
  const f=fixture(),before=JSON.stringify(f.manifest),out=await f.run();
  assert.equal(out.apps.length,1);assert.deepEqual(out.apps[0].files.map(x=>x.path),['layer-apps/apps/one/index.html','layer-apps/apps/one/app.js','layer-apps/shared/grid.geojson']);
  assert.equal(out.apps[0].files.at(-1).kind,'data');assert.equal(out.apps[0].files[1].kind,'source');
  assert.equal(f.reads.includes('layer-apps/apps/two/index.html'),false);
  assert.deepEqual(out.apps[0].baselineNavigation,f.manifest.crossOwnerNavigation);assert.deepEqual(out.apps[0].externalDependencies,f.manifest.externalLiteralUrls);
  assert.equal(JSON.stringify(f.manifest),before);assert.equal(JSON.stringify(out).includes('const original=1'),false);
});

test('manifest pin, release identity and entry binding are mandatory',async()=>{
  const f=fixture();const raw=f.pin();
  await assert.rejects(buildToolSourceScopes([f.tool],async()=>Buffer.concat([raw,Buffer.from(' ')]),f.readCandidate),/manifest pin mismatch/);
  f.owner.release='202609051859';await assert.rejects(f.run(),/release identity/);
  f.owner.release=f.manifest.generation;f.tool.entry='../layer-apps/apps/two/index.html';await assert.rejects(f.run(),/entry mismatch/);
});

test('composed byte tampering and missing entry are refused',async()=>{
  const f=fixture();f.bodies.set('apps/one/app.js',Buffer.from('const altered=2;'));
  await assert.rejects(f.run(),/differs from owner/);
  const absent=fixture();absent.manifest.files=absent.manifest.files.filter(x=>x.path!=='apps/one/index.html');
  await assert.rejects(absent.run(),/entry absent/);
});

test('unknown schema and malformed manifest arrays cannot become scopes',async()=>{
  for(const mutate of [m=>m.schema='unverified.v1',m=>m.applications={},m=>m.files=null,m=>m.applications[0].entry=null]) {
    const f=fixture();mutate(f.manifest);await assert.rejects(f.run());assert.equal(f.reads.length,0);
  }
});

test('excluded siblings cannot hide unsafe paths or duplicate manifest identities',async()=>{
  for(const mutate of [
    m=>m.files.push({...m.files[2],path:'apps/two/../../escape.js'}),
    m=>m.files.push({...m.files[2]}),
    m=>m.applications.push({...m.applications[0]}),
    m=>m.files[2].sha256='not-a-hash',
    m=>m.files[2].bytes=-1
  ]) {
    const f=fixture();mutate(f.manifest);await assert.rejects(f.run());assert.equal(f.reads.length,0);
  }
});

test('encoded traversal and an unmanifested entry cannot escape their declared scope',async()=>{
  const f=fixture();f.manifest.files[1].path='apps/one/%2e%2e/escape.js';await assert.rejects(f.run());
  const empty=fixture();empty.manifest.applications=[];await assert.rejects(empty.run());
});

function derivedFixture(mutateBaseline=()=>{},mutatePin=()=>{}) {
  const f=fixture(),baseline=structuredClone(f.manifest);
  baseline.generation='202609051857';mutateBaseline(baseline);
  const original=Buffer.from(JSON.stringify(baseline));
  f.manifest.schema='globalgrid.derived-runtime.v1';delete f.manifest.externalLiteralUrls;
  f.manifest.baseline={commit:'b'.repeat(40),generation:'202609051857',manifestSha256:sha(original)};mutatePin(f.manifest.baseline);
  const current=f.pin();
  const run=()=>buildToolSourceScopes([f.tool],async owner=>owner.commit===f.owner.commit?current:original,f.readCandidate);
  return {...f,baseline,run};
}

test('derived external declarations come from a separately hash-bound original baseline',async()=>{
  const f=derivedFixture(),out=await f.run();
  assert.deepEqual(out.apps[0].externalDependencies,['https://example.test/library.js']);
});

test('baseline dependency metadata cannot bypass identity, schema or array checks',async()=>{
  for(const [mutate,pin] of [
    [m=>m.generation='202609051856',()=>{}],
    [m=>m.schema='unknown.v1',()=>{}],
    [m=>m.externalLiteralUrls='not-an-array',()=>{}],
    [()=>{},p=>p.commit='main'],
    [()=>{},p=>p.manifestSha256='0'.repeat(64)]
  ]) {
    const f=derivedFixture(mutate,pin);await assert.rejects(f.run());assert.equal(f.reads.length,0);
  }
});
