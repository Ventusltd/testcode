// v013: Recent headline at most 14 days
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v013";
export const domain="temporal";
export const purpose="Recent headline at most 14 days";
export function check(s,c){try{return Boolean(s.headlines.every(h=>{const a=s.articles.find(x=>x.event_id===h.event_id);return a&&c.now-Date.parse(a.published_at)<=14*86400000}))}catch{return false}}
export function mutate(s){s.articles[0].published_at='2026-10-01T12:00:00Z';return s}
