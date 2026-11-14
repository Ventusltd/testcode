// v049: Release CI pass gate
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v049";
export const domain="release";
export const purpose="Release CI pass gate";
export function check(s,c){try{return Boolean(['offline','integration','browser','hashes','licences','rollback'].every(k=>s.release.ci[k]===true))}catch{return false}}
export function mutate(s){s.release.ci.browser=false;return s}
