// v003: Pinned official commit
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v003";
export const domain="source";
export const purpose="Pinned official commit";
export function check(s,c){try{return Boolean(/^[a-f0-9]{40}$/.test(s.source.commit))}catch{return false}}
export function mutate(s){s.source.commit='main';return s}
