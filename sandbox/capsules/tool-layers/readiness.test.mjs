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
 const doc={readyState:'complete',querySelector:()=>({}),querySelectorAll:()=>['formation_canvas','trench_canvas','bend_canvas'].map(id=>({...canvas,id}))};
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

for(const mode of ['null','throw'])test('external iframe '+mode+' access never becomes a loading timeout',async()=>{
 const frame=new EventTarget();Object.defineProperty(frame,'contentDocument',{get(){if(mode==='throw')throw Error('cross origin');return null;}});
 const status={dataset:{},setAttribute(){},textContent:''};
 const dispose=observeToolReadiness({id:'module-layout'},frame,status,{timeout:5,interval:1});frame.dispatchEvent(new Event('load'));
 await new Promise(resolve=>setTimeout(resolve,20));assert.equal(status.dataset.interface,'unavailable');assert.equal(status.dataset.timedOut,undefined);dispose();
});

test('observed Ready transition is retained when a subsequent draw changes the status',()=>{
 const original=globalThis.MutationObserver;let observer;
 globalThis.MutationObserver=class {constructor(callback){this.callback=callback;observer=this;}observe(){}disconnect(){this.disconnected=true;}notify(){if(!this.disconnected)this.callback();}};
 try {
  const marker={textContent:'Loading'};const frame=new EventTarget();frame.contentDocument={readyState:'complete',querySelector:()=>marker};
  const status={dataset:{},setAttribute(){},textContent:''};const dispose=observeToolReadiness({id:'module-layout'},frame,status,{timeout:500,interval:200});frame.dispatchEvent(new Event('load'));
  assert.equal(status.dataset.drawing,'pending');marker.textContent='Ready. Draw at map centre or pick a site.';observer.notify();assert.equal(status.dataset.drawing,'ready');
  marker.textContent='Rendered120 physical modules';observer.notify();assert.equal(status.dataset.drawing,'ready');dispose();
 } finally {globalThis.MutationObserver=original;}
});
test('a module that never reports Ready cannot gain readiness from rendered text',async()=>{
 const frame=new EventTarget();frame.contentDocument={readyState:'complete',querySelector:()=>({textContent:'Rendered120 physical modules'})};
 const status={dataset:{},setAttribute(){},textContent:''};const dispose=observeToolReadiness({id:'module-layout'},frame,status,{timeout:5,interval:1});frame.dispatchEvent(new Event('load'));
 await new Promise(resolve=>setTimeout(resolve,20));assert.equal(status.dataset.drawing,'pending');assert.equal(status.dataset.timedOut,'true');dispose();
});
