// v023: Distinct event IDs
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v023";
export const domain="editorial";
export const purpose="Distinct event IDs";
export function check(s,c){try{return Boolean(new Set(s.articles.map(a=>a.event_id)).size===s.articles.length)}catch{return false}}
export function mutate(s){s.articles.push({...s.articles[0]});return s}
