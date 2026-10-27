#!/usr/bin/env node
/**
 * Independent TESTCODE-only fail-first archive-integrity challenge.
 * PIN exact candidate (currently GridAtlas Claude variant G 202610270113
 * at 31e009d1acbe2d00e82fc6c5e0fdbadb7c6c1b3c).
 *
 * Uses synthetic day files and synthetic scan windows; NO real archive,
 * browser, EUMETSAT network or owner iPhone evidence is claimed.
 * Reproduce from Testcode checkout with sibling GridAtlas checkout:
 *   GRIDATLAS_ROOT=../gridatlas LIGHTNING_GEN=202610270113 \
 *     node --test drivers/gridatlas-lightning-integrity.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,webcrypto} from 'node:crypto';

const GEN=process.env.LIGHTNING_GEN||'202610270113';
const root=resolve(process.env.GRIDATLAS_ROOT||join(fileURLToPath(new URL('.',import.meta.url)),'../../gridatlas'));
const file='atlas/modules/'+GEN+'-uk-lightning-overlay.js';
const src=readFileSync(join(root,file),'utf8');
const seam='NS.ukLightning=Object.freeze(';
assert.equal(src.split(seam).length,2,'No stable read-only probe seam in candidate');
const probed=src.replace(seam,'window.__INDEPENDENT__={sh,lw,cf,cp,S};'+seam);
const now=Date.UTC(2026,9,27,1,0),date='2026-10-26';
const iso=t=>new Date(t).toISOString();
const feature=id=>({type:'Feature',id:'synthetic-'+id,
  geometry:{type:'Point',coordinates:[-1.5,52]},
  properties:{time_utc:iso(now-(14-id)*3600000),observation_kind:'optical_lightning_flash'}});
const day=features=>({schema:'uk-lightning-history-day.v1',type:'FeatureCollection',
  metadata:{date_utc:date},features});
const good=day([feature(1),feature(2)]);
const bad=day([feature(1)]);
const encode=o=>Buffer.from(JSON.stringify(o),'utf8');
const sha=o=>createHash('sha256').update(encode(o)).digest('hex');
const row=(o,hash=sha(o))=>({
  date,coverage:'full',scanned_seconds:86400,count:o.features.length,
  bytes:encode(o).length,path:'days/2026/10/26.json',
  sealed:false,sha256:hash
});
const index=(r,scanWindows=null)=>({
  schema:'uk-lightning-history-index.v2',
  observation:'satellite optical lightning flashes, not ground strikes',
  generated_utc:iso(now-600000),next_update_due_utc:iso(now+3600000),
  cutoff_date_utc:date,coverage_start_utc:iso(now-86400000),
  collection_interval_hours:1,
  scan_windows:scanWindows||[{start_utc:iso(now-86400000),end_utc:iso(now),successful_runs:24}],
  days:[r]
});
const response=(o)=>({
  ok:true,status:200,redirected:false,
  json:async()=>o,arrayBuffer:async()=>Uint8Array.from(encode(o)).buffer
});
function boot({rowData=row(good),days=[good],crypto=true,scanWindows=null}={}){
  const calls={index:0,day:0},idx=index(rowData,scanWindows);
  const get=async u=>{
    if(u.includes('/index.json')){calls.index++;return response(idx)}
    if(u.includes('/days/')){
      const n=calls.day++;
      return response(days[Math.min(n,days.length-1)]);
    }
    throw Error('Unexpected request to '+u);
  };
  const win={__GRIDATLAS_MODULES__:{},innerWidth:1440};
  if(crypto)win.crypto=webcrypto;
  const context={
    window:win,document:{},Date,Map,AbortController,Response,
    fetch:get,matchMedia:()=>({matches:false}),
    setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{}
  };
  vm.runInNewContext(probed,context,{filename:file,timeout:2000});
  return {probe:win.__INDEPENDENT__,calls};
}

test('I01 fail closed: absent WebCrypto cannot silently accept an index SHA-256 claim',async()=>{
  const x=boot({rowData:row(good,'0'.repeat(64)),crypto:false});
  await assert.rejects(
    x.probe.sh(x.probe.S.idx?.days?.[0]||row(good,'0'.repeat(64)),date),
    /crypto|sha256|integrity|unavailable/i,
    'A missing crypto.subtle must not turn an unverified shard into accepted data');
});

test('I02 positive control: available WebCrypto rejects same-byte/count wrong SHA-256',async()=>{
  const x=boot({rowData:row(good,'0'.repeat(64)),crypto:true});
  await assert.rejects(x.probe.sh(row(good,'0'.repeat(64)),date),/mismatch.*sha256/i);
});

test('I03 fail-first: persistent index/shard mismatch remains named after one refetch',async()=>{
  const x=boot({rowData:row(good),days:[bad,bad],crypto:true});
  const result=await x.probe.lw(now,0);
  const status=x.probe.cf(result,now),captions=x.probe.cp(result,now,status);
  assert.equal(x.calls.index,2,'Exactly one index refetch after the first mismatch');
  assert.equal(x.calls.day,2,'Both first and retried shard must be examined');
  assert.equal(status.st,'PARTIAL','Missing shard cannot become zero or READY');
  assert.match(captions.warning,/index mismatch.*(?:count|bytes|sha256)/i,
    'After retry, keep the verified integrity-failure reason in user-visible status; not just a generic updating label');
});

test('I04 positive control: one mismatched shard followed by a valid refreshed shard recovers',async()=>{
  const x=boot({rowData:row(good),days:[bad,good],crypto:true});
  const result=await x.probe.lw(now,0);
  assert.equal(x.calls.index,2);
  assert.equal(x.calls.day,2);
  assert.equal(result.mode,'detail');
  assert.equal(result.fl.length,0);
  assert.equal(result.ev.length,2);
  assert.deepEqual(Array.from(result.ev,f=>f.id),['synthetic-1','synthetic-2']);
});


// G05/G06: A valid byte digest authenticates a file, NOT its semantic contents.
// Full-day scanned fixture avoids the unrelated 24h window-edge unknown tail.
const fullDayScan=[{start_utc:date+'T00:00:00Z',end_utc:'2026-10-27T00:00:00Z',successful_runs:24}];
const wholeDay=x=>{
  x.probe.S.period='custom';
  x.probe.S.from=x.probe.S.to=date;
};
test('G05 FAIL-FIRST: wholly invalid but correctly hashed flash records cannot be labelled EMPTY-COVERED / searched 100%',async()=>{
  const invalid=day([feature(1),feature(2)].map(f=>({
    ...f,properties:{...f.properties,observation_kind:'not_an_optical_flash'}
  })));
  const x=boot({rowData:row(invalid),days:[invalid],crypto:true,scanWindows:fullDayScan});
  wholeDay(x);
  const r=await x.probe.lw(now,0),status=x.probe.cf(r,now);
  const caption=x.probe.cp(r,now,status);
  assert.equal(r.mode,'detail','Must actually fetch and parse the valid-hash day');
  assert.equal(r.fl.length,0,'This is NOT a transport/digest failure');
  assert.equal(r.ev.length,0,'No invalid feature should be plotted');
  assert.equal(r.ev.bad,2,'Two semantically invalid source features are rejected');
  assert.notEqual(status.st,'EMPTY-COVERED',
    'Source day declares two flashes, but both were rejected: cannot assert no flashes detected / 100%');
  assert.match(caption.warning,/invalid|rejected|malformed|incomplete|unknown|partial/i,
    'Source validation loss must be prominent in the warning, not only a small drawn-count suffix');
});
test('G06 FAIL-FIRST: missing index sha256 with WebCrypto absent cannot be accepted as READY·DETAIL',async()=>{
  const noHash=row(good);
  delete noHash.sha256;
  const x=boot({rowData:noHash,days:[good],crypto:false,scanWindows:fullDayScan});
  wholeDay(x);
  const r=await x.probe.lw(now,0),status=x.probe.cf(r,now);
  assert.notEqual(status.st,'READY·DETAIL',
    'A source index missing its mandatory sha256 is not a verified archive even if count and bytes match');
  assert.ok(r.fl.length || status.st==='PARTIAL' || status.st==='UNKNOWN' || status.st==='FAIL',
    'Unverifiable day must be flagged as incomplete/unknown, not counted as verified');
});
