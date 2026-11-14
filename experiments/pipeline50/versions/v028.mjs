// v028: Hero has independent publishers
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v028";
export const domain="editorial";
export const purpose="Hero has independent publishers";
export function check(s,c){try{return Boolean(s.headlines.every(h=>!h.featured||h.independent_publishers.length>=2))}catch{return false}}
export function mutate(s){s.headlines[0].independent_publishers=['govuk'];return s}
