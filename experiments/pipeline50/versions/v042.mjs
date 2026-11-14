// v042: No JavaScript browser errors
// Independent, synthetic-only testcode gate. This is not a publisher or a release.
export const version="v042";
export const domain="presentation";
export const purpose="No JavaScript browser errors";
export function check(s,c){try{return Boolean(s.presentation.screens.every(x=>x.js_errors===0))}catch{return false}}
export function mutate(s){s.presentation.screens[0].js_errors=1;return s}
