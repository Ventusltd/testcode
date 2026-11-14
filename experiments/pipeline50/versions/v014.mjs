// v014: First seen before observation
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v014";
export const domain="temporal";
export const purpose="First seen before observation";
export function check(s,c){try{return Boolean(s.articles.every(a=>Date.parse(a.first_seen)<=Date.parse(a.observed_at)))}catch{return false}}
export function mutate(s){s.articles[0].first_seen='2026-11-15T00:00:00Z';return s}
