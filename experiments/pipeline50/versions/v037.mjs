// v037: IT and connection MW distinct
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v037";
export const domain="datacentre";
export const purpose="IT and connection MW distinct";
export function check(s,c){try{return Boolean(s.data_centres.every(x=>Number.isFinite(x.it_load_mw)&&Number.isFinite(x.connection_mw)&&x.it_load_mw!==x.connection_mw))}catch{return false}}
export function mutate(s){s.data_centres[0].connection_mw=s.data_centres[0].it_load_mw;return s}
