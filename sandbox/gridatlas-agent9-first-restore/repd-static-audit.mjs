/**
 * OFFLINE, real pinned Pipeline News Q3 project corpus identity audit.
 * This does NOT open a browser or claim any MAP click succeeded.
 * No network; caller must provide checkout from exact pinned SHA.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=process.argv[2];
if(!root)throw Error('FAIL: explicit pinned Pipeline News candidate directory required');
const base=resolve(root);
const manifest=JSON.parse(readFileSync(join(base,'data/v9.1/build_manifest.json'),'utf8'));
if(manifest.project_count!==7775||manifest.geometry_count!==7749||
 manifest.missing_geometry_count!==26)throw Error('FAIL: release counts differ');
const rows=[],partitions=[];
for(const entry of manifest.project_partitions||[]){
 const bytes=readFileSync(join(base,entry.path));
 const sha=createHash('sha256').update(bytes).digest('hex');
 if(sha!==entry.sha256)throw Error('FAIL: partition byte hash '+entry.path);
 const obj=JSON.parse(bytes);
 if(!Array.isArray(obj.projects)||obj.projects.length!==entry.record_count)throw Error('FAIL: partition rows');
 rows.push(...obj.projects);partitions.push({path:entry.path,sha256:sha,count:obj.projects.length});
}
if(rows.length!==7775)throw Error('FAIL: actual 7775 rows not present');
const seen=new Set();
let located=0,missing=0;
const counts={};
for(const row of rows){
 const ref=String(row.repd_ref||'');
 if(!/^[0-9]+$/.test(ref)||seen.has(ref)||row.gg_project_id!=='GG2050-REPD-'+ref)throw Error('FAIL: duplicate/invalid identity '+ref);
 seen.add(ref);counts[row.technology]=(counts[row.technology]||0)+1;
 const has=Number.isFinite(row.latitude)&&Number.isFinite(row.longitude)&&
   Math.abs(row.latitude)<=90&&Math.abs(row.longitude)<=180&&(row.latitude!==0||row.longitude!==0);
 if(has)located++;else missing++;
 if(has&&row.geometry_status!=='valid')throw Error('FAIL: geometry status conflict '+ref);
 if(!has&&row.geometry_status==='valid')throw Error('FAIL: invalid valid-geometry '+ref);
}
if(located!==7749||missing!==26)throw Error('FAIL: location count '+located+'/'+missing);
for(const [type,n] of [['solar',3604],['bess',1644],['wind_onshore',2417],['wind_offshore',110]]){
 if(counts[type]!==n)throw Error('FAIL: technology count '+type+' '+counts[type]);
}
// Reproducible six-per-technology representative sample: prioritise distinct
// regions/statuses and high/low project capacity; always select actual rows.
const samples=[];
for(const type of ['solar','bess','wind_onshore','wind_offshore']){
 const candidates=rows.filter(r=>r.technology===type&&r.geometry_status==='valid')
   .sort((a,b)=>String(a.repd_ref).localeCompare(String(b.repd_ref),'en',{numeric:true}));
 if(candidates.length<6)throw Error('FAIL: fewer than six located '+type);
 const picked=[],used=new Set(),regions=new Set(),statuses=new Set();
 const choose=r=>{if(!r||used.has(r.repd_ref))return;
  picked.push(r);used.add(r.repd_ref);regions.add(r.region||'');statuses.add(r.status||'');};
 choose([...candidates].sort((a,b)=>(b.capacity_mw||0)-(a.capacity_mw||0))[0]);
 choose([...candidates].sort((a,b)=>(a.capacity_mw||0)-(b.capacity_mw||0))[0]);
 for(const r of candidates)if(picked.length<6&&!regions.has(r.region||''))choose(r);
 for(const r of candidates)if(picked.length<6&&!statuses.has(r.status||''))choose(r);
 for(const r of candidates)if(picked.length<6)choose(r);
 if(picked.length!==6)throw Error('FAIL: sample not 6 for '+type);
 for(const r of picked)samples.push({
   repd_ref:r.repd_ref,name:r.name,technology:r.technology,
   latitude:r.latitude,longitude:r.longitude,status:r.status,
   region:r.region,capacity_mw:r.capacity_mw,
   source:'DESNZ_REPD_Q3_2026_PINNED_CORPUS',
   browser_status:'UNVERIFIED'
 });
}
if(samples.length!==24||new Set(samples.map(x=>x.repd_ref)).size!==24)throw Error('FAIL: 24 unique sample');
mkdirSync('agent9-repd-receipts',{recursive:true});
const report={
 schema:'agent9.pinned-repd-static-audit.v1',
 evidence_class:'REAL OFFLINE BYTES; NOT BROWSER',
 candidate_commit:'998c4cddbd78f04bcdd9df2a40026ac91714cd2f',
 project_rows:rows.length,unique_repd_refs:seen.size,
 geo_located:located,geo_missing:missing,technology_counts:counts,
 partition_checks:partitions,
 sample_count:samples.length,sample_selection:'deterministic 6 each technology, capacity extremes, region and status diversity',
 samples,actual_24_browser_status:'UNVERIFIED',actual_7775_MAP_click_status:'UNVERIFIED',
 interconnectors:'SEPARATE CATEGORY; not claimed audited by this corpus'
};
writeFileSync('agent9-repd-receipts/static-audit.json',JSON.stringify(report,null,2)+'\n');
console.log('OFFLINE source integrity PASS: '+seen.size+' unique, '+located+' located, '+missing+' missing; 24 genuine stratified records selected, NOT browser tested');
