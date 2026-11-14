// v038: DC generation unknown
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v038";
export const domain="datacentre";
export const purpose="DC generation unknown";
export function check(s,c){try{return Boolean(s.data_centres.every(x=>x.repd_generation_mw===null))}catch{return false}}
export function mutate(s){s.data_centres[0].repd_generation_mw=50;return s}
