// Embedded after the unmodified engine observer and geodesy functions.
const query=new URLSearchParams(window.location.search);
const expected={kind:query.get('testcode_entity_kind')||'repd',id:query.get('repd_ref')||query.get('testcode_entity_id')||'unselected'};
const caseId=query.get('testcode_case')||expected.kind+'-'+expected.id;
const visitId=query.get('testcode_visit')||('visit-'+Date.now()+'-'+Math.random().toString(16).slice(2,8));
const records=[];
function show(record){
 let badge=document.getElementById('testcode-compute-receipt');
 if(!badge&&document.body){badge=document.createElement('div');badge.id='testcode-compute-receipt';badge.style.cssText='position:fixed;bottom:3px;left:190px;right:160px;z-index:15000;background:#102330;color:#fff;padding:6px;font:11px monospace;pointer-events:none';document.body.append(badge);}
 if(badge)badge.textContent='TEST CODE '+caseId+' | '+record.status.toUpperCase()+' | '+(record.summary?record.summary.measured_count+' measured | ':'')+visitId;
}
const observer=createComputeObserver({onEvent:record=>{
 const envelope={schema:'testcode.browser-compute-event.v1',case_id:caseId,visit_id:visitId,url:window.location.href,at_utc:new Date().toISOString(),record};records.push(envelope);show(record);
 fetch(new URL('/__testcode/receipt',window.location.href),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(envelope),keepalive:true}).catch(error=>{console.error('Test Code receipt could not be saved',error);});
}});
window.__TESTCODE_GRID_DETECTOR__={expected,caseId,visitId,records,...observer};
const lon=query.has('longitude')?Number(query.get('longitude')):null;
const lat=query.has('latitude')?Number(query.get('latitude')):null;
observer.request({entity:expected,location:Number.isFinite(lon)&&Number.isFinite(lat)?{lon,lat}:null,operation:'route-requested',dataset:'grid_substations.geojson'});
