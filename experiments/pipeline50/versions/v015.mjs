// v015: Per-run observation receipt
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v015";
export const domain="temporal";
export const purpose="Per-run observation receipt";
export function check(s,c){try{return Boolean(s.articles.every(a=>a.fetched_this_run===true&&s.sources.some(src=>src.id===a.source_id&&src.observed_urls.includes(a.link))))}catch{return false}}
export function mutate(s){s.articles[0].fetched_this_run=false;return s}
