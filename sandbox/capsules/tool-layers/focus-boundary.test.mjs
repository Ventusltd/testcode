import test from 'node:test';
import assert from 'node:assert/strict';
import {bindFocusBoundary} from './focus-boundary.js';
test('Tab wraps at iframe boundaries and leaves internal traversal alone',()=>{
 let focused;
 const node=()=>({tabIndex:0,disabled:false,closest:()=>null,getClientRects:()=>[{}],focus(){focused=this;}});
 const close=node(), first=node(), middle=node(), last=node(), hidden={...node(),getClientRects:()=>[]};
 const child=new EventTarget();child.querySelectorAll=()=>[first,middle,last,hidden];child.defaultView={getComputedStyle:()=>({visibility:'visible'})};
 const layer=new EventTarget();layer.style={display:'flex'};const frame=new EventTarget();frame.contentDocument=child;
 const dispose=bindFocusBoundary(layer,frame,close);frame.dispatchEvent(new Event('load'));
 const press=(target,shiftKey=false)=>{const e=new Event('keydown',{cancelable:true});Object.defineProperties(e,{key:{value:'Tab'},target:{value:target},shiftKey:{value:shiftKey}});layer.dispatchEvent(e);return e;};
 assert.ok(press(close).defaultPrevented);assert.equal(focused,first);
 press(close,true);assert.equal(focused,last);
 press(last);assert.equal(focused,close);
 press(first,true);assert.equal(focused,close);
 assert.equal(press(middle).defaultPrevented,false);
 layer.style.display='none';assert.equal(press(close).defaultPrevented,false);
 dispose();layer.style.display='flex';assert.equal(press(close).defaultPrevented,false);
});

test('multiple header actions retain native order and wrap through currently visible buttons',()=>{
 let focused;const doc={defaultView:{getComputedStyle:()=>({visibility:'visible'})}};
 const node=()=>({tabIndex:0,disabled:false,hidden:false,ownerDocument:doc,closest:()=>null,getClientRects(){return this.hidden?[]:[{}];},focus(){focused=this;}});
 const close=node(),restart=node(),cancel=node(),first=node(),last=node();
 const child=new EventTarget();child.querySelectorAll=()=>[first,last];child.defaultView=doc.defaultView;
 const layer=new EventTarget();layer.style={display:'flex'};layer.querySelectorAll=()=>[close,restart,cancel];
 const frame=new EventTarget();frame.contentDocument=child;const dispose=bindFocusBoundary(layer,frame,close);frame.dispatchEvent(new Event('load'));
 const press=(target,shiftKey=false)=>{const e=new Event('keydown',{cancelable:true});Object.defineProperties(e,{key:{value:'Tab'},target:{value:target},shiftKey:{value:shiftKey}});layer.dispatchEvent(e);return e;};
 assert.equal(press(close).defaultPrevented,false);assert.equal(press(restart).defaultPrevented,false);
 press(cancel);assert.equal(focused,first);press(first,true);assert.equal(focused,cancel);
 cancel.hidden=true;press(first,true);assert.equal(focused,restart);press(restart);assert.equal(focused,first);
 press(last);assert.equal(focused,close);dispose();
});
