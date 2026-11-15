import test from 'node:test';import assert from 'node:assert/strict';
import {cardMachine,sync,wire} from './state.mjs';
const init=(phone=true)=>{const m=cardMachine();return [m,m.select(12588,'popup-a',phone)];};
test('mobile collapse and explicit restore outranks late updates',()=>{
 const [m,s]=init();assert.equal(s.collapsed,true);
 assert.equal(m.tap(s.token).expanded,true);
 for(let v=1;v<8;v++)assert.equal(m.refresh(s.token,v).expanded,true);
});
test('user re-minimise persists through late content',()=>{
 const [m,s]=init();m.tap(s.token);assert.equal(m.tap(s.token).collapsed,true);
 assert.equal(m.refresh(s.token,22).collapsed,true);
});
test('new project and same project new visit resets and rejects stale work',()=>{
 const [m,s]=init();m.tap(s.token);
 const b=m.select(12453,'popup-b',true);
 assert.equal(b.collapsed,true);assert.equal(m.tap(s.token),false);
 assert.equal(m.refresh(s.token,33),false);
 const c=m.select(12588,'popup-c',true);
 assert.equal(c.collapsed,true);assert.notEqual(c.token,s.token);
});
test('desktop starts expanded; stale measurement cannot undo newer',()=>{
 const [m,s]=init(false);assert.equal(s.expanded,true);
 assert.equal(m.refresh(s.token,5).version,5);
 assert.equal(m.refresh(s.token,4),false);
});
test('missing project/popup fail closed',()=>{
 const [m,s]=init();assert.throws(()=>m.select('', 'p',true));
 assert.throws(()=>m.select('2','',true));
 assert.equal(m.clear(s.token+1),false);
 assert.equal(m.clear(s.token),true);assert.equal(m.tap(s.token),false);
});
test('single sync handles CSS, plus/minus, ARIA and 44px touch size',()=>{
 const [m,s]=init(),cl=new Set(),attrs={};
 const popup={classList:{toggle(k,v){v?cl.add(k):cl.delete(k);}}};
 const button={style:{},setAttribute(k,v){attrs[k]=v;}};
 sync(s,popup,button);assert.equal(cl.has('gridatlas-min'),true);
 assert.equal(button.textContent,'+');assert.equal(attrs['aria-expanded'],'false');
 sync(m.tap(s.token),popup,button);assert.equal(cl.has('gridatlas-min'),false);
 assert.equal(button.textContent,'−');assert.equal(attrs['aria-expanded'],'true');
 assert.equal(attrs['aria-label'],'Hide project measurements');
 assert.equal(button.style.minWidth,'44px');assert.equal(button.style.minHeight,'44px');
});
test('actual click handler stops propagation and synchronously applies expansion',()=>{
 const [m,s]=init(),cl=new Set(),attrs={};let fn,geometry=0,stop=0,prevent=0;
 const popup={classList:{toggle(k,v){v?cl.add(k):cl.delete(k);}}};
 const button={style:{},setAttribute(k,v){attrs[k]=v;},
  addEventListener(k,f){fn=f;},removeEventListener(k,f){if(fn===f)fn=null;}};
 const unbind=wire(m,s.token,popup,button,()=>geometry++);
 fn({stopPropagation(){stop++},preventDefault(){prevent++}});
 assert.equal(m.state(s.token).expanded,true);assert.equal(cl.has('gridatlas-min'),false);
 assert.equal(stop,1);assert.equal(prevent,1);assert.equal(geometry,1);unbind();assert.equal(fn,null);
});
