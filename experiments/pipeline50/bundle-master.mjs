#!/usr/bin/env node
// Deterministic single-file distillation of selected independently tested gates.
// This is synthetic QA code only, never a production publisher.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {distil} from './master.mjs';
const out=process.argv[2]||'pipeline50-distilled-master.mjs';
const receiptPath=process.argv[3]||'pipeline50-bundle-receipt.json';
const report=await distil();
if(report.master_status!=='READY_FOR_INDEPENDENT_REVIEW')throw Error('refuse to bundle unproven versions');
const functions=[];
for(const id of report.selected_master_versions){
 const txt=await readFile(new URL('./versions/'+id+'.mjs',import.meta.url),'utf8');
 const start=txt.indexOf('export function check(s,c)');
 const end=txt.indexOf('\nexport function mutate(s)',start);
 if(start<0||end<0)throw Error('unexpected version module source shape '+id);
 functions.push(txt.slice(start,end).replace('export function check(s,c)','function check_'+id+'(s,c)'));
}
const inventory=report.selected_master_versions.map(id=>({id,sha256:report.versions.find(x=>x.id===id).source_sha256}));
const meta={schema:'pipeline50.distilled-source.v1',selected:inventory,synthetic_only:true,release_authorised:false,source_cover_sha256:report.selected_master_sha256};
const bundle="// Pipeline50 synthetic-only distilled master. NOT production publisher code.\n"+
 "// Deterministic 50x50 cross-challenge coverage selection.\n"+
 functions.join('\n')+'\nconst gates=['+
 report.selected_master_versions.map(v=>'["'+v+'",check_'+v+']').join(',')+
 '];\nexport const manifest='+JSON.stringify(meta)+';\n'+
 'export function evaluate(s,c){const failed=gates.filter(([id,fn])=>fn(s,c)!==true).map(([id])=>id);return {passed:failed.length===0,failed,release_authorised:false,synthetic_only:true};}\n';
await writeFile(out,bundle);
const receipt={schema:'pipeline50.compiled-receipt.v1',selected_count:inventory.length,
 selected:inventory,source_cover_sha256:report.selected_master_sha256,
 bundle_sha256:createHash('sha256').update(bundle).digest('hex'),publication_authorised:false};
await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');
console.log('Pipeline50 single-file bundle: '+inventory.length+' gates, SHA256 '+receipt.bundle_sha256+' (QA ONLY)');
