// v012: Article UTC date not future
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v012";
export const domain="temporal";
export const purpose="Article UTC date not future";
export function check(s,c){try{return Boolean(s.articles.every(a=>Date.parse(a.published_at)<=c.now+300000))}catch{return false}}
export function mutate(s){s.articles[0].published_at='2026-11-14T23:59:59Z';return s}
