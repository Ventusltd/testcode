import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNavigationRegistry} from './registry.mjs';

const app=id=>({id,entry:'solar-bess-topology-v7/'+id+'/index.html'});
const owner=(char,apps)=>({repository:'https://github.com/Ventusltd/layout-tool.git',commit:char.repeat(40),release:'202609051955',manifestSha256:char.repeat(64),applications:apps});
const tool=(id,pin,title=id)=>({id,title,entry:'../layer-apps/'+app(id).entry,owner:{repository:pin.repository,commit:pin.commit,release:pin.release,manifestSha256:pin.manifestSha256}});
function fixture() {
  const old=owner('a',[app('module-layout'),app('dc-ac-lv-topology-review')]);
  old.crossOwnerNavigation=[{path:'historical-sibling',commit:'c'.repeat(40)}];
  const current=owner('b',[app('module-layout')]);
  return {owners:[old,current],tools:[tool('module-layout',current,'Module Layout')]};
}

test('explicit current owner wins while unlaunched DC retains its sole historical producer',()=>{
  const config=fixture(),before=JSON.stringify(config),entries=buildNavigationRegistry(config);
  assert.equal(entries.length,2);
  const module=entries.find(x=>x.id==='module-layout'),dc=entries.find(x=>x.id==='dc-ac-lv-topology-review');
  assert.equal(module.owner.commit,'b'.repeat(40));assert.equal(module.title,'Module Layout');
  assert.equal(dc.owner.commit,'a'.repeat(40));assert.equal(dc.title,'DC/AC LV Topology Review');
  assert.equal(dc.entry,'../layer-apps/solar-bess-topology-v7/dc-ac-lv-topology-review/index.html');
  module.owner.commit='f'.repeat(40);assert.equal(JSON.stringify(config),before);
  assert.equal('crossOwnerNavigation' in dc.owner,false);
});

test('multiple historical destinations require an explicit selection',()=>{
  const config=fixture();config.tools=[];
  assert.throws(()=>buildNavigationRegistry(config),/Ambiguous unlaunched/);
  config.tools=[tool('module-layout',config.owners[1])];
  assert.equal(buildNavigationRegistry(config).length,2);
});

test('unbound explicit pins and forged destinations are rejected',()=>{
  const config=fixture();config.tools[0].owner.commit='c'.repeat(40);
  assert.throws(()=>buildNavigationRegistry(config),/does not match/);
  config.tools[0]=tool('module-layout',config.owners[1]);config.tools[0].entry='../elsewhere/index.html';
  assert.throws(()=>buildNavigationRegistry(config),/does not match/);
  config.tools[0]=tool('missing',config.owners[1]);assert.throws(()=>buildNavigationRegistry(config),/does not match/);
});

test('duplicate exact historical records deduplicate but duplicate tools are refused',()=>{
  const config=fixture();config.owners.push(structuredClone(config.owners[0]));
  assert.equal(buildNavigationRegistry(config).length,2);
  config.tools.push(structuredClone(config.tools[0]));assert.throws(()=>buildNavigationRegistry(config),/Duplicate explicit/);
});

test('traversal, incomplete owner pins and colliding destination paths are rejected',()=>{
  for(const path of ['../escape','/absolute','a\\b','https://x/app','a/./b','a//b','a/index.html?x=1','a/%2e%2e/escape']) {
    const config=fixture();config.owners[0].applications[1].entry=path;
    assert.throws(()=>buildNavigationRegistry(config),/Unsafe/);
  }
  const config=fixture();config.owners[0].commit='main';assert.throws(()=>buildNavigationRegistry(config),/Complete navigation owner/);
  const collision=fixture();collision.owners[0].applications[1].entry=app('module-layout').entry;
  assert.throws(()=>buildNavigationRegistry(collision),/share a navigation destination/);
});
