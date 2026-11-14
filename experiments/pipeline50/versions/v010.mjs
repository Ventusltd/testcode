// v010: No fake REPD Data Centres technology
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v010";
export const domain="identity";
export const purpose="No fake REPD Data Centres technology";
export function check(s,c){try{return Boolean(s.projects.every(p=>p.technology==='Solar PV'))}catch{return false}}
export function mutate(s){s.projects[0].technology='Data Centres';return s}
