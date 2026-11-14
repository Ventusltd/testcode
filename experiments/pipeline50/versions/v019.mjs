// v019: Rights need independent terms receipt
// SYNTHETIC QA contract only. Real reviewer evidence must be sourced separately.
export const version="v019";
export const domain="publisher";
export const purpose="Rights need independent terms receipt";
export function check(s,c){try{return Boolean(s.sources.every(x=>x.licence_status==='verified'&&c.rightsLedger?.[x.id]?.licence_status==='verified'&&c.rightsLedger[x.id].reviewed_by&&c.rightsLedger[x.id].redistribution_allowed===true&&c.rightsLedger[x.id].source_url===x.url&&/^[a-f0-9]{64}$/.test(c.rightsLedger[x.id].terms_sha256)))}catch{return false}}
export function mutate(s){s.sources[0].licence_status='unverified';return s}
