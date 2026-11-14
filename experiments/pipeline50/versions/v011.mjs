// v011: Generated date not future
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v011";
export const domain="temporal";
export const purpose="Generated date not future";
export function check(s,c){try{return Boolean(Number.isFinite(Date.parse(s.generated_at))&&Date.parse(s.generated_at)<=c.now+300000)}catch{return false}}
export function mutate(s){s.generated_at='2027-11-14T16:00:00Z';return s}
