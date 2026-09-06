const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
let playwright;
try {playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');}
catch (error) {
  if (process.env.PLAYWRIGHT_MODULE) throw error;
  playwright = require('C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright');
}
const root = path.resolve(__dirname, '../..');
const generation = process.env.TEST_GENERATION;
if (!/^\d{12}$/.test(generation || '')) throw Error('TEST_GENERATION must identify an immutable candidate');
const output = path.resolve(process.env.TEST_OUTPUT || 'offshore-route-artifacts');
fs.mkdirSync(output, {recursive:true});
const report = {generation, profiles:[], sourceMode:'Actual composed files; no request interception or source substitution', limitations:['Chrome phone emulation is not physical-device evidence.','Straight lines are mapped measurements, not surveyed export routes.']};
const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const relative = pathname.startsWith('/testcode/') ? '/sandbox/' + pathname.slice(10) : pathname;
  let file = path.resolve(root, '.' + relative);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try {
    if (fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
    const repoPath=path.relative(root,file).split(path.sep).join('/');
    const bytes=repoPath.startsWith('sandbox/202609051906/')
      ? execFileSync('git',['show','HEAD:'+repoPath],{cwd:root,maxBuffer:64*1024*1024}) : fs.readFileSync(file);
    res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css'})[path.extname(file)]||'application/octet-stream'}).end(bytes);
  } catch {res.writeHead(404).end();}
});
function save(){fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2)+'\n');}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=process.env.TEST_BASE||`http://127.0.0.1:${server.address().port}/testcode/${generation}/atlas/`;report.base=base;
 const browser=await playwright.chromium.launch({headless:true,...(process.env.CHROME_CHANNEL==='chromium'?{}:{channel:'chrome'})});
 try{
 for(const ref of (process.env.TEST_REFS||'13419,9873,14926').split(',')){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),entry={ref,errors:[],failed:[],observations:[]};report.profiles.push(entry);
  await context.addInitScript(()=>Object.defineProperty(window,'maplibregl',{configurable:true,set(value){Object.defineProperty(window,'maplibregl',{configurable:true,writable:true,value});value.Map=new Proxy(value.Map,{construct(target,args,newTarget){const m=Reflect.construct(target,args,newTarget);window.__DIAGNOSTIC_MAP__=m;return m;}});}}));
  page.on('pageerror',e=>entry.errors.push(e.message));page.on('requestfailed',r=>entry.failed.push({url:r.url(),error:r.failure()}));
  const query=ref==='13419'?'repd_ref=13419&technology=wind_offshore&latitude=56.5545&longitude=-0.1183&zoom=12':ref==='9873'?'repd_ref=9873&technology=wind_offshore&latitude=56.4431397&longitude=-1.4664021&zoom=12':'repd_ref=14926&technology=solar&latitude=51.779&longitude=-1.337&zoom=12';
  await page.goto(base+'?'+query,{waitUntil:'domcontentloaded',timeout:60000});await page.bringToFront();
  await page.waitForFunction(()=>window.__DIAGNOSTIC_MAP__&&window.__GRIDATLAS_NEON_LINKS__,null,{timeout:60000});
  for(const seconds of [3,10,20]){
   await page.waitForTimeout((seconds-(entry.observations.at(-1)?.seconds||0))*1000);
   await page.screenshot({path:path.join(output,ref+'-'+seconds+'.png')});
   const observation=await page.evaluate(()=>{const m=window.__DIAGNOSTIC_MAP__,n=window.__GRIDATLAS_NEON_LINKS__;return {visible:document.visibilityState,loaded:m.isStyleLoaded(),center:m.getCenter().toArray(),zoom:m.getZoom(),sources:Object.fromEntries(['gridatlas-neon-links','gridatlas-neon-nodes','gridatlas-sld'].map(id=>[id,m.getSource(id)?._data?.features?.length??null])),card:document.querySelector('.maplibregl-popup-content')?.innerText,answer:document.querySelector('.neon-answer')?.innerText,owner:window.__GRIDATLAS_PLACE_SEARCH__?.deep_link,neon:Object.fromEntries(Object.entries(n).filter(([k,v])=>k!=='measure'&&typeof v!=='function'))};});
   entry.observations.push({seconds,...observation});save();
  }
  console.log(JSON.stringify({ref,errors:entry.errors,observations:entry.observations.map(o=>({seconds:o.seconds,visible:o.visible,loaded:o.loaded,sources:o.sources,answer:o.answer,owner:o.owner,failures:o.neon.failures}))}));await context.close();
 }
 }finally{await browser.close();}
})().catch(error=>{report.error=error.stack;process.exitCode=1;}).finally(()=>{save();server.close();});
