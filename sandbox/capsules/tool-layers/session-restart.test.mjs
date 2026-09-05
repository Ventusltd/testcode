import test from 'node:test';
import assert from 'node:assert/strict';
import {mountSessionRestart} from './session-restart.js';

function fixture() {
  let focused;
  class Element extends EventTarget {
    constructor(tag, doc) {super();this.tagName=tag;this.ownerDocument=doc;this.children=[];this.style={};this.dataset={};this.hidden=false;}
    setAttribute(name,value) {this[name]=value;}
    append(...nodes) {for(const node of nodes){node.parent=this;this.children.push(node);}}
    remove() {if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
    focus() {focused=this;}
    click() {this.dispatchEvent(new Event('click'));}
  }
  const doc={createElement:tag=>new Element(tag,doc)};
  const layer=new Element('section',doc),bar=new Element('header',doc);
  const frame=new EventTarget(),otherFrame={src:'other-tool',state:{drawn:665}};
  let navigations=0,current='original-tool',starts=0;
  Object.defineProperty(frame,'src',{get:()=>current,set:value=>{current=value;navigations++;}});
  frame.addEventListener('tool-navigation-start',()=>starts++);
  const api=mountSessionRestart(layer,bar,frame,'pinned-tool-entry');
  const row=bar.children[0], [restart,cancel,note]=row.children;
  return {layer,bar,frame,otherFrame,api,restart,cancel,note,
    get navigations(){return navigations;},get starts(){return starts;},get focused(){return focused;}};
}

test('confirmation is explicit and reloads only the selected iframe once',()=>{
  const f=fixture();f.restart.click();
  assert.equal(f.navigations,0);assert.equal(f.restart.textContent,'Confirm restart');assert.equal(f.cancel.hidden,false);
  f.restart.click();assert.equal(f.navigations,1);assert.equal(f.starts,1);assert.equal(f.frame.src,'pinned-tool-entry');
  assert.deepEqual(f.otherFrame,{src:'other-tool',state:{drawn:665}});
  assert.equal(f.restart.textContent,'Restart tool');assert.equal(f.cancel.hidden,true);
  f.api.dispose();
});

test('cancel and layer dismissal disarm confirmation without navigation',()=>{
  const f=fixture();f.restart.click();f.cancel.click();
  assert.equal(f.navigations,0);assert.equal(f.focused,f.restart);assert.equal(f.cancel.hidden,true);
  f.restart.click();f.layer.dispatchEvent(new Event('tool-layer-dismissed'));
  assert.equal(f.restart.textContent,'Restart tool');assert.equal(f.note.textContent,'');
  f.restart.click();assert.equal(f.navigations,0);assert.equal(f.restart.textContent,'Confirm restart');
  f.api.dispose();
});

test('repeated recovery requests only arm confirmation and never reload',()=>{
  const f=fixture();f.api.requestConfirmation();f.api.requestConfirmation();
  assert.equal(f.navigations,0);assert.equal(f.starts,0);assert.equal(f.restart.textContent,'Confirm restart');
  f.cancel.click();f.api.requestConfirmation();assert.equal(f.navigations,0);
  f.restart.click();assert.equal(f.navigations,1);assert.equal(f.starts,1);
  f.api.dispose();
});

test('disposal removes session controls and detaches the layer listener',()=>{
  const f=fixture();f.api.requestConfirmation();f.api.dispose();
  assert.equal(f.bar.children.length,0);
  // A detached control is retained only by this fixture: no layer event may mutate it.
  const label=f.restart.textContent;f.layer.dispatchEvent(new Event('tool-layer-dismissed'));
  assert.equal(f.restart.textContent,label);assert.equal(f.navigations,0);
  f.restart.click();f.restart.click();f.cancel.click();
  assert.equal(f.navigations,0);assert.equal(f.starts,0);
});
