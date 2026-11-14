// v035: No inferred grid capacity
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v035";
export const domain="geometry";
export const purpose="No inferred grid capacity";
export function check(s,c){try{return Boolean(s.projects.every(p=>p.available_grid_mw===null))}catch{return false}}
export function mutate(s){s.projects[0].available_grid_mw=9000;return s}
