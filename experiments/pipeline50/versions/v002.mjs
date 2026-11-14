// v002: Official SHA format
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v002";
export const domain="source";
export const purpose="Official SHA format";
export function check(s,c){try{return Boolean(/^[a-f0-9]{64}$/.test(s.source.officialSha))}catch{return false}}
export function mutate(s){s.source.officialSha='bad';return s}
