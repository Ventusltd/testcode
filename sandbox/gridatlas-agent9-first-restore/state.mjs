// Isolated TestCode reference model. NOT served product code.
export function cardMachine(){
 let seq=0,active=null;
 const valid=t=>active&&active.token===t;
 const snap=()=>{if(!active)return null;
  const collapsed=active.choice===null?active.mobile:active.choice==='collapsed';
  return Object.freeze({...active,collapsed,expanded:!collapsed,glyph:collapsed?'+':'−',
   ariaExpanded:String(!collapsed),label:collapsed?'Show project measurements':'Hide project measurements'});
 };
 return {
  select(ref,popup,mobile){if(!ref||!popup)throw Error('missing identity');
   active={token:++seq,ref:String(ref),popup:String(popup),mobile:!!mobile,choice:null,version:0};
   return snap();},
  state(t){return valid(t)?snap():false;},
  tap(t){if(!valid(t))return false;active.choice=snap().collapsed?'expanded':'collapsed';return snap();},
  refresh(t,v){if(!valid(t)||!Number.isSafeInteger(v)||v<active.version)return false;
   active.version=v;return snap();},
  clear(t){if(!valid(t))return false;active=null;return true;}
 };
}
export function sync(state,popup,button){
 if(!state||!popup?.classList||!button?.setAttribute)throw Error('missing node');
 popup.classList.toggle('gridatlas-min',state.collapsed);
 button.textContent=state.glyph;
 button.setAttribute('aria-expanded',state.ariaExpanded);
 button.setAttribute('aria-label',state.label);
 button.setAttribute('title',state.label);
 button.style.minWidth='44px';button.style.minHeight='44px';
}
export function wire(machine,token,popup,button,onGeometry){
 if(!button?.addEventListener)throw Error('missing button');
 const click=e=>{e.stopPropagation();e.preventDefault();
   const s=machine.tap(token);if(s){sync(s,popup,button);if(onGeometry)onGeometry();}
 };
 button.addEventListener('click',click);
 const s=machine.state(token);if(!s)throw Error('stale token');
 sync(s,popup,button);
 return ()=>button.removeEventListener('click',click);
}
