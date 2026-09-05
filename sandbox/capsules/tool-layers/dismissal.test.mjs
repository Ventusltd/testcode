import test from 'node:test';
import assert from 'node:assert/strict';
import {bindLayerDismissal} from './dismissal.js';
const key = (name='Escape') => {const event=new Event('keydown',{cancelable:true});Object.defineProperty(event,'key',{value:name});return event;};
test('parent and child Escape close only visible layers and cleanup removes listeners',()=>{
 const layer=new EventTarget();layer.style={display:'flex'};
 const frame=new EventTarget();frame.contentDocument=new EventTarget();let count=0;
 const dispose=bindLayerDismissal(layer,frame,()=>count++);
 frame.dispatchEvent(new Event('load'));layer.dispatchEvent(key('Enter'));assert.equal(count,0);
 frame.contentDocument.dispatchEvent(key());assert.equal(count,1);
 layer.style.display='none';layer.dispatchEvent(key());assert.equal(count,1);
 layer.style.display='flex';const consumed=key();consumed.preventDefault();layer.dispatchEvent(consumed);assert.equal(count,1);
 dispose();layer.dispatchEvent(key());frame.contentDocument.dispatchEvent(key());assert.equal(count,1);
});
test('iframe reload detaches its previous document',()=>{
 const layer=new EventTarget();layer.style={display:'flex'};const frame=new EventTarget();
 const old=new EventTarget();frame.contentDocument=old;let count=0;
 const dispose=bindLayerDismissal(layer,frame,()=>count++);frame.dispatchEvent(new Event('load'));
 frame.contentDocument=new EventTarget();frame.dispatchEvent(new Event('load'));old.dispatchEvent(key());assert.equal(count,0);
 frame.contentDocument.dispatchEvent(key());assert.equal(count,1);dispose();
});
