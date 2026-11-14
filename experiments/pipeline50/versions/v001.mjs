// v001: Snapshot schema
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v001";
export const domain="source";
export const purpose="Snapshot schema";
export function check(s,c){try{return Boolean(s.schema==='pipeline50.synthetic.v1')}catch{return false}}
export function mutate(s){s.schema='legacy';return s}
