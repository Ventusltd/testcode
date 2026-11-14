// v036: Distinct DC category
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v036";
export const domain="datacentre";
export const purpose="Distinct DC category";
export function check(s,c){try{return Boolean(s.data_centres.every(x=>x.category==='Data Centres'))}catch{return false}}
export function mutate(s){s.data_centres[0].category='Solar PV';return s}
