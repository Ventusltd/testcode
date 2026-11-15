/**
 * AGENT 9 - REAL remote GridAtlas execution with TEST-ONLY candidate override.
 * Clicks a real pinned Pipeline News MAP anchor. Does NOT modify live site or
 * assert that the candidate cartridge is served by GitHub Pages. The exact
 * manifest and cartridge byte substitutions are recorded in the receipt.
 * Browser destination, MapLibre, six-cartridge loader and nearest calculation
 * are real: no fake receiver, no GridAtlas calculation stubs.
 */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {chromium,webkit} from 'playwright';
const root=resolve(process.argv[2]||'pinned-pipeline/uk_renewables_pipeline/202611151300');
const candidateDir=resolve(process.argv[3]||'agent9-candidate');
const out=resolve(process.env.AGENT9_BROWSER_OUTPUT||'agent9-browser');
const browserName=process.env.AGENT9_BROWSER||'chromium';
const width=Number(process.env.AGENT9_WIDTH||390);
const repdRef=String(process.env.AGENT9_REPD_REF||'12588');
const sourceBase=process.env.AGENT9_SOURCE_URL||'http://127.0.0.1:8765/uk_renewables_pipeline/202611151300/';
const observedGen='202611132345';
assert.ok(['chromium','webkit'].includes(browserName)&&[390,393,1440].includes(width));
const manifest=JSON.parse(await readFile(join(root,'data/v9.1/build_manifest.json'),'utf8'));
const parts=manifest.project_partitions;
let row=null;
for(const part of parts){
 const b=await readFile(join(root,part.path));
 const sha=createHash('sha256').update(b).digest('hex');
 assert.equal(sha,part.sha256,'pinned project partition bytes');
 const records=JSON.parse(b).projects;
 if(!row)row=records.find(x=>String(x.repd_ref)===repdRef)||null;
}
assert.ok(row&&row.geometry_status==='valid'&&Number.isFinite(row.latitude)&&Number.isFinite(row.longitude),'genuine source coordinates');
const candidate=await readFile(join(candidateDir,'agent9-sld-mobile-restore-candidate.js'));
const candManifest=JSON.parse(await readFile(join(candidateDir,'candidate-manifest.json'),'utf8'));
const candidateHash=createHash('sha256').update(candidate).digest('hex');
assert.equal(candidateHash,candManifest.candidate_sha256);
const result={schema:'agent9.real-engine-test-only-override.v1',status:'FAIL',evidence_class:'REAL BROWSER + TEST-ONLY TWO-NETWORK-RESPONSES OVERRIDDEN; NOT A PUBLIC SERVED PREVIEW',
 input:{sourceBase,repdRef,technology:row.technology,latitude:row.latitude,longitude:row.longitude,
  browser:browserName,width,sourcePipelineSha:'998c4cddbd78f04bcdd9df2a40026ac91714cd2f',
  originalGridatlasMainSha:'4c52780c04a90608d8a072172138b9063e5a4684',
  originalGeneration:observedGen,originalCartridgeSha:candManifest.origin_source_sha256,
  testOnlyCartridgeSha:candidateHash},
 overrides:[],events:[],pageErrors:[],networkFailures:[],startUTC:new Date().toISOString()};
