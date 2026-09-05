import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveToolDestination,bindToolNavigation} from './navigation.js';

const base='https://globalgrid2050.com/testcode/202609052011/atlas/tool-layers.json';
const entry=(id,title,char)=>({id,title,entry:'../layer-apps/solar-bess-topology-v7/'+id+'/index.html',owner:{repository:'Ventusltd/'+id,commit:char.repeat(40),release:'202609052008',manifestSha256:char.repeat(64)}});
const registry=[entry('gis-sld-financial-sandbox','GIS SLD','a'),entry('module-layout','Module Layout','b'),entry('dc-ac-lv-topology-review','DC/AC LV Topology Review','c')];
const href=tool=>new URL(tool.entry,base).href;
function fixture() {
  const layer=new EventTarget();layer.dataset={};layer.setAttribute=(k,v)=>{layer[k]=v;};
  const frame=new EventTarget();frame.src=href(registry[0]);frame.contentWindow={location:{href:frame.src}};
  frame.contentDocument={readyState:'complete',querySelector:s=>s==='#btn_draw'?{}:null};
  const title={textContent:''},status={dataset:{},setAttribute(){},textContent:''};
  let changed=0;layer.addEventListener('tool-document-changed',()=>changed++);
  const dispose=bindToolNavigation(layer,frame,title,status,registry,base,registry[0]);
  const load=(url,doc=frame.contentDocument)=>{frame.contentWindow={location:{href:url}};frame.contentDocument=doc;frame.dispatchEvent(new Event('load'));};
  return {layer,frame,title,status,dispose,load,get changed(){return changed;}};
}

test('resolution preserves query/hash semantics and rejects a different origin or unknown path',()=>{
  assert.equal(resolveToolDestination(href(registry[1])+'?project=5#layout',registry,base),registry[1]);
  assert.equal(resolveToolDestination(href(registry[1]).replace('globalgrid2050.com','other.example'),registry,base),null);
  assert.equal(resolveToolDestination('https://globalgrid2050.com/unknown',registry,base),null);
});

test('actual child location replaces stale frame src and rebinds title, owner and readiness',()=>{
  const f=fixture();try {
    f.load(href(registry[0]));assert.equal(f.layer.dataset.currentTool,registry[0].id);
    const target=href(registry[1])+'?same=1#layout';
    f.load(target,{readyState:'complete',querySelector:s=>s==='#ml_status'?{textContent:'Ready. Draw at map centre or pick a site.'}:null});
    assert.equal(f.frame.src,href(registry[0]));assert.equal(f.frame.contentWindow.location.href,target);
    assert.equal(f.title.textContent,'Module Layout');assert.equal(f.frame.title,'Module Layout');assert.equal(f.layer['aria-label'],'Module Layout');
    assert.equal(f.layer.dataset.currentOwner,JSON.stringify(registry[1].owner));assert.equal(f.status.dataset.toolReadiness,'module-layout');
    assert.equal(f.status.dataset.drawing,'ready');assert.equal(f.changed,2);
    f.load(href(registry[2]));assert.equal(f.title.textContent,'DC/AC LV Topology Review');assert.equal(f.status.dataset.drawing,'unreported');
    assert.equal(f.status.dataset.interface,'unreported');assert.equal(f.status.textContent,'Page loaded; drawing readiness unreported');
  } finally {f.dispose();}
});

test('unknown and inaccessible documents clear stale pins without being labelled ready',()=>{
  const f=fixture();try {
    f.load(href(registry[0]));f.status.dataset.timedOut='true';
    f.load('https://globalgrid2050.com/linked-page');
    assert.equal(f.title.textContent,'Linked page');assert.equal(f.layer.dataset.currentOwner,undefined);assert.equal(f.status.dataset.toolReadiness,undefined);assert.equal(f.status.dataset.interface,'unbound');assert.equal(f.status.dataset.timedOut,undefined);
    Object.defineProperty(f.frame,'contentWindow',{configurable:true,get(){throw Error('cross-origin');}});
    f.frame.dispatchEvent(new Event('load'));assert.equal(f.status.dataset.interface,'unbound');assert.equal(f.layer.dataset.currentTool,undefined);
  } finally {f.dispose();}
});

test('disposal removes navigation listener and leaves later load events untouched',()=>{
  const f=fixture();f.load(href(registry[0]));const title=f.title.textContent,count=f.changed;f.dispose();
  f.load(href(registry[2]));assert.equal(f.title.textContent,title);assert.equal(f.changed,count);
});
