import { createComputeObserver } from '../../../../ventus-grid-engine/engine/compute-observer.js';
import { index } from '../../../../ventus-grid-engine/engine/v9-nearest-search.js';
import { representativePoint, voltagesKv } from '../../../../ventus-grid-engine/engine/v9-geodesy.js';

export function backendFor(collection) {
  const points=collection.features.map(f=>{
    const at=representativePoint(f.geometry);
    return {id:String(f.id??''),name:f.properties?.name||'',location:at?{lon:at[0],lat:at[1]}:null,voltages_kv:voltagesKv(f.properties)};
  });
  const lookup=index(points);
  return async c=>{
    const observer=createComputeObserver();const entity={kind:c.kind,id:c.entity_id};
    const location=c.has_location?{lon:c.longitude,lat:c.latitude}:null;
    const id=observer.request({entity,location,operation:'backend nearest-grid',dataset:'pinned grid_substations.geojson'});
    return observer.run(id,request=>{
      const local=lookup.nearest(location.lon,location.lat,{minimumKv:33,limit:5}).filter(x=>x.km<=40);
      const transmission=lookup.nearest(location.lon,location.lat,{minimumKv:400,limit:1});
      const measured=[...local,...(transmission?[transmission]:[])];
      return {entity,origin:request.location,search_completed:true,scanned_count:lookup.located,
        measurements:measured.map(({point,km})=>({node_id:point.name||'coordinate:'+point.location.lon+','+point.location.lat,...point.location,km}))};
    });
  };
}

export function assess(c,records,presentation,backend) {
  const latest=records.at(-1)?.record;
  const selected=latest?.entity?.kind===c.kind && latest?.entity?.id===c.entity_id;
  const actualCall=latest?.operation==='Atlas selectAt / nearest-grid';
  const started=actualCall && latest.events?.some(e=>e.status==='started');
  const completed=started && latest.status==='completed';
  const originMatches=c.has_location && latest?.location?.lon===c.longitude && latest?.location?.lat===c.latitude;
  const parity=completed && backend.status==='completed' && backend.measurements.every(expected=>latest.measurements.some(actual=>Math.abs(actual.lon-expected.lon)<1e-8&&Math.abs(actual.lat-expected.lat)<1e-8&&Math.abs(actual.km-expected.km)<1e-6));
  const mapRendered=presentation?.sourceLineCount>0 && presentation?.renderedLineCount>0;
  const engineFired=Boolean(selected&&actualCall&&completed&&originMatches&&parity);
  let outcome='PASS';
  if(!selected)outcome=latest?'WRONG_ENTITY':'NO_RECEIPT';
  else if(!started)outcome='ENGINE_NOT_FIRED';
  else if(!completed)outcome='ENGINE_'+String(latest.status).toUpperCase();
  else if(!originMatches)outcome='WRONG_OR_UNVERIFIED_LOCATION';
  else if(!parity)outcome='BACKEND_RESULT_MISMATCH';
  else if(!mapRendered)outcome='COMPUTED_BUT_NOT_DRAWN';
  return {passed:outcome==='PASS',outcome,engine_fired:engineFired,map_result_drawn:Boolean(mapRendered),
    investigation:outcome==='PASS'?null:engineFired?'Why did computation complete without a visible map result?':'Why did the grid computation not fire for this entity?',
    checks:{selected,actualCall,started:Boolean(started),completed:Boolean(completed),originMatches:Boolean(originMatches),backendParity:Boolean(parity)},latest};
}
