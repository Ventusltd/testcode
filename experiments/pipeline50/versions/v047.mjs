// v047: Byte claims need independent served-byte receipt
// SYNTHETIC QA contract only. Real reviewer evidence must be sourced separately.
export const version="v047";
export const domain="release";
export const purpose="Byte claims need independent served-byte receipt";
export function check(s,c){try{return Boolean(s.release.served_index_sha===s.release.built_index_sha&&s.release.served_index_sha===c.servedEvidence?.sha256&&c.servedEvidence?.source==='independent_byte_read')}catch{return false}}
export function mutate(s){s.release.served_index_sha='e'.repeat(64);return s}
