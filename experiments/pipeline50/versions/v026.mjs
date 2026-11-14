// v026: Material headline threshold
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v026";
export const domain="editorial";
export const purpose="Material headline threshold";
export function check(s,c){try{return Boolean(s.headlines.every(h=>h.capacity_mw>=50||h.project_capex_usd>=25000000))}catch{return false}}
export function mutate(s){s.headlines[0].capacity_mw=0;s.headlines[0].project_capex_usd=0;return s}
