import assert from 'node:assert/strict';
import {assess} from './receipt-gate.mjs';
const h='a'.repeat(64),s='b'.repeat(40);
const base={
 mode:'real-browser',pipelineSha:s,gridatlasSha:s,sourceSha256:h,servedSha256:h,
 generation:'202611132345',repdRef:12588,technology:'solar',lat:51.5,lon:-1.2,
 mapHref:'https://ventusltd.github.io/gridatlas/atlas/?repd_ref=12588',
 clickedUrl:'https://ventusltd.github.io/gridatlas/atlas/?repd_ref=12588',
 canonicalReceiver:true,cartridgesVerified:6,technologyLayerEnabled:true,
 projectLayerEnabled:true,nearestComputed:true,distanceKm:15.76,
 initialCollapsed:true,restoreClicks:1,afterClickCollapsed:false,
 nearestRenderedVisible:true,stableMs:5000,visibleAt5s:true,
 hitWidth:44,hitHeight:44,initialGlyph:'+',expandedGlyph:'−',
 ariaExpanded:'true',accessibleLabel:'Hide project measurements',
 jsErrors:[],engineFailures:[],screenshot:'trace/sample.png',
 trace:'trace/sample.zip',browser:'chromium',width:390
};
// This CONTROL proves ONLY the validator, never that any browser was exercised.
assert.equal(assess(base).status,'PASS');
const variants=[
 ['hidden DOM',{nearestRenderedVisible:false}],
 ['late collapse',{afterClickCollapsed:true}],
 ['zero click',{restoreClicks:0}],
 ['wrong identity',{clickedUrl:'https://ventusltd.github.io/gridatlas/atlas/?repd_ref=100'}],
 ['wrong technology',{technology:'not-solar'}],
 ['missing coordinate',{lat:null}],
 ['unverified cartridge',{cartridgesVerified:5}],
 ['wrong served hash',{servedSha256:'c'.repeat(64)}],
 ['fake mode',{mode:'synthetic'}],
 ['missing destination',{canonicalReceiver:false}],
 ['small touch target',{hitWidth:20}],
 ['stale glyph',{initialGlyph:'−'}],
 ['missing aria',{accessibleLabel:''}],
 ['early vanish',{stableMs:500}],
 ['vanishes at five seconds',{visibleAt5s:false}],
 ['JS error',{jsErrors:['boom']}],
 ['engine failure',{engineFailures:['failure']}],
 ['missing trace',{trace:''}],
 ['no project layer',{projectLayerEnabled:false}],
 ['no actual nearest',{nearestComputed:false}],
 ['unsupported browser',{browser:'fake'}]
];
for(const [label,mutant] of variants){
 const result=assess({...base,...mutant});
 assert.equal(result.status,'FAIL',label);
 assert.ok(result.failures.length,'must explain rejection: '+label);
}
console.log('SELFTEST: 1 SYNTHETIC control, '+variants.length+' deliberately broken receipts rejected. This is NOT GridAtlas product/browser PASS.');