await mkdir(out,{recursive:true});
const engine=browserName==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true});
try{
 const context=await browser.newContext({
  viewport:{width,height:width===1440?900:852},
  isMobile:width!==1440,hasTouch:width!==1440,acceptDownloads:true
 });
 const source=await context.newPage();
 source.on('pageerror',e=>result.pageErrors.push('SOURCE '+e.message.slice(0,300)));
 // Intercept ONLY the destination's two source-bearing responses. Full real
 // composer, immutable shell, remaining cartridges and substation data load.
 await context.route('https://ventusltd.github.io/gridatlas/atlas/current.json',async route=>{
  const r=await route.fetch();
  assert.equal(r.status(),200,'real GridAtlas current.json must respond');
  const j=await r.json();
  assert.equal(j.generation,observedGen,'live source changed; conscious re-pin required');
  const entry=j.cartridges.find(c=>c.id==='sld-sandbox');
  assert.ok(entry,'real SLD slot absent');
  assert.equal(entry.sha256,candManifest.origin_source_sha256,'old cartridge pin changed');
  entry.sha256=candidateHash;
  result.overrides.push({resource:'atlas/current.json',kind:'TEST-ONLY HASH SUBSTITUTION',
   oldSha256:candManifest.origin_source_sha256,newSha256:candidateHash});
  await route.fulfill({status:200,contentType:'application/json',
   headers:{'access-control-allow-origin':'*','cache-control':'no-store'},body:JSON.stringify(j)});
 });
 await context.route('https://ventusltd.github.io/gridatlas/atlas/cartridges/202609241334-sld-sandbox-v9-8.js',async route=>{
  result.overrides.push({resource:'sld-sandbox cartridge',kind:'TEST-ONLY BYTE SUBSTITUTION',
   sourceSha256:candManifest.origin_source_sha256,installedSha256:candidateHash});
  await route.fulfill({status:200,contentType:'application/javascript',
   headers:{'access-control-allow-origin':'*','cache-control':'no-store'},body:candidate});
 });
 source.on('requestfailed',req=>result.networkFailures.push({phase:'SOURCE',url:req.url().slice(0,200),failure:req.failure()}));
 // The pinned V9.22 SOURCE is served locally from real source files.
 // Only optional Chart.js is stubbed on the SOURCE, not GridAtlas destination.
 await source.addInitScript(()=>{window.Chart=class ChartStub{
  constructor(_c,config){this.data=config?.data||{datasets:[]};}update(){}destroy(){}
 };});
 await source.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({
  status:200,contentType:'application/javascript',body:''}));
 await source.goto(sourceBase,{waitUntil:'domcontentloaded',timeout:60000});
 await source.waitForFunction(()=>document.querySelector('#tbody')?.dataset.total==='7775',null,{timeout:80000});
 const search=source.locator('#search');
 await search.fill(repdRef);
 // Require a complete REPD query parameter, not a prefix: 1018 must never select 10181.
 const target=source.locator('#tbody a.atlaslink[href*="repd_ref='+repdRef+'&"]').first();
 await target.waitFor({state:'visible',timeout:35000});
 const href=await target.getAttribute('href');
 const url=new URL(href,sourceBase);
 assert.equal(url.origin+url.pathname,'https://ventusltd.github.io/gridatlas/atlas/');
 assert.equal(url.searchParams.get('repd_ref'),repdRef);
 assert.equal(url.searchParams.get('technology'),row.technology);
 assert.equal(Number(url.searchParams.get('latitude')),row.latitude);
 assert.equal(Number(url.searchParams.get('longitude')),row.longitude);
 result.mapHref=url.href;
 // Let Playwright's click action re-resolve transient table DOM updates and auto-scroll.
 // A detached locator on an explicit pre-scroll is not evidence of GridAtlas failure.
 const [dest] = await Promise.all([
  context.waitForEvent('page',{timeout:25000}),
  target.click({timeout:25000})
 ]);
 result.actualClickedUrl=dest.url();
 assert.equal(new URL(dest.url()).pathname,url.pathname);
 dest.on('pageerror',e=>result.pageErrors.push('GRIDATLAS '+e.message.slice(0,300)));
 dest.on('requestfailed',req=>result.networkFailures.push({phase:'GRIDATLAS',url:req.url().slice(0,200),failure:req.failure()}));
 await dest.waitForLoadState('domcontentloaded',{timeout:60000});
 const started=Date.now();
 await dest.waitForFunction(()=>{
  const a=window.__GRIDATLAS_ATLAS__,x=window.__GRIDATLAS_NEON_LINKS__;
  return !!a && a.loaded_cartridges?.length===6 && x?.technology_layer?.enabled===true
   && x?.project_layer_enabled && Array.isArray(x?.failures);
 },null,{timeout:110000});
 result.compose=await dest.evaluate(()=>({
  generation:document.documentElement.dataset.gridatlasGeneration,
  cartridges:window.__GRIDATLAS_ATLAS__?.loaded_cartridges,
  tech:window.__GRIDATLAS_NEON_LINKS__?.technology_layer,
  projectLayer:window.__GRIDATLAS_NEON_LINKS__?.project_layer_enabled,
  failures:window.__GRIDATLAS_NEON_LINKS__?.failures
 }));
 assert.equal(result.compose.generation,observedGen);
 assert.equal(result.compose.cartridges.length,6);
 assert.ok(result.compose.cartridges.some(c=>c.id==='sld-sandbox'&&c.sha256===candidateHash));
 assert.deepEqual(result.compose.failures,[]);
 result.events.push({event:'engine-ready',ms:Date.now()-started});
 // Actual visible popup, no source rewriting or synthetic control click.
 const popup=dest.locator('.maplibregl-popup').first();
 await popup.waitFor({state:'visible',timeout:35000});
 const measured=()=>dest.evaluate(()=>{
  const popup=document.querySelector('.maplibregl-popup');
  const block=popup?.querySelector('.gridatlas-neon-block');
  const button=popup?.querySelector('.gridatlas-card-bar button.min');
  const text=block?.innerText||'';
  const rect=block?.getBoundingClientRect();
  let visible=!!rect&&rect.width>0&&rect.height>0&&rect.top<innerHeight&&rect.bottom>0;
  for(let node=block;visible&&node&&node!==document.body;node=node.parentElement){
   const cs=getComputedStyle(node); if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0')visible=false;
  }
  if(popup?.classList.contains('gridatlas-min'))visible=false;
  return {popupFound:!!popup,collapsed:!!popup?.classList.contains('gridatlas-min'),
   blockFound:!!block,hasNearest:/Nearest\s+\d+\s*kV\s+substation\s*:/i.test(text),
   renderedNearestVisible:visible&&/Nearest\s+\d+\s*kV\s+substation\s*:/i.test(text),
   hiddenDOM:/Nearest\s+\d+\s*kV\s+substation\s*:/i.test(document.body?.textContent||''),
   buttonText:button?.textContent?.trim()||null,aria:button?.getAttribute('aria-expanded')||null,
   accessibleLabel:button?.getAttribute('aria-label')||null,
   width:button?.getBoundingClientRect().width||0,height:button?.getBoundingClientRect().height||0,
   nearestExcerpt:text.match(/Nearest\s+\d+\s*kV\s+substation\s*:[^\n]{0,180}/i)?.[0]||null};
 });
 result.initial=await measured();
 await dest.screenshot({path:join(out,'before-'+browserName+'-'+width+'-'+repdRef+'.png'),timeout:20000});
 if(width!==1440){
  assert.equal(result.initial.collapsed,true,'first arrival should be map-first collapsed');
  assert.equal(result.initial.buttonText,'+','map-first card must offer plus glyph');
  assert.equal(result.initial.aria,'false');
  const restore=dest.locator('.maplibregl-popup.gridatlas-min .gridatlas-card-bar button.min').first();
  assert.equal(await restore.count(),1,'single real restore control');
  await restore.click({timeout:15000});
  result.events.push({event:'real-first-restore-click',ms:Date.now()-started});
 }
 await dest.waitForFunction(()=>{
  const p=document.querySelector('.maplibregl-popup:not(.gridatlas-min)');
  return !!p && /Nearest\s+\d+\s*kV\s+substation\s*:/i.test(p.innerText||'');
 },null,{timeout:35000});
 result.afterFirst=await measured();
 assert.equal(result.afterFirst.renderedNearestVisible,true,'answer must be actually rendered visible');
 assert.equal(result.afterFirst.collapsed,false);
 if(width!==1440){
  assert.equal(result.afterFirst.buttonText,'−');
  assert.equal(result.afterFirst.aria,'true');
  assert.ok(/Hide/.test(result.afterFirst.accessibleLabel||''));
  assert.ok(result.afterFirst.width>=44&&result.afterFirst.height>=44,'44px target');
 }
 await dest.screenshot({path:join(out,'expanded-'+browserName+'-'+width+'-'+repdRef+'.png'),timeout:20000});
 await dest.waitForTimeout(1600);
 result.after1600=await measured();
 await dest.waitForTimeout(3700);
 result.after5300=await measured();
 assert.ok(result.after1600.renderedNearestVisible,'1.6s stability');
 assert.ok(result.after5300.renderedNearestVisible,'5.3s stability');
 // Deliberately destroy measurement block, exercising real DOM MutationObserver
 // reinjection path. This is TIMING-INJECTED evidence, not unmodified browser.
 await dest.evaluate(()=>document.querySelector('.maplibregl-popup .gridatlas-neon-block')?.remove());
 await dest.waitForTimeout(1800);
 result.afterForcedInjection=await measured();
 assert.equal(result.afterForcedInjection.renderedNearestVisible,true,'real card-keeper reinjection must preserve expanded intent');
 assert.deepEqual(result.pageErrors.filter(x=>x.startsWith('GRIDATLAS')),[]);
 result.status='PASS';result.events.push({event:'done',ms:Date.now()-started});
 await dest.screenshot({path:join(out,'post-refresh-'+browserName+'-'+width+'-'+repdRef+'.png'),timeout:20000});
 await context.close();
}catch(error){
 result.failure=String(error?.stack||error).slice(0,1800);
}finally{
 result.endUTC=new Date().toISOString();
 await writeFile(join(out,'verdict-'+browserName+'-'+width+'-'+repdRef+'.json'),JSON.stringify(result,null,2)+'\n');
 await browser.close();
}
console.log(JSON.stringify({status:result.status,ref:repdRef,browser:browserName,width,
 candidateHash,overrides:result.overrides.length,failure:result.failure||null,
 initial:result.initial,afterFirst:result.afterFirst,after5300:result.after5300,afterForcedInjection:result.afterForcedInjection}));
if(result.status!=='PASS')process.exitCode=1;
