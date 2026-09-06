const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright');}
const base=process.argv[2],out=path.resolve(process.env.TEST_OUTPUT||'composition-contract-artifacts');fs.mkdirSync(out,{recursive:true});const checks=[];
const record=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',name);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,checks},null,2));};
(async()=>{const current=await(await fetch(new URL('current.json',base))).json();
 const cases=current.cartridge_order.map(id=>({name:'missing-'+id,mutate:c=>{c.cartridge_order=c.cartridge_order.filter(x=>x!==id);c.cartridges=c.cartridges.filter(x=>x.id!==id);}}));
 cases.push({name:'duplicate-registry',mutate:c=>c.cartridges.push(c.cartridges[0])},{name:'duplicate-order',mutate:c=>c.cartridge_order.push(c.cartridge_order[0])},{name:'order-omission',mutate:c=>c.cartridge_order.pop()},{name:'empty-composition',mutate:c=>{c.cartridges=[];c.cartridge_order=[];}});
 const browser=await pw.chromium.launch();
 try{for(const fixture of cases){const page=await browser.newPage({viewport:{width:393,height:852}});let shellRequests=0;try{
  const altered=structuredClone(current);fixture.mutate(altered);
  await page.route(new URL('current.json',base).href,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(altered)}));
  await page.route(current.shell.index,route=>{shellRequests++;return route.continue();});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.dataset.gridatlasRouter==='failed'||window.__GRIDATLAS_ATLAS__,null,{timeout:30000});
  const state=await page.evaluate(()=>({failed:document.body.dataset.gridatlasRouter==='failed',message:document.body.innerText,composed:!!window.__GRIDATLAS_ATLAS__}));
  record(fixture.name+' refuses the incomplete composition before loading any shell',state.failed&&!state.composed&&shellRequests===0,{...state,shellRequests});
  await page.screenshot({path:path.join(out,fixture.name+'.png')});
 }finally{await page.close();}}
 // An actual saved outline must survive a temporarily bad composition response.
 const page=await browser.newPage({viewport:{width:393,height:852}});
 try{
  await page.goto(base);await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__?.getSource('src-zonedraw-line'));
  const scope=page.locator('.gm-title').filter({hasText:/^Scope$/});await scope.click();await page.locator('#btn-zonedraw').click();
  const ring=[[1,51],[1.01,51],[1.01,51.01],[1,51.01],[1,51]];
  await page.locator('#zonedraw-file').setInputFiles({name:'retained.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify({type:'Polygon',coordinates:[ring]}))});
  await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-line')._data.features[0]?.geometry.coordinates.length===5);
  const saved=await page.evaluate(()=>localStorage.getItem('gridatlas.polygon-draft.v1'));
  record('Valid composition saves the actual imported outline',JSON.stringify(JSON.parse(saved).points)===JSON.stringify(ring.slice(0,-1)));
  const routeUrl=new URL('current.json',base).href,altered=structuredClone(current);altered.cartridges=[];altered.cartridge_order=[];
  await page.route(routeUrl,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(altered)}));
  await page.reload();await page.waitForFunction(()=>document.body.dataset.gridatlasRouter==='failed'||window.__GRIDATLAS_ATLAS__);
  record('Composition failure preserves the exact saved draft',await page.evaluate(()=>document.body.dataset.gridatlasRouter==='failed')&&await page.evaluate(()=>localStorage.getItem('gridatlas.polygon-draft.v1'))===saved);
  await page.unroute(routeUrl);await page.reload();await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__?.getSource('src-zonedraw-line'));
  await scope.click();await page.locator('#btn-zonedraw').click();
  const restored=await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-line')._data.features[0]?.geometry.coordinates);
  record('Restoring the valid composition recovers every polygon vertex',JSON.stringify(restored)===JSON.stringify(ring));
 }finally{await page.close();}
 }finally{await browser.close();}
})().catch(e=>{record('Contract review completes',false,e.stack);process.exitCode=1;}).finally(()=>{if(checks.some(c=>!c.pass))process.exitCode=1;});
