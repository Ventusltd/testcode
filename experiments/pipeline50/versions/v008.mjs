// v008: Refs in canonical list
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v008";
export const domain="identity";
export const purpose="Refs in canonical list";
export function check(s,c){try{return Boolean(s.projects.every(p=>s.top200Refs.includes(p.repd_ref)))}catch{return false}}
export function mutate(s){s.projects[1].repd_ref='999999';return s}
