// v037: Independent IT and connection evidence even when equal
// SYNTHETIC QA contract only. Real reviewer evidence must be sourced separately.
export const version="v037";
export const domain="datacentre";
export const purpose="Independent IT and connection evidence even when equal";
export function check(s,c){try{return Boolean(s.data_centres.every(x=>{const e=c.dcMeasurementEvidence?.[x.id];return Number.isFinite(x.it_load_mw)&&Number.isFinite(x.connection_mw)&&x.it_load_source_id&&x.connection_source_id&&x.it_load_source_id!==x.connection_source_id&&e?.it_source===x.it_load_source_id&&e?.connection_source===x.connection_source_id&&e.it_load_mw===x.it_load_mw&&e.connection_mw===x.connection_mw}))}catch{return false}}
export function mutate(s){s.data_centres[0].connection_source_id='it-audit';return s}
