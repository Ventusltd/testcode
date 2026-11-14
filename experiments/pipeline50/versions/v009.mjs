// v009: Article refs exist
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v009";
export const domain="identity";
export const purpose="Article refs exist";
export function check(s,c){try{return Boolean(s.articles.every(a=>a.project_refs.every(ref=>s.projects.some(p=>p.repd_ref===ref))))}catch{return false}}
export function mutate(s){s.articles[0].project_refs=['nonexistent'];return s}
