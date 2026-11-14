// v020: Digest must match external byte receipt
// SYNTHETIC QA contract only. Real reviewer evidence must be sourced separately.
export const version="v020";
export const domain="publisher";
export const purpose="Digest must match external byte receipt";
export function check(s,c){try{return Boolean(s.articles.every(a=>/^[a-f0-9]{64}$/.test(a.content_sha256)&&c.articleHashReceipts?.[a.link]?.sha256===a.content_sha256&&c.articleHashReceipts[a.link]?.source_url===a.link))}catch{return false}}
export function mutate(s){s.articles[0].content_sha256='a'.repeat(64);return s}
