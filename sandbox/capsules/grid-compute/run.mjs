import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {backendFor,assess} from './detector.mjs';
const require=createRequire(import.meta.url);let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright');}
const here=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const config=JSON.parse(fs.readFileSync(path.join(here,process.env.CAPSULE_CONFIG||'latest.json')));const out=config.output;
fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(config.case_manifest));
if(manifest.repd_count!==100||manifest.cases.filter(c=>c.kind==='repd').length!==100||new Set(manifest.cases.filter(c=>c.kind==='repd').map(c=>c.entity_id)).size!==100)throw Error('The corpus must contain exactly 100 distinct REPD IDs');
const backend=backendFor(JSON.parse(fs.readFileSync(path.join(out,'grid_substations.geojson'))));
if(process.env.CAPSULE_KIND)manifest.cases=manifest.cases.filter(c=>c.kind===process.env.CAPSULE_KIND);
if(process.env.CAPSULE_CASES){const wanted=new Set(process.env.CAPSULE_CASES.split(','));manifest.cases=manifest.cases.filter(c=>wanted.has(c.case_id));if(manifest.cases.length!==wanted.size)throw Error('Requested case missing from corpus');}
const report={schema:'testcode.grid-compute-capsule.v1',started_utc:new Date().toISOString(),base:config.base,repd_required:100,industrial_required:10,checks:[]};
const browsers=process.env.CAPSULE_BROWSERS?.split(',')||['chrome'];const limit=Number(process.env.CAPSULE_LIMIT)||manifest.cases.length;
const profiles={chrome:{engine:'chromium',channel:'chrome'},edge:{engine:'chromium',channel:'msedge'},firefox:{engine:'firefox'},webkit:{engine:'webkit'},'chrome-android-emulation':{engine:'chromium',channel:'chrome',context:{...pw.devices['Pixel 7']}},'webkit-iphone-emulation':{engine:'webkit',context:{...pw.devices['iPhone 13']}}};
function save(){fs.writeFileSync(path.join(out,(process.env.CAPSULE_REPORT||'backend-browser-report')+'.json'),JSON.stringify(report,null,2));}
function urlFor(c,visit){const u=new URL('atlas/',config.base);for(const [k,v]of Object.entries({testcode_case:c.case_id,testcode_visit:visit,testcode_entity_kind:c.kind,testcode_entity_id:c.entity_id}))u.searchParams.set(k,v);if(c.kind==='repd'){for(const [k,v]of Object.entries({repd_ref:c.entity_id,technology:c.technology,project:c.name,capacity_mw:c.capacity_mw}))if(v!=null)u.searchParams.set(k,v);if(c.has_location){u.searchParams.set('longitude',c.longitude);u.searchParams.set('latitude',c.latitude);}}return u.href;}
for(const profileName of browsers){
 const profile=profiles[profileName];if(!profile)throw Error('Unknown browser '+profileName);
 const b=await pw[profile.engine].launch({headless:true,...(profile.channel?{channel:profile.channel}:{})});
 let next=0;
 try{await Promise.all([0,1].map(async worker=>{
  const context=await b.newContext({viewport:{width:1400,height:900},...profile.context});
  try{while(next<limit){const c=manifest.cases[next++];const visit='auto-'+profileName+'-'+c.case_id;const page=await context.newPage();page.setDefaultTimeout(45000);
   const consoleErrors=[];const networkFailures=[];const dataHashes=[];
   page.on('pageerror',e=>consoleErrors.push(String(e)));page.on('requestfailed',r=>networkFailures.push({url:r.url(),error:r.failure()}));
   page.on('response',async r=>{if(r.url().endsWith('grid_substations.geojson'))try{dataHashes.push({url:r.url(),status:r.status(),sha256:crypto.createHash('sha256').update(await r.body()).digest('hex')});}catch{}});
   let raw=null,error=null;const backendReceipt=await backend(c);
   try{
    await page.goto(urlFor(c,visit),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__TESTCODE_GRID_DETECTOR__);
    if(c.kind==='industrial'){
      await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__?.getLayer('l-naei_co2'));
      await page.getByRole('button',{name:'File',exact:true}).waitFor({state:'visible'});
      await page.locator('#gridatlas-dash-toggle').waitFor({state:'visible'});
      const showLayers=page.getByRole('button',{name:'Show the layers panel',exact:true});
      if(await showLayers.isVisible())await showLayers.click();
      const checkbox=page.locator('input[data-layer-id="naei_co2"]:visible').last();
      await checkbox.check();
      // Resolve neighbouring industrial sites 30 m apart through normal zoom.
      await page.evaluate(point=>window.__GRIDATLAS_V9_MAP__.jumpTo({center:point,zoom:17}),[c.longitude,c.latitude]);
      await page.waitForFunction(expected=>window.__GRIDATLAS_V9_MAP__.querySourceFeatures('src-naei_co2').some(f=>f.properties.name===expected.name),{name:c.name},{timeout:20000});
      await page.getByRole('button',{name:'Hide the layers panel',exact:true}).click();
      const point=await page.evaluate(at=>{const m=window.__GRIDATLAS_V9_MAP__,r=m.getContainer().getBoundingClientRect(),p=m.project(at);return {x:r.x+p.x,y:r.y+p.y};},[c.longitude,c.latitude]);
      await page.mouse.click(point.x,point.y);await page.waitForTimeout(1800);
    }else{
      await page.waitForFunction(()=>{const r=window.__TESTCODE_GRID_DETECTOR__?.snapshot();const owner=window.__GRIDATLAS_PLACE_SEARCH__?.deep_link;return (r?.operation==='Atlas selectAt / nearest-grid'&&['completed','failed','unsupported','completed_empty'].includes(r.status))||['FAILED','IDENTIFIED_NO_GEOMETRY','NOT_IN_ACTIVE_REGISTER'].includes(owner?.status);});
      await page.waitForTimeout(1600);
    }
    raw=await page.evaluate(()=>{const d=window.__TESTCODE_GRID_DETECTOR__,m=window.__GRIDATLAS_V9_MAP__;const layers=m?.getStyle()?.layers?.filter(l=>l.source==='gridatlas-neon-links'&&l.type==='line').map(l=>l.id)||[];return {records:d?.records||[],owner:window.__GRIDATLAS_PLACE_SEARCH__?.deep_link,body:document.body.innerText,presentation:{sourceLineCount:m?.getSource('gridatlas-neon-links')?._data?.features?.filter(f=>f.geometry.type==='LineString').length||0,renderedLineCount:layers.length?m.queryRenderedFeatures({layers}).length:0},generation:window.__GRIDATLAS_ATLAS__?.generation};});
   }catch(e){error=String(e);raw=await page.evaluate(()=>({records:window.__TESTCODE_GRID_DETECTOR__?.records||[],body:document.body.innerText,owner:window.__GRIDATLAS_PLACE_SEARCH__?.deep_link})).catch(()=>({records:[]}));}
   // User policy: retain compact coded observations, never screenshot files.
   const screenshot=null;
   const verdict=assess(c,raw.records,raw.presentation,backendReceipt);
   const result={case_id:c.case_id,kind:c.kind,technology:c.technology,name:c.name,browser:profileName,browser_version:b.version(),visit_id:visit,url:page.url(),screenshot,backend:backendReceipt,...verdict,error,raw,consoleErrors,networkFailures,dataHashes};
   fs.writeFileSync(path.join(out,visit+'.json'),JSON.stringify(result,null,2));report.checks.push(result);save();console.log(profileName,c.case_id,verdict.outcome);await page.close();
  }}finally{await context.close();}
 }));}finally{await b.close();}
}
report.finished_utc=new Date().toISOString();report.counts={tested:report.checks.length,passed:report.checks.filter(c=>c.passed).length,engine_fired:report.checks.filter(c=>c.engine_fired).length};save();console.log(JSON.stringify(report.counts));
process.exitCode=report.checks.every(c=>c.passed)?0:1;
