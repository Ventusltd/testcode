// v026: Verified project CAPEX or actual generation MW
// SYNTHETIC QA contract only. Real reviewer evidence must be sourced separately.
export const version="v026";
export const domain="editorial";
export const purpose="Verified project CAPEX or actual generation MW";
export function check(s,c){try{return Boolean(s.headlines.every(h=>{const ev=['planning_decision','construction','fid','grid_connection','energisation','acquisition'].includes(h.event_kind);const cap=c.projectCapacityEvidence?.[h.event_id];const money=c.projectCapexEvidence?.[h.event_id];const capOK=h.capacity_mw>=50&&h.capacity_basis==='project_generation'&&cap?.project_ref===h.project_ref&&cap?.capacity_mw===h.capacity_mw&&cap?.asset_scope==='generation_project'&&cap?.unit===h.capacity_unit;const moneyOK=h.project_capex_usd>=25000000&&h.capex_basis==='project_build_capex'&&money?.project_ref===h.project_ref&&money?.transaction_kind==='project_build_capex'&&money?.project_capex_usd===h.project_capex_usd&&money?.source_sha256===h.capex_source_sha256;return ev&&(capOK||moneyOK)}))}catch{return false}}
export function mutate(s){s.headlines[0].capacity_mw=0;s.headlines[0].project_capex_usd=0;return s}
