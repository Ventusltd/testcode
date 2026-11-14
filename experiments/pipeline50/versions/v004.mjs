// v004: Official fields
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v004";
export const domain="source";
export const purpose="Official fields";
export function check(s,c){try{return Boolean(s.source.fields===53)}catch{return false}}
export function mutate(s){s.source.fields=52;return s}
