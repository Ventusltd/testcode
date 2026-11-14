// v047: Built equals served SHA
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v047";
export const domain="release";
export const purpose="Built equals served SHA";
export function check(s,c){try{return Boolean(s.release.served_index_sha===s.release.built_index_sha)}catch{return false}}
export function mutate(s){s.release.served_index_sha='e'.repeat(64);return s}
