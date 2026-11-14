// v020: Article byte hash present
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v020";
export const domain="publisher";
export const purpose="Article byte hash present";
export function check(s,c){try{return Boolean(s.articles.every(a=>/^[a-f0-9]{64}$/.test(a.content_sha256)))}catch{return false}}
export function mutate(s){s.articles[0].content_sha256='';return s}
