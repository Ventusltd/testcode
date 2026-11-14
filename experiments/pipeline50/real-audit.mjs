#!/usr/bin/env node
/**
 * Pinned real-data audit, QA only; never writes a source, data branch or release.
 * A structural PASS is intentionally separate from publication approval.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const EXPECTED = Object.freeze({
  top: '3a23c8495f00e613a8f0f81b2db5374a19ba89d832e913c6f821823def6b49a5',
  data: '15586a71613df59fc7bbdbdce852ebb71b19f663f0e269ca4d9fedb7225afe03',
  sourceCommit: '91727c22a9ee13f433d4e82d8949c9aeac5bd3be',
  dataCommit: '598e787908d4a2ee3d84dc7a6a8d0213752ebf46'
});
const sha=b=>createHash('sha256').update(b).digest('hex');
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const validUrl=s=>{try {const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname;}catch{return false;}};

export function analyse(top,data,asOf='2026-11-14T16:00:00Z'){
 const errors=[],holds=[],warnings=[];
 if(!Array.isArray(top)||top.length!==200)errors.push('top200 source not exactly 200 rows');
 const refs=new Set((Array.isArray(top)?top:[]).map(x=>String(x.repd_ref)));
 if(refs.size!==200)errors.push('top200 source has duplicate refs');
 if(data?.schema!=='project-signals.v1'||!data?.projects||typeof data.projects!=='object')
   errors.push('published candidate schema is not project-signals.v1');
 const projects=Object.entries(data?.projects||{});
 if(projects.length!==200||projects.some(([id,p])=>!refs.has(id)||String(p.repd_ref)!==id))
   errors.push('published candidate 200 REPD identities differ from pinned source');
 const pubDay=Math.floor(Date.parse(asOf)/86400000);
 const facts={projects:projects.length,projects_with_news:0,signals:0,recent_dated_signals:0,
   reviewed_historical_or_undated:0,planning_search_fallbacks:0,cross_project_urls:0,
   missing_per_article_fetch_receipts:0,source_records_missing_licence:0,source_failures:0,
   false_time_fields:0};
 const shared=new Map();
 for(const [ref,p] of projects){
  const signals=Array.isArray(p.signals)?p.signals:[];
  if(signals.some(a=>['regional','trade','national','bbc'].includes(a.family)))facts.projects_with_news++;
  if(p.planning_file?.kind==='search_page'||p.planning_file?.kind==='last_resort')facts.planning_search_fallbacks++;
  for(const a of signals){
   facts.signals++;
   if(String(a.repd_ref)!==ref)errors.push('signal wrong REPD reference: '+ref);
   if(!validUrl(a.link))errors.push('non-HTTPS or invalid source URL: '+ref);
   if(!shared.has(a.link))shared.set(a.link,new Set());
   shared.get(a.link).add(ref);
   if(!a.source_id||a.fetched_this_run!==true||!a.observed_at||!a.content_sha256)
      facts.missing_per_article_fetch_receipts++;
   if(a.basis?.startsWith('reviewed')||a.date==null)facts.reviewed_historical_or_undated++;
   if(a.date!=null){
     if(!validDate(a.date))facts.false_time_fields++;
     else{const delta=pubDay-Math.floor(Date.parse(a.date+'T00:00:00Z')/86400000);
       if(delta<0)facts.false_time_fields++;
       else if(delta<=14)facts.recent_dated_signals++;
     }
   }
  }
 }
 facts.cross_project_urls=[...shared.values()].filter(ids=>ids.size>1).length;
 const src=Array.isArray(data?.sources)?data.sources:[];
 facts.source_records_missing_licence=src.filter(x=>x.licence_status!=='verified'||!x.licence_url).length;
 facts.source_failures=src.filter(x=>x.status==='failed').length;
 if(facts.false_time_fields)errors.push('one or more impossible or future article dates');
 if(facts.source_records_missing_licence)holds.push('Publisher rights not independently verified on each source');
 if(facts.missing_per_article_fetch_receipts)holds.push('Per-article exact URL and content-SHA receipts missing');
 holds.push('Integrated v2 acid matcher, publisher diversity and independent reviewer gates not established by this v1 snapshot');
 holds.push('Real 1440/390px browser/MAP/CSV, served-byte and rollback acceptance not established by this offline data check');
 if(facts.planning_search_fallbacks)warnings.push('Planning-register search fallbacks are not direct verified application files');
 if(facts.cross_project_urls)warnings.push('Cross-project shared URLs need event-level review');
 const ok=errors.length===0;
 return {schema:'pipeline50.real-data-audit.v1',source_type:'PINNED REAL DATA; QA ONLY',
  result:ok?'STRUCTURE_VALID_RELEASE_HOLD':'FAIL',
  production_release_authorised:false,errors,holds,warnings,facts};
}

async function main(){
 const [topPath,dataPath,outPath]=process.argv.slice(2);
 if(!topPath||!dataPath||!outPath)throw Error('usage: node real-audit.mjs top200.json project_signals.json report.json');
 const tb=await readFile(topPath),db=await readFile(dataPath);
 const digest={top:sha(tb),data:sha(db)};
 if(digest.top!==EXPECTED.top||digest.data!==EXPECTED.data)
   throw Error('pinned input SHA256 differs from independent expected source bytes');
 const report={...analyse(JSON.parse(tb.toString('utf8')),JSON.parse(db.toString('utf8'))),
  input_sha256:digest,pinned_commits:{top:EXPECTED.sourceCommit,data:EXPECTED.dataCommit}};
 await writeFile(outPath,JSON.stringify(report,null,2)+'\n');
 console.log('Pipeline50 pinned real-data audit: '+report.result+'; projects '+report.facts.projects+
   '; missing receipts '+report.facts.missing_per_article_fetch_receipts+
   '; rights missing '+report.facts.source_records_missing_licence);
 if(report.errors.length)process.exitCode=1; // HOLD is an expected safe result, NOT approval
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(e=>{console.error(e.stack||String(e));process.exitCode=2;});
}
