// v005: REPD original identity counts
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v005";
export const domain="source";
export const purpose="REPD original identity counts";
export function check(s,c){try{return Boolean(s.source.rawRows===14968&&s.source.uniqueRefs===14967)}catch{return false}}
export function mutate(s){s.source.uniqueRefs=14968;return s}
