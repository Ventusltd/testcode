// v021: Official/attributed hero only
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v021";
export const domain="editorial";
export const purpose="Official/attributed hero only";
export function check(s,c){try{return Boolean(s.headlines.every(h=>['official','attributed'].includes(h.evidence_tier)))}catch{return false}}
export function mutate(s){s.headlines[0].evidence_tier='unverified';return s}
