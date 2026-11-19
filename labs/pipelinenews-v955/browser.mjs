import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const here=dirname(fileURLToPath(import.meta.url));
const cfg=JSON.parse(readFileSync(resolve(here,'inputs.json'),'utf8'));
const source=resolve(process.env.SOURCE_ROOT||resolve(here,'source'));
const out=resolve(process.env.EVIDENCE_DIR||resolve(here,'evidence'));
mkdirSync(out,{recursive:true});
const require=createRequire(pathToFileURL(resolve(source,cfg.source.release,'package.json')));
const { chromium,webkit }=require('playwright');
const base=process.env.LAB_URL||'http://127.0.0.1:8765/';
const report={source:cfg.source.sha,base,viewports:[],baselines:[],scenarios:[],bugs:[],requests:[],notes:['A valid MAP URL is not a verified physical electrical trace','Simulated WebKit is not owner iPhone acceptance']};
const errors=[];
function fail(code,detail,where=''){errors.push({code,detail,where});}
function observe(code,detail,where=''){report.bugs.push({code,detail,where});}
async function ready(page,where){
 await page.waitForFunction(()=>document.querySelector('#v2')?.textContent.replaceAll(',','').trim()==='3604'&&document.querySelectorAll('#tbody tr[id^="repd-"]').length>0,null,{timeout:75000});
 await page.waitForFunction(()=>document.querySelector('#headlineTicker .pn-ticker-title')&&document.querySelector('#newsStatus')?.dataset.order==='date',null,{timeout:20000});
}
function listen(page){
 const pageErrors=[],badLocal=[],badExternal=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 page.on('response',r=>{if(r.status()>=400){const entry={url:r.url(),status:r.status()};(r.url().startsWith(base)?badLocal:badExternal).push(entry);}});
 page.on('requestfailed',r=>{const entry={url:r.url(),reason:r.failure()?.errorText||'request failed'};(r.url().startsWith(base)?badLocal:badExternal).push(entry);});
 return {pageErrors,badLocal,badExternal};
}
const engines=[['chromium',chromium],['webkit',webkit]];
for(const [engine,launcher] of engines){
 const b=await launcher.launch({headless:true});
 try{
  for(const [width,height] of [[320,568],[375,667],[393,852],[768,1024],[1440,900],[1920,1080]]){
   const name=engine+'-'+width;
   const page=await b.newPage({viewport:{width,height},reducedMotion:'reduce'});
   const log=listen(page);
   const entry={engine,width,height,ok:false};
   try{
    await page.goto(base+cfg.source.release+'/?technology=solar',{waitUntil:'domcontentloaded',timeout:60000});
    await page.screenshot({path:resolve(out,name+'-cold.png')});
    await ready(page,name);
    const measurements=await page.evaluate(()=>{
     const rect=s=>{const el=document.querySelector(s);if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
     const ticker=document.querySelector('#headlineTicker .pn-ticker-title');
     const t=ticker?getComputedStyle(ticker):null;
     const titles=[...document.querySelectorAll('#liveNews .ln-title')].map(a=>a.href);
     const doc=window.pipelineHeadlineDocument;
     const dates=titles.map(url=>{const item=doc?.items?.find(x=>x.link===url);return item?Date.parse(item.date||'')||0:null;});
     const gauges=['g1','g2','g3'].map(id=>({id,rect:rect('#'+id),chart:typeof Chart==='function'&&!!Chart.getChart(document.getElementById(id))}));
     return {main:rect('.main'),hud:rect('.hud-gauges'),ticker:rect('#headlineTicker'),gauges,red:t?.color,glow:t?.textShadow,newsOrder:document.querySelector('#newsStatus')?.dataset.order,dates,headlines:titles.length,rows:document.querySelectorAll('#tbody tr[id^="repd-"]').length,full:document.querySelector('#tbody')?.dataset.total,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,title:document.title,hidden:!!document.querySelector('.hud-gauges')?.closest('details:not([open])'),searchVisible:(()=>{const e=document.querySelector('#newsSearch');return e?!!e.getClientRects().length:false;})()};
    });
    entry.measurements=measurements;
    const expect=(ok,code,detail)=>{if(!ok)fail(code,detail,name);};
    expect(measurements.gauges.length===3&&measurements.gauges.every(g=>g.chart&&g.rect.width>35&&g.rect.height>40),'CHART-NOT-REAL','Chart.js instances/canvases not present');
    expect(!measurements.hidden&&measurements.hud.bottom<=height,'HUD-NOT-VISIBLE',JSON.stringify(measurements.hud));
    expect(measurements.ticker.bottom<=measurements.hud.y,'TICKER-ORDER','ticker below HUD');
    expect(measurements.red==='rgb(255, 48, 56)'&&measurements.glow!=='none','TICKER-RED','red/glow computed mismatch');
    expect(measurements.scrollWidth<=measurements.clientWidth+2,'HORIZONTAL-OVERFLOW',measurements.scrollWidth+'/'+measurements.clientWidth);
    expect(measurements.rows===50,'PAGE-SIZE','Expected 50 rows, found '+measurements.rows);
    expect(measurements.full==='3604','SOLAR-POPULATION','Filtered total '+measurements.full);
    expect(measurements.newsOrder==='date'&&measurements.headlines>0,'NEWS-NOT-CHRONOLOGICAL','No publication ordering');
    expect(measurements.dates.filter(x=>x!==null).every((d,i,a)=>i===0||d<=a[i-1]),'NEWS-DATE-ORDER',JSON.stringify(measurements.dates));
    expect(!measurements.searchVisible,'SEARCH-FLASH','Search control exposed on default surface');
    expect(Math.abs(measurements.main.x-(measurements.clientWidth-measurements.main.right))<=6,'NOT-CENTRED','main horizontal offsets differ');
    if(/V9\.54/.test(measurements.title))observe('PN-955-LABEL','V9.55 document title still V9.54',name);
    await page.screenshot({path:resolve(out,name+'-hud.png'),fullPage:false});
    const table=await page.evaluate(()=>{
     const wrap=document.querySelector('#repdScroll'),first=wrap.querySelector('tbody tr[id^="repd-"] td.site'),before=first.getBoundingClientRect().x;
     wrap.scrollLeft=Math.min(350,wrap.scrollWidth-wrap.clientWidth);
     return {scroll:wrap.scrollLeft,before,after:first.getBoundingClientRect().x,firstWidth:first.getBoundingClientRect().width,viewport:wrap.clientWidth};
    });
    entry.table=table;
    expect(table.scroll>0,'TABLE-NOT-SCROLLABLE',JSON.stringify(table));
    expect(Math.abs(table.before-table.after)<3,'STICKY-FAILED',JSON.stringify(table));
    expect(table.firstWidth<table.viewport*.85,'FROZEN-TOO-WIDE',JSON.stringify(table));
    const first=page.locator('#tbody tr[id^="repd-"]').first();
    await first.locator('details.project-record summary').click();
    expect(await first.locator('details.project-record').evaluate(e=>e.open),'DETAILS-FAILED','First row did not expand');
    const map=await first.locator('a.pn-journey-link').first().getAttribute('href').catch(()=>null);
    const original=await first.locator('a.atlaslink:not(.pn-journey-link)').first().getAttribute('href').catch(()=>null);
    entry.map={map,original};
    expect(!!map&&/^https:\/\/ventusltd\.github\.io\/gridatlas\/atlas\//.test(map),'MAP-MISSING',String(map));
    if(map&&original){
     const a=new URL(map),o=new URL(original);
     expect(a.searchParams.get('repd_ref')===o.searchParams.get('repd_ref'),'MAP-IDENTITY',map+' vs '+original);
    }
    await page.screenshot({path:resolve(out,name+'-expanded.png')});
    await page.locator('#sortProjects').selectOption('name_asc');
    const names=await page.locator('#tbody tr[id^="repd-"] td.site .compact-project-name').allTextContents();
    expect(names.length===50,'SORT-ROWS','name sort changed page size');
    expect(names.length>1&&names[0].localeCompare(names.at(-1),'en',{sensitivity:'base'})<=0,'SORT-ORDER',names[0]+' / '+names.at(-1));
    await page.locator('#sortProjects').selectOption('capacity_desc');
    await page.locator('[data-page-step="1"]').first().click();
    const pager=await page.locator('#tbody').getAttribute('data-page');
    expect(Number(pager)>=2,'PAGINATION','Next page did not advance: '+pager);
    await page.locator('#minMW').fill('100');
    await page.locator('#applyMW').click();
    const filtered=await page.locator('#v2').textContent();
    expect(Number(filtered.replaceAll(',',''))<3604,'MW-FILTER','Minimum MW did not reduce projects: '+filtered);
    await page.reload({waitUntil:'domcontentloaded'});
    await ready(page,name+'-warm');
    entry.warm={newsOrder:await page.locator('#newsStatus').getAttribute('data-order'),gauges:await page.locator('.hud-gauges canvas').count()};
    await page.screenshot({path:resolve(out,name+'-warm.png')});
    if(log.pageErrors.length)fail('PAGE-ERROR',log.pageErrors.join(' | '),name);
    if(log.badLocal.length)fail('LOCAL-REQUEST-FAIL',JSON.stringify(log.badLocal),name);
    entry.ok=true;
   }catch(e){fail('TEST-EXCEPTION',e.stack||e.message,name);await page.screenshot({path:resolve(out,name+'-FAIL.png')}).catch(()=>{});}
   finally{entry.log=log;report.viewports.push(entry);await page.close();}
  }
  // Negative test: do not mistake numeric gauge labels for a working Chart.js dashboard.
  const page=await b.newPage({viewport:{width:393,height:852}});
  await page.route('https://cdn.jsdelivr.net/npm/chart.js@4.5.1/**',route=>route.abort('failed'));
  const denied={engine,scenario:'Chart.js CDN unavailable'};
  try{
   await page.goto(base+cfg.source.release+'/?technology=solar',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#v2')?.textContent.replaceAll(',','').trim()==='3604',null,{timeout:70000});
   denied.state=await page.evaluate(()=>({chartType:typeof Chart,number:document.querySelector('#v2')?.textContent,visibleWarning:/chart unavailable|visualisation unavailable|visualization unavailable|gauge unavailable/i.test(document.body.innerText),canvasCount:document.querySelectorAll('.hud-gauges canvas').length}));
   if(denied.state.chartType!=='function'&&!denied.state.visibleWarning)observe('PN-955-SILENT-CDN','CDN denied; numbers rendered but no visible warning that doughnut charts failed',engine);
   await page.screenshot({path:resolve(out,engine+'-cdn-denied.png')});
  }catch(e){denied.error=e.message;fail('CDN-NEGATIVE-TEST',e.message,engine);}
  finally{report.scenarios.push(denied);await page.close();}
  // Previous versions: load genuine frozen source, not mocked data, and record baseline behavior.
  for(const prior of cfg.source.comparison_releases){
   const page=await b.newPage({viewport:{width:393,height:852},reducedMotion:'reduce'});
   const name=engine+'-'+prior.path.split('/').at(-1);
   try{
    await page.goto(base+prior.path+'/?technology=solar',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>document.querySelector('#v2')?.textContent.replaceAll(',','').trim()==='3604',null,{timeout:70000});
    const x=await page.evaluate(()=>({title:document.title,charts:[...document.querySelectorAll('canvas')].filter(e=>/^g[123]$/.test(e.id)).length,rows:document.querySelectorAll('#tbody tr[id^="repd-"]').length,news:document.querySelectorAll('#liveNews .ln-item').length}));
    report.baselines.push({name,...x});
    await page.screenshot({path:resolve(out,name+'-baseline.png')});
   }catch(e){report.baselines.push({name,error:e.message});fail('BASELINE-LOAD',e.message,name);}
   finally{await page.close();}
  }
 }finally{await b.close();}
}
report.failures=errors;
writeFileSync(resolve(out,'browser.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({tested:report.viewports.length,baseline:report.baselines.length,scenarios:report.scenarios,bugs:[...new Map(report.bugs.map(x=>[x.code,x])).values()],failures:errors},null,2));
assert.equal(errors.length,0,'Browser regression failures: '+errors.map(x=>x.code+' '+x.where).join(', '));
assert.ok(!report.bugs.some(x=>x.code==='PN-955-LABEL'||x.code==='PN-955-SILENT-CDN'),'Detected user-facing release/visualisation defects; preserve evidence');
