import test from 'node:test';
import assert from 'node:assert/strict';
import {analyse,EXPECTED} from './real-audit.mjs';
function pair(){
const top=Array.from({length:200},(_,i)=>({repd_ref:String(10000+i)}));
const projects=Object.fromEntries(top.map(x=>[x.repd_ref,{repd_ref:x.repd_ref,signals:[],planning_file:{kind:'search_page'}}]));
projects['10000'].signals=[{repd_ref:'10000',title:'Example story',link:'https://www.gov.uk/a',date:'2026-11-13',family:'regional',basis:'reviewed 2026-11-14'}];
return [top,{schema:'project-signals.v1',projects,sources:[{status:'failed'}]}];
}
test('the known pinned SHA256 values are explicit and cannot drift silently',()=>{
 assert.equal(EXPECTED.top,'3a23c8495f00e613a8f0f81b2db5374a19ba89d832e913c6f821823def6b49a5');
 assert.equal(EXPECTED.data,'15586a71613df59fc7bbdbdce852ebb71b19f663f0e269ca4d9fedb7225afe03');
});
test('structurally correct but unlicensed data can only return HOLD',()=>{
 const r=analyse(...pair());assert.equal(r.result,'STRUCTURE_VALID_RELEASE_HOLD');assert.equal(r.production_release_authorised,false);
 assert(r.holds.some(s=>s.includes('rights')));
});
test('a 199-row candidate is rejected',()=>{const [t,d]=pair();delete d.projects['10001'];assert.equal(analyse(t,d).result,'FAIL')});
test('a fabricated project ID is rejected even with exactly 200 rows',()=>{
 const [t,d]=pair();d.projects['999999']={...d.projects['10001'],repd_ref:'999999'};delete d.projects['10001'];assert.equal(analyse(t,d).result,'FAIL');
});
test('a future article date fails rather than receiving a fresh label',()=>{
 const [t,d]=pair();d.projects['10000'].signals[0].date='2026-11-15';assert.equal(analyse(t,d).result,'FAIL');
});
test('generic search-page links counted but never called verified application files',()=>{
 const r=analyse(...pair());assert.equal(r.facts.planning_search_fallbacks,200);assert(r.warnings.some(s=>s.includes('fallbacks')));
});
