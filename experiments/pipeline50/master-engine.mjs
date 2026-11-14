// Pipeline50 compiled QA master — selected from 50x50 synthetic adversarial evidence.
// This is not eligible to publish any real data without source and release gates.
import {distil} from './master.mjs';

export async function compileMaster(){
 const report=await distil();
 if(report.master_status!=='READY_FOR_INDEPENDENT_REVIEW')
   throw new Error('Cannot compile master with untested or uncovered mutation');
 const selected=await Promise.all(report.selected_master_versions.map(async id=>({
   id, ...(await import('./versions/'+id+'.mjs'))
 })));
 return {
  schema:'pipeline50.compiled-master.v1',
  source_sha256:report.selected_master_sha256,
  selected_versions:report.selected_master_versions,
  evaluate(snapshot,context){
   const failed=selected.filter(rule=>rule.check(snapshot,context)!==true).map(x=>x.id);
   return {accepted:failed.length===0,failed,code_only:true,
     release_authorised:false,
     warning:'Synthetic gate evaluation only: real publisher rights and release acceptance separately required'};
  }
 };
}
