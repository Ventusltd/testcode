// v044: MAP identity needs external receiver observation
// SYNTHETIC QA contract only. Real reviewer evidence must be sourced separately.
export const version="v044";
export const domain="presentation";
export const purpose="MAP identity needs external receiver observation";
export function check(s,c){try{return Boolean(s.presentation.map_received_ref===s.headlines[0].project_ref&&c.browserEvidence?.map_receiver_ref===s.presentation.map_received_ref)}catch{return false}}
export function mutate(s){s.presentation.map_received_ref='999999';return s}
