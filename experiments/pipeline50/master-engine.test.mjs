import test from 'node:test';
import assert from 'node:assert/strict';
import {compileMaster} from './master-engine.mjs';
import {fixture,CLOCK} from './fixture.mjs';
import {versionNames} from './versions.mjs';

const master=await compileMaster();
test('distilled executable master accepts the valid synthetic snapshot',()=>{
 assert.equal(master.evaluate(fixture(),{now:CLOCK}).accepted,true);
 assert.equal(master.evaluate(fixture(),{now:CLOCK}).release_authorised,false);
});
for(const attack of versionNames){
 test('distilled executable master rejects mutated '+attack,async()=>{
  const {mutate}=await import('./versions/'+attack+'.mjs');
  const result=master.evaluate(mutate(fixture()),{now:CLOCK});
  assert.equal(result.accepted,false,attack);
  assert(result.failed.length>0,attack);
 });
}
test('distilled master produces stable selected rule inventory',()=>{
 assert(master.selected_versions.length>0&&master.selected_versions.length<=50);
 assert.equal(new Set(master.selected_versions).size,master.selected_versions.length);
 assert.match(master.source_sha256,/^[a-f0-9]{64}$/);
});
