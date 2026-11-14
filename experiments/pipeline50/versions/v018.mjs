// v018: Article source host matches
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v018";
export const domain="publisher";
export const purpose="Article source host matches";
export function check(s,c){try{return Boolean(s.articles.every(a=>new URL(a.link).hostname===s.sources.find(x=>x.id===a.source_id)?.host))}catch{return false}}
export function mutate(s){s.articles[0].link='https://evil.invalid/story';return s}
