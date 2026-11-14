// v030: Headline timestamp is event time
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v030";
export const domain="editorial";
export const purpose="Headline timestamp is event time";
export function check(s,c){try{return Boolean(s.headlines.every(h=>{const a=s.articles.find(x=>x.event_id===h.event_id);return a&&h.published_at===a.published_at}))}catch{return false}}
export function mutate(s){s.headlines[0].published_at=s.generated_at;return s}
