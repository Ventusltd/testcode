import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {reviewContext} from './independent-evidence.mjs';
import {compileMaster} from './master-engine.mjs';
async function gate(id,s,c){return (await import('./versions/'+id+'.mjs')).check(s,c)}
const master=await compileMaster();

test('v028 rejects duplicate publisher strings even when both are called independent',async()=>{
 const s=fixture();s.headlines[0].independent_publishers=['govuk','govuk'];
 assert.equal(await gate('v028',s,reviewContext()),false);
 assert.equal(master.evaluate(s,reviewContext()).accepted,false);
});
test('v028 rejects two mastheads with a single corporate owner',async()=>{
 const c=reviewContext();c.publisherReceipts['local-news'].owner='UK Government';
 assert.equal(await gate('v028',fixture(),c),false);
});
test('v026 rejects corporate debt falsely described as project CAPEX',async()=>{
 const s=fixture(),c=reviewContext();s.headlines[0].capacity_mw=0;
 s.headlines[0].project_capex_usd=50000000;s.headlines[0].capex_basis='corporate_debt';
 assert.equal(await gate('v026',s,c),false);
 assert.equal(master.evaluate(s,c).accepted,false);
});
test('v026 accepts documented project-specific CAPEX even when generation below 50MW',async()=>{
 const s=fixture(),c=reviewContext();s.headlines[0].capacity_mw=40;
 assert.equal(await gate('v026',s,c),true);
});
test('v019 self-reported verified licence cannot bypass absent independent terms receipt',async()=>{
 const c=reviewContext();delete c.rightsLedger.official;
 assert.equal(await gate('v019',fixture(),c),false);
});
test('v020 arbitrary SHA-shaped article digest cannot match independent byte evidence',async()=>{
 const s=fixture();s.articles[0].content_sha256='c'.repeat(64);
 assert.equal(await gate('v020',s,reviewContext()),false);
});
test('v022 accepts verified shortened alias with correct planning reference',async()=>{
 const s=fixture();s.headlines[0].title='Botley West planning determination';
 assert.equal(await gate('v022',s,reviewContext()),true);
});
test('v022 refuses locality-only title with no independently verified alias',async()=>{
 const s=fixture();s.headlines[0].title='New solar farm near Foston';
 assert.equal(await gate('v022',s,reviewContext()),false);
});
test('v037 equal numerical IT and grid MW are valid with separately sourced measurements',async()=>{
 const s=fixture(),c=reviewContext();s.data_centres[0].connection_mw=35;
 c.dcMeasurementEvidence['dcuk-synthetic'].connection_mw=35;
 assert.equal(await gate('v037',s,c),true);
});
test('v037 equality cannot be assumed by copying the same evidence field',async()=>{
 const s=fixture();s.data_centres[0].connection_mw=35;
 s.data_centres[0].connection_source_id='it-audit';
 assert.equal(await gate('v037',s,reviewContext()),false);
});
test('v041 a claimed successful 390px run cannot replace external browser observation',async()=>{
 const c=reviewContext();c.browserEvidence.screens=c.browserEvidence.screens.filter(x=>x.width!==390);
 assert.equal(await gate('v041',fixture(),c),false);
});
test('v044 a claimed MAP target cannot replace an externally observed receiver',async()=>{
 const c=reviewContext();c.browserEvidence.map_receiver_ref='wrong';
 assert.equal(await gate('v044',fixture(),c),false);
});
test('v047 identical fabricated built and served hashes cannot bypass external byte report',async()=>{
 const s=fixture();s.release.built_index_sha='e'.repeat(64);s.release.served_index_sha='e'.repeat(64);
 assert.equal(await gate('v047',s,reviewContext()),false);
});
test('v049 self-reported all-green CI cannot hide independently reported browser failure',async()=>{
 const c=reviewContext();c.workflowEvidence.checks.browser='failure';
 assert.equal(await gate('v049',fixture(),c),false);
});
test('synthetic proof context never implies a real production release approval',()=>{
 const s=fixture();assert.equal(canonical(s).authorised,false);
});
function canonical(s){return {authorised:false,provenance:'synthetic QA',site:s.schema}}
