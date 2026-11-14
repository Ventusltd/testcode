// v022: Headline project name match
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v022";
export const domain="editorial";
export const purpose="Headline project name match";
export function check(s,c){try{return Boolean(s.headlines.every(h=>s.projects.some(p=>p.repd_ref===h.project_ref&&h.title.toLowerCase().includes(p.site_name.toLowerCase()))))}catch{return false}}
export function mutate(s){s.headlines[0].title='Unrelated bypass diode study';return s}
