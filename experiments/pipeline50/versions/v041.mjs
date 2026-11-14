// v041: Browser width claims need external observations
// SYNTHETIC QA contract only. Real reviewer evidence must be sourced separately.
export const version="v041";
export const domain="presentation";
export const purpose="Browser width claims need external observations";
export function check(s,c){try{return Boolean([1440,390].every(w=>s.presentation.screens.some(x=>x.width===w)&&c.browserEvidence?.screens?.some(x=>x.width===w&&x.observed===true&&x.js_errors===0)))}catch{return false}}
export function mutate(s){s.presentation.screens=s.presentation.screens.filter(x=>x.width!==390);return s}
