// v027: Planning search is unverified
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v027";
export const domain="editorial";
export const purpose="Planning search is unverified";
export function check(s,c){try{return Boolean(s.projects.every(p=>p.planning.kind!=='search_page'||p.planning.verified===false))}catch{return false}}
export function mutate(s){s.projects[0].planning.kind='search_page';s.projects[0].planning.verified=true;return s}
