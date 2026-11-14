// The master is deliberately synthetic-only: production requires separate real evidence.
import {versionNames} from './versions.mjs';
import {fixture,CLOCK} from './fixture.mjs';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const clone=x=>structuredClone(x);
export async function distil(){
 const context={now:CLOCK};const results=[];
 for(const v of versionNames){
  const mod=await import('./versions/'+v+'.mjs');
  const source=await readFile(new URL('./versions/'+v+'.mjs',import.meta.url));
  const golden=mod.check(fixture(),context)===true;
  const mutant=mod.check(mod.mutate(clone(fixture())),context)===false;
  results.push({id:v,domain:mod.domain,purpose:mod.purpose,source_sha256:createHash('sha256').update(source).digest('hex'),golden_accepts:golden,negative_rejected:mutant,accepted:golden&&mutant});
 }
 const winning=results.filter(x=>x.accepted).map(x=>x.id);
 return {schema:'pipeline50.master-candidate.v1',scope:'SYNTHETIC QA ONLY: not a production release, a licence grant or browser acceptance',total_versions:versionNames.length,accepted_versions:winning.length,rejected_versions:results.filter(x=>!x.accepted).map(x=>x.id),master_status:winning.length===50?'READY_FOR_INDEPENDENT_REVIEW':'FAIL',versions:results};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const report=await distil();
 const out=process.argv[2]||'pipeline50-master-report.json';
 await writeFile(out,JSON.stringify(report,null,2)+'\n');
 console.log('Pipeline50 experimental master: '+report.accepted_versions+'/'+report.total_versions+' versioned gates accepted; '+report.master_status+'; REPORT '+out);
 if(report.master_status!=='READY_FOR_INDEPENDENT_REVIEW')process.exitCode=1;
}
