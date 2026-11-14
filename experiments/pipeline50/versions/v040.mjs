// v040: No fictitious DC REPD ref
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v040";
export const domain="datacentre";
export const purpose="No fictitious DC REPD ref";
export function check(s,c){try{return Boolean(s.data_centres.every(x=>x.repd_ref===null))}catch{return false}}
export function mutate(s){s.data_centres[0].repd_ref='10000';return s}
