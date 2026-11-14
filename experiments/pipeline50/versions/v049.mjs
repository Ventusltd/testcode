// v049: CI booleans need independent workflow outcomes
// SYNTHETIC QA contract only. Real reviewer evidence must be sourced separately.
export const version="v049";
export const domain="release";
export const purpose="CI booleans need independent workflow outcomes";
export function check(s,c){try{return Boolean(['offline','integration','browser','hashes','licences','rollback'].every(k=>s.release.ci[k]===true&&c.workflowEvidence?.checks?.[k]==='success')&&c.workflowEvidence?.head_sha===c.workflowEvidence?.expected_head_sha)}catch{return false}}
export function mutate(s){s.release.ci.browser=false;return s}
