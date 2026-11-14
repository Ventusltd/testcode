// v024: Distinct headline events
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v024";
export const domain="editorial";
export const purpose="Distinct headline events";
export function check(s,c){try{return Boolean(new Set(s.headlines.map(h=>h.event_id)).size===s.headlines.length)}catch{return false}}
export function mutate(s){s.headlines.push({...s.headlines[0]});return s}
