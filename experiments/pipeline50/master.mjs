// Distil a minimal experimental rule subset using a 50 x 50 adversarial matrix.
// SYNTHETIC QA ONLY: NOT a production Pipeline News master or release acceptance.
import {versionNames} from './versions.mjs';
import {fixture,CLOCK} from './fixture.mjs';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const clone=x=>structuredClone(x);

export async function distil(){
 const context={now:CLOCK}, results=[], modules=new Map();
 for(const v of versionNames){
  const mod=await import('./versions/'+v+'.mjs');
  modules.set(v,mod);
  const source=await readFile(new URL('./versions/'+v+'.mjs',import.meta.url));
  const golden=mod.check(fixture(),context)===true;
  const mutant=mod.check(mod.mutate(clone(fixture())),context)===false;
  results.push({id:v,domain:mod.domain,purpose:mod.purpose,
    source_sha256:createHash('sha256').update(source).digest('hex'),
    golden_accepts:golden,negative_rejected:mutant,accepted:golden&&mutant});
 }
 const accepted=results.filter(x=>x.accepted).map(x=>x.id), matrix={};
 // Each independent code gate must face every other rule's negative mutation,
 // not merely the bad example it authored itself.
 for(const attack of versionNames){
  const mutated=modules.get(attack).mutate(clone(fixture()));
  matrix[attack]=accepted.filter(rule=>modules.get(rule).check(clone(mutated),context)!==true);
 }
 const uncovered=new Set(versionNames), selected=[];
 while(uncovered.size){
  let best=null,gain=0;
  for(const rule of accepted){
   if(selected.includes(rule))continue;
   const benefit=versionNames.reduce((n,attack)=>n+(uncovered.has(attack)&&matrix[attack].includes(rule)?1:0),0);
   if(benefit>gain){best=rule;gain=benefit}
  }
  if(!best||gain===0)break;
  selected.push(best);
  for(const attack of [...uncovered])if(matrix[attack].includes(best))uncovered.delete(attack);
 }
 const winning=results.filter(x=>x.accepted).map(x=>x.id);
 const status=winning.length===50&&uncovered.size===0?'READY_FOR_INDEPENDENT_REVIEW':'FAIL';
 const digest=createHash('sha256').update(selected.map(id=>results.find(r=>r.id===id).source_sha256).join('\n')).digest('hex');
 return {
  schema:'pipeline50.master-candidate.v2',
  scope:'SYNTHETIC QA ONLY: NOT a licensed production release, real browser proof, or article evidence',
  total_versions:versionNames.length,
  accepted_versions:winning.length,
  rejected_versions:results.filter(x=>!x.accepted).map(x=>x.id),
  cross_tests_executed:accepted.length*versionNames.length,
  cross_mutations:versionNames.length,
  uncovered_mutations:[...uncovered],
  selected_master_versions:selected,
  selected_master_count:selected.length,
  selected_master_sha256:digest,
  master_status:status,
  versions:results,
  detection_matrix:matrix
 };
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const report=await distil();
 const out=process.argv[2]||'pipeline50-master-report.json';
 await writeFile(out,JSON.stringify(report,null,2)+'\n');
 console.log('Pipeline50: '+report.accepted_versions+'/'+report.total_versions+
  ' code implementations passed; '+report.cross_tests_executed+' cross-comparisons; '+
  report.selected_master_count+' gates in distilled master; '+report.master_status);
 if(report.master_status!=='READY_FOR_INDEPENDENT_REVIEW')process.exitCode=1;
}
