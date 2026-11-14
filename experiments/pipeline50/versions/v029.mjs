// v029: Carried item cannot become fresh
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v029";
export const domain="editorial";
export const purpose="Carried item cannot become fresh";
export function check(s,c){try{return Boolean(s.articles.every(a=>!a.carried||a.fresh===false))}catch{return false}}
export function mutate(s){s.articles[0].carried=true;s.articles[0].fresh=true;return s}
