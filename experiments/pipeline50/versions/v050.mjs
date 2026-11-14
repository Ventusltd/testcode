// v050: Six IANA market clocks
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v050";
export const domain="release";
export const purpose="Six IANA market clocks";
export function check(s,c){try{return Boolean(['America/Los_Angeles','America/New_York','Europe/London','Asia/Hong_Kong','Asia/Tokyo','Australia/Sydney'].every(t=>s.presentation.market_clocks.includes(t)))}catch{return false}}
export function mutate(s){s.presentation.market_clocks=s.presentation.market_clocks.filter(x=>x!=='Australia/Sydney');return s}
