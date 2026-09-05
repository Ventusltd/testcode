import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeToolOwnership} from './ownership.mjs';
const old={repository:'layout',commit:'old',release:'1',manifestSha256:'a',applications:[{id:'cable',entry:'cable/index.html'},{id:'module',entry:'module/index.html'}]};
const next={repository:'cable',commit:'new',release:'2',manifestSha256:'b',applications:[{id:'cable',entry:'cable/index.html'}]};
const previous={owners:[old],tools:old.applications.map(app=>({...app,title:app.id}))};
test('migrate cable only; preserve module owner and historical bundle',()=>{
 const result=mergeToolOwnership(previous,next,next.applications);
 assert.equal(result.tools.find(x=>x.id==='cable').owner.repository,'cable');
 assert.equal(result.tools.find(x=>x.id==='module').owner.repository,'layout');
 assert.equal(result.owners.length,2);assert.equal(previous.tools[0].owner,undefined);
});
test('explicit provenance survives subsequent releases',()=>{
 const first=mergeToolOwnership(previous,next,next.applications);
 const second=mergeToolOwnership(first,{...next,commit:'newer'},next.applications);
 assert.equal(second.tools.find(x=>x.id==='cable').owner.commit,'newer');
 assert.equal(second.tools.find(x=>x.id==='module').owner.commit,'old');
});
test('ambiguous unpinned historical ownership is rejected',()=>{
 assert.throws(()=>mergeToolOwnership({...previous,owners:[old,next]},next,next.applications),/Ambiguous/);
});
test('partial update of one producer retains the older manifest for untouched tools',()=>{
 const historical={...old,applications:[...old.applications,{id:'dc',entry:'dc/index.html'}]};
 const seed={owners:[historical],tools:historical.applications.map(app=>({...app,title:app.id}))};
 const first=mergeToolOwnership(seed,next,next.applications);
 const updated={...old,commit:'layout-new',release:'3',manifestSha256:'c',applications:[old.applications[1]]};
 const result=mergeToolOwnership(first,updated,updated.applications);
 assert.equal(result.tools.find(x=>x.id==='module').owner.commit,'layout-new');
 assert.equal(result.tools.find(x=>x.id==='dc').owner.commit,'old');
 assert.ok(result.owners.some(x=>x.repository==='layout' && x.commit==='old'));
 assert.ok(result.owners.some(x=>x.repository==='layout' && x.commit==='layout-new'));
 assert.equal(result.tools.find(x=>x.id==='cable').owner.commit,'new');
});
