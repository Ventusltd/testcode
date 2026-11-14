import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,CLOCK} from './fixture.mjs';
import {versionNames} from './versions.mjs';
import {distil} from './master.mjs';
for(const v of versionNames){
 test(v+' accepts the controlled valid synthetic snapshot',async()=>{const mod=await import('./versions/'+v+'.mjs');assert.equal(mod.check(fixture(),{now:CLOCK}),true)});
 test(v+' rejects its adversarial negative mutation',async()=>{const mod=await import('./versions/'+v+'.mjs');const source=fixture();assert.equal(mod.check(mod.mutate(source),{now:CLOCK}),false)});
}
test('all 50 code versions have unique IDs and independent evidence',async()=>{assert.equal(versionNames.length,50);assert.equal(new Set(versionNames).size,50);const m=await distil();assert.equal(m.accepted_versions,50);assert.equal(m.rejected_versions.length,0);assert.equal(new Set(m.versions.map(x=>x.source_sha256)).size,50)});
