// v031: CRS is WGS84
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v031";
export const domain="geometry";
export const purpose="CRS is WGS84";
export function check(s,c){try{return Boolean(s.map.crs==='EPSG:4326')}catch{return false}}
export function mutate(s){s.map.crs='EPSG:27700';return s}
