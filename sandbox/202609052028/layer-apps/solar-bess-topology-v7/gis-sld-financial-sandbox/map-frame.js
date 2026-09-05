/* Copy the current map drawing during its own render event; no display permission. */
(() => {
  'use strict';
  async function capture({signal,timeout=5000}={}) {
    if(typeof map==='undefined'||!map?.isStyleLoaded()||!map.getSource('topology'))throw Error('GIS map is not ready');
    if(!Number.isFinite(timeout)||timeout<=0||timeout>30000)throw Error('Invalid capture timeout');
    const view=map;
    if(signal?.aborted)throw new DOMException('Capture cancelled','AbortError');
    return new Promise((resolve,reject)=>{
      let timer,settled=false;
      const cleanup=()=>{clearTimeout(timer);view.off('render',drawn);signal?.removeEventListener('abort',cancel);};
      const fail=error=>{if(settled)return;settled=true;cleanup();reject(error);};
      const cancel=()=>fail(new DOMException('Capture cancelled','AbortError'));
      const drawn=()=>{
        if(settled)return;
        try{
          if(view!==map||!view.isStyleLoaded()||!view.getSource('topology'))throw Error('GIS map changed or is not ready at capture time');
          const canvas=view.getCanvas();
          if(!canvas.width||!canvas.height)throw Error('GIS map has no drawing dimensions');
          if(canvas.width*canvas.height>40000000)throw Error('GIS map drawing exceeds capture size limit');
          const rect=canvas.getBoundingClientRect();
          const png=canvas.toDataURL('image/png');
          const route=window.GisSldRoute?.getSnapshot()||null;
          settled=true;cleanup();resolve(Object.freeze({schema:'ventus.gis-map-frame.v1',width:canvas.width,height:canvas.height,cssWidth:rect.width,cssHeight:rect.height,devicePixelRatio:window.devicePixelRatio||1,png,route,capturedAt:new Date().toISOString(),scope:'Map canvas pixels only; surrounding controls and legends are separate. No screen sharing.'}));
        }catch(error){fail(error);}
      };
      timer=setTimeout(()=>fail(Error('GIS map did not render before capture timeout')),timeout);
      try{signal?.addEventListener('abort',cancel,{once:true});view.once('render',drawn);view.triggerRepaint();}catch(error){fail(error);}
    });
  }
  Object.defineProperty(window,'GisSldMapFrame',{value:Object.freeze({capture}),writable:false,configurable:false});
})();
