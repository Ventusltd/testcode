// v007: No duplicate refs
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v007";
export const domain="identity";
export const purpose="No duplicate refs";
export function check(s,c){try{return Boolean(new Set(s.projects.map(x=>x.repd_ref)).size===s.projects.length)}catch{return false}}
export function mutate(s){s.projects[1].repd_ref='10000';return s}
