// v019: Source rights explicitly verified
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v019";
export const domain="publisher";
export const purpose="Source rights explicitly verified";
export function check(s,c){try{return Boolean(s.sources.every(x=>x.licence_status==='verified'))}catch{return false}}
export function mutate(s){s.sources[0].licence_status='unverified';return s}
