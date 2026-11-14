// v022: Reviewed alias with exact planning identity
// SYNTHETIC QA contract only. Real reviewer evidence must be sourced separately.
export const version="v022";
export const domain="editorial";
export const purpose="Reviewed alias with exact planning identity";
export function check(s,c){try{return Boolean(s.headlines.every(h=>{const p=s.projects.find(p=>p.repd_ref===h.project_ref);const e=c.projectAliases?.[h.project_ref];const title=h.title?.toLowerCase()||'';return !!p&&!!e&&e.reviewed===true&&h.planning_ref===e.planning_ref&&e.aliases.some(a=>typeof a==='string'&&a.trim().split(/\s+/).length>=2&&title.includes(a.toLowerCase()))}))}catch{return false}}
export function mutate(s){s.headlines[0].title='Unrelated bypass diode study';return s}
