// v028: Two independent publisher owners and event receipts
// SYNTHETIC QA contract only. Real reviewer evidence must be sourced separately.
export const version="v028";
export const domain="editorial";
export const purpose="Two independent publisher owners and event receipts";
export function check(s,c){try{return Boolean(s.headlines.every(h=>{if(!h.featured)return true;const ids=h.independent_publishers||[];const receipts=ids.map(id=>c.publisherReceipts?.[id]);return ids.length>=2&&receipts.every(r=>r?.event_id===h.event_id&&r?.owner&&Number.isFinite(Date.parse(r.observed_at))&&/^[a-f0-9]{64}$/.test(r.content_sha256))&&new Set(receipts.map(r=>r.owner.toLowerCase())).size>=2&&new Set(ids).size>=2}))}catch{return false}}
export function mutate(s){s.headlines[0].independent_publishers=['govuk','govuk'];return s}
