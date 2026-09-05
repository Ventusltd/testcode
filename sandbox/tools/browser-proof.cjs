const fs=require('fs'),path=require('path');
const {chromium,devices}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright');
const sandbox=path.resolve(__dirname,'..'),gen=process.env.TEST_GENERATION||fs.readFileSync(path.join(sandbox,'LATEST.txt'),'utf8').trim();
const base=process.env.TEST_BASE||`http://127.0.0.1:8877/testcode/${gen}/`;
const out=process.env.TEST_OUTPUT||path.join(sandbox,gen,'evidence');fs.mkdirSync(out,{recursive:true});
const report={generation:gen,base,started:new Date().toISOString(),browser:'Installed Google Chrome',profiles:[],checks:[],limitations:['Android profile is Chrome device emulation, not a physical Android browser or WebView.','Owner performs real iPhone testing.']};
const save=()=>fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));
function check(name,ok,detail){report.checks.push({name,ok:!!ok,detail});save();console.log(`${ok?'PASS':'FAIL'} ${name}: ${JSON.stringify(detail)}`);}
async function geometry(page){return page.evaluate(()=>{const a=document.querySelector('#tbody .atlaslink');a?.closest('tr').scrollIntoView({block:'center',inline:'nearest'});const r=a?.getBoundingClientRect();const h=r?document.elementFromPoint(r.x+r.width/2,r.y+r.height/2):null;return{rows:document.querySelectorAll('#tbody tr').length,nodes:document.querySelectorAll('*').length,total:document.querySelector('#resultsMeta')?.dataset.totalCount,filtered:document.querySelector('#resultsMeta')?.dataset.filteredCount,viewport:innerWidth,map:r?{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,hit:h===a||a.contains(h),href:a.href}:null};});}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});report.browserVersion=browser.version();
try{
 for(const profile of [{name:'desktop',viewport:{width:1400,height:900}},{name:'android-touch',...devices['Pixel 7']},{name:'android-receiver-stalled',...devices['Pixel 7'],stall:true}]){
  const {name,stall,...options}=profile;console.log('START '+name);const ctx=await browser.newContext({...options,acceptDownloads:true});const page=await ctx.newPage();page.setDefaultTimeout(12000);
  const run={name,errors:[]};report.profiles.push(run);page.on('pageerror',e=>run.errors.push(e.message));
  if(stall)await ctx.route('**/deeplink/receivers.json',()=>{run.receiverIntercepted=true;});
  const started=Date.now();await page.goto(base+'pipeline/',{waitUntil:'domcontentloaded',timeout:45000});
  try{await page.waitForFunction(()=>document.querySelector('#resultsMeta')?.dataset.totalCount==='7680',null,{timeout:30000});}catch(e){run.loadError=e.message;}
  run.firstRowsMs=Date.now()-started;run.geometry=await geometry(page);
  check(name+' bounded rows',run.geometry.rows===50&&run.geometry.total==='7680',run.geometry);
  check(name+' bounded DOM',run.geometry.nodes<6000,run.geometry.nodes);
  if(name!=='desktop')check(name+' reachable MAP',run.geometry.map?.hit&&run.geometry.map.width>=48&&run.geometry.map.height>=48&&run.geometry.map.right<=run.geometry.viewport,run.geometry.map);
  if(stall)check(name+' receiver actually stalled',run.receiverIntercepted,run.receiverIntercepted);
  await page.screenshot({path:path.join(out,name+'-pipeline.png')});
  if(!stall){
   const first=await page.locator('#tbody tr').first().getAttribute('id');await page.locator('#pageNext').click();
   const second=await page.locator('#tbody tr').first().getAttribute('id');check(name+' next page changes records',first!==second,{first,second});
   await page.locator('#search').fill('8162');await page.waitForFunction(()=>document.querySelector('#resultsMeta')?.dataset.filteredCount==='1');
   check(name+' search across full corpus',await page.locator('#tbody tr').first().getAttribute('id')==='repd-8162',await page.locator('#resultsMeta').textContent());
   const link=await page.locator('#tbody .atlaslink').getAttribute('href');check(name+' MAP links paired candidate',link.includes(`/testcode/${gen}/atlas/`)&&link.includes('repd_ref=8162'),link);
   if(name==='android-touch'){const popupPromise=page.waitForEvent('popup');await page.locator('#tbody .atlaslink').tap();const popup=await popupPromise;await popup.waitForFunction(()=>window.__GRIDATLAS_ATLAS__&&window.__GRIDATLAS_V9_MAP__,null,{timeout:45000});check('mobile MAP tap opens paired Atlas',popup.url().includes('/testcode/'+gen+'/atlas/')&&popup.url().includes('repd_ref=8162')&&await popup.evaluate(()=>window.__GRIDATLAS_ATLAS__.generation)===gen,popup.url());await popup.close();}
   await page.locator('#clearFilters').click().catch(async()=>{await page.getByText('CLEAR FILTERS',{exact:true}).click();});
   await page.waitForFunction(()=>document.querySelector('#resultsMeta')?.dataset.filteredCount==='7680');
   if(name==='desktop'){
    const promise=page.waitForEvent('download');await page.getByText('EXPORT FILTERED CSV',{exact:true}).click();const dl=await promise;await dl.saveAs(path.join(out,'all-records.csv'));check('full CSV export',/7,680/.test(await page.locator('#exportMeta').textContent()),await page.locator('#exportMeta').textContent());
   }
  }
  check(name+' no script errors',run.errors.length===0,run.errors);await ctx.close();
 }
 for(const profile of [{name:'desktop',viewport:{width:1400,height:900}},{name:'android-touch',...devices['Pixel 7']}]){
  const {name,...options}=profile;console.log('START '+name+' atlas');const ctx=await browser.newContext({...options,acceptDownloads:true});const page=await ctx.newPage();page.setDefaultTimeout(15000);
  const run={name:name+'-atlas',errors:[]};report.profiles.push(run);page.on('pageerror',e=>run.errors.push(e.message));
  await page.goto(base+'atlas/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__&&document.querySelector('[data-gm-export]'),null,{timeout:45000});
  await page.waitForFunction(()=>document.querySelector('.maplibregl-canvas')?.width>0);await page.waitForTimeout(1500);
  run.search=await page.locator('.search-bar-wrapper').evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,visible:r.width>0&&r.height>0,menu:!!el.closest('.gm-panel')};});
  check(name+' persistent search',run.search.visible&&!run.search.menu&&run.search.y>=0,run.search);
  check(name+' composed candidate generation',await page.evaluate(()=>window.__GRIDATLAS_ATLAS__.generation)===gen,await page.evaluate(()=>window.__GRIDATLAS_ATLAS__.generation));
  await page.screenshot({path:path.join(out,name+'-atlas.png')});
  const file=page.locator('.gm-title').filter({hasText:/^File$/i}).first();await file.click();
  const imageButton=page.locator('[data-gm-export]').nth(1);const downloadPromise=page.waitForEvent('download',{timeout:15000});await imageButton.click();const download=await downloadPromise;await download.saveAs(path.join(out,name+'-map.png'));
  check(name+' image download exists',fs.statSync(path.join(out,name+'-map.png')).size>5000,fs.statSync(path.join(out,name+'-map.png')).size);
  await page.evaluate(()=>{window.__proofPrinted=0;window.print=()=>{window.__proofPrinted++;};});
  const print=page.locator('[data-gm-export]').first();if(!await print.isVisible())await file.click();await print.click();
  await page.waitForFunction(()=>window.__proofPrinted>0&&document.querySelector('.gpf-map')?.naturalWidth>0);
  check(name+' print carries generation',(await page.locator('.gpf-stamp').textContent()).includes(gen),await page.locator('.gpf-stamp').textContent());
  await page.emulateMedia({media:'print'});const cdp=await ctx.newCDPSession(page);run.pdf=[];
  for(const landscape of [false,true]){
   if(landscape){
    await page.emulateMedia({media:'screen'});
    if(!await print.isVisible())await file.click();
    await page.evaluate(()=>{window.__proofPrinted=0;});await print.click();
    await page.waitForFunction(()=>window.__proofPrinted>0&&document.querySelector('.gpf-map')?.naturalWidth>0);
    await page.emulateMedia({media:'print'});
   }
   await page.screenshot({path:path.join(out,name+(landscape?'-landscape-print':'-portrait-print')+'.png')});
   const {data}=await cdp.send('Page.printToPDF',{printBackground:true,paperWidth:8.27,paperHeight:11.69,landscape,preferCSSPageSize:false});const bytes=Buffer.from(data,'base64'),text=bytes.toString('latin1');
   const facts={landscape,bytes:bytes.length,images:(text.match(/\/Subtype\s*\/Image/g)||[]).length,pages:(text.match(/\/Type\s*\/Page[^s]/g)||[]).length};run.pdf.push(facts);
   fs.writeFileSync(path.join(out,name+(landscape?'-landscape':'-portrait')+'.pdf'),bytes);check(name+' print '+(landscape?'landscape':'portrait'),facts.images>0&&facts.pages===1,facts);
  }
  await page.screenshot({path:path.join(out,name+'-print.png')});
  check(name+' Atlas no script errors',run.errors.length===0,run.errors);await ctx.close();
 }
}catch(e){report.error=e.stack;check('harness completed',false,e.message);}finally{await browser.close();report.finished=new Date().toISOString();save();}
process.exitCode=report.checks.some(x=>!x.ok)||report.error?1:0;
})();
