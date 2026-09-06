const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright');}
const base=process.argv[2],out=path.resolve(process.env.TEST_OUTPUT||'app-print-artifacts');
fs.mkdirSync(out,{recursive:true});
const results=[];
(async()=>{
 const browser=await pw[process.env.TEST_ENGINE||'chromium'].launch();
 try{for(const viewport of [{width:393,height:852},{width:1440,height:900}]){
  const ratio=Number(process.env.TEST_DPR||1);
  const context=await browser.newContext({viewport,deviceScaleFactor:ratio}),page=await context.newPage();
  const receipt={viewport,checks:[],errors:[]};results.push(receipt);
  const check=(name,pass,detail)=>{receipt.checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',viewport.width,name);};
  page.on('pageerror',e=>receipt.errors.push(e.message));
  try{
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__?.getSource('src-zonedraw-points'));
   await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.jumpTo({center:[0.935,51.339],zoom:14}));
   await page.locator('.gm-title').filter({hasText:/^Scope$/}).click();
   await page.locator('#btn-zonedraw').click();
   await page.locator('#zonedraw-radius-input').fill('0.337');
   const canvas=page.locator('#map canvas.maplibregl-canvas'),box=await canvas.boundingBox();
   await canvas.click({position:{x:box.width/2,y:box.height/2}});
   await page.waitForFunction(()=>document.querySelector('.measurement-dock-values')?.textContent.includes('Hectares'));
   await page.waitForFunction(()=>!window.__GRIDATLAS_V9_MAP__.isMoving());
   receipt.visibleMeasurements=await page.locator('.measurement-dock-values').innerText();
   receipt.screenCanvas=await canvas.boundingBox();
   receipt.geometry=await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-fill')._data);
   await page.screenshot({path:path.join(out,viewport.width+'-screen.png')});
   await page.evaluate(()=>{window.__teleprint=null;document.querySelector('#codex-teleprinter').addEventListener('teleprint',event=>window.__teleprint=event.detail);});
   const downloadPromise=page.waitForEvent('download',{timeout:60000}).catch(error=>({failed:error.message}));
   const menu=page.locator('#gridatlas-menu-bar .gm-menu').filter({has:page.locator('[data-gm-export]')}).first();
   await menu.locator('.gm-title').click();
   const print=page.locator('#gridatlas-export-print');
   if(await print.count())await print.click();else await page.locator('button[data-gm-export]').filter({hasText:/Print/}).first().click();
   const download=await downloadPromise;
   if(download.failed)throw Error(download.failed+' '+await page.locator('#codex-teleprinter #status').innerText());
   await download.saveAs(path.join(out,viewport.width+'-print.pdf'));
   receipt.teleprint=await page.evaluate(()=>window.__teleprint);
   check('Actual Print downloads the app record without screen sharing',receipt.teleprint?.method==='app-render'&&receipt.teleprint?.capture?.screenSharing===false,receipt.teleprint);
   check('Print records original viewport at device resolution',receipt.teleprint?.width===viewport.width*ratio&&receipt.teleprint?.height===viewport.height*ratio);
   check('Print retains visible measurement panel after capture',await page.locator('.measurement-dock-values').isVisible());
   check('Print leaves exact polygon geometry unchanged',JSON.stringify(await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-fill')._data))===JSON.stringify(receipt.geometry));
   check('Print causes no script errors',receipt.errors.length===0,receipt.errors);
  }catch(error){receipt.error=error.stack;check('Print action completes',false,error.message);}
  finally{await context.close();}
 }}finally{await browser.close();}
})().catch(error=>{results.push({error:error.stack});process.exitCode=1;}).finally(()=>{
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,results},null,2)+'\n');
 if(results.some(r=>r.error||r.checks?.some(c=>!c.pass)))process.exitCode=1;
});
