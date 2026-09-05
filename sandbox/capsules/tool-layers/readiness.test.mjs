import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectToolReadiness,observeToolReadiness} from './readiness.js';
test('module DOM completion does not masquerade as map readiness',()=>{
 const doc={readyState:'complete',querySelector:()=>({textContent:'Loading'})};
 assert.equal(inspectToolReadiness('module-layout',doc).drawing,'pending');
 doc.querySelector=()=>({textContent:'Ready. Draw at map centre or pick a site.'});
 assert.equal(inspectToolReadiness('module-layout',doc).drawing,'ready');
});
test('prefilled Cable text is insufficient until all three canvases draw',()=>{
 let alpha=0;const canvas={width:64,height:8,getContext:()=>({getImageData:()=>({data:Array.from({length:2048},(_,i)=>i%4===3?alpha:(i%4===0?Math.floor(i/64)%2*255:0))})})};
 const doc={readyState:'complete',querySelectorAll:()=>['formation_canvas','trench_canvas','bend_canvas'].map(id=>({...canvas,id}))};
 assert.equal(inspectToolReadiness('cable-geometry-visualiser',doc).drawing,'pending');
 alpha=255;assert.equal(inspectToolReadiness('cable-geometry-visualiser',doc).drawing,'ready');
});
test('GIS reports interface separately and never infers map readiness',()=>{
 assert.deepEqual(inspectToolReadiness('gis-sld-financial-sandbox',{readyState:'complete',querySelector:()=>({})}),{interface:'loaded',drawing:'unreported',label:'Interface loaded'});
 assert.equal(inspectToolReadiness('module-layout',{readyState:'loading'}).interface,'loading');
});

test('never-loading iframe times out and a later successful load clears stale timeout',async()=>{
 const frame=new EventTarget();frame.contentDocument={readyState:'complete',querySelector:()=>({})};
 const status={dataset:{},setAttribute(){},textContent:''};
 const dispose=observeToolReadiness({id:'gis-sld-financial-sandbox'},frame,status,{timeout:5,interval:1});
 await new Promise(resolve=>setTimeout(resolve,20));assert.equal(status.dataset.timedOut,'true');
 frame.dispatchEvent(new Event('load'));assert.equal(status.dataset.timedOut,undefined);assert.equal(status.dataset.interface,'loaded');dispose();
});
