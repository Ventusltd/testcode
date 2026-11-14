// v017: Source ID exists
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v017";
export const domain="publisher";
export const purpose="Source ID exists";
export function check(s,c){try{return Boolean(s.articles.every(a=>s.sources.some(x=>x.id===a.source_id)))}catch{return false}}
export function mutate(s){s.articles[0].source_id='made-up';return s}
