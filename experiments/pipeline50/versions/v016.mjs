// v016: Source health checked
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v016";
export const domain="publisher";
export const purpose="Source health checked";
export function check(s,c){try{return Boolean(s.sources.every(x=>x.status==='ok'||x.status==='partial'))}catch{return false}}
export function mutate(s){s.sources[0].status='failed';return s}
