const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright');}
const base=process.argv[2],out=path.resolve(process.env.TEST_OUTPUT||'tool-recovery-artifacts');fs.mkdirSync(out,{recursive:true});const reports=[];
(async()=>{const browser=await pw.chromium.launch();
 try{for(const viewport of [{width:393,height:852},{width:1440,height:900}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),report={viewport,checks:[],errors:[]};reports.push(report);
  const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',viewport.width,name);};
  page.on('pageerror',error=>report.errors.push(error.message));
  let attempts=0;
  await page.route('**/layer-apps/solar-bess-topology-v7/cable-geometry-visualiser/index.html',async route=>{
   attempts++;if(attempts===1)await route.fulfill({status:503,contentType:'text/html',body:'<!doctype html><title>Temporary fixture outage</title><p>Tool unavailable in this deliberate negative fixture.</p>'});else await route.continue();
  });
  try{
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__?.getSource('src-zonedraw-points'));
   const scope=page.locator('.gm-title').filter({hasText:/^Scope$/});await scope.click();await page.locator('#btn-zonedraw').click();
   const canvas=page.locator('#map canvas.maplibregl-canvas'),box=await canvas.boundingBox();await canvas.click({position:{x:box.width/2,y:box.height/2}});
   const coordinates=()=>page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-fill')._data.features[0]?.geometry.coordinates);
   const held=await coordinates();await scope.click();await page.locator('#btn-zonedraw').click();
   const launch=page.getByRole('button',{name:'Cable Geometry',exact:true});await launch.click();
   const layer=page.getByRole('dialog',{name:'Cable Geometry',exact:true});
   const retry=layer.getByRole('button',{name:'Retry tool loading',exact:true});
   await retry.waitFor({state:'attached',timeout:15000});
   check('Unavailable tool exposes its own recovery control',await retry.count()===1);
   if(!(await retry.count()))throw Error('The carried host has no recovery control');
   await retry.waitFor({state:'visible'});check('Failed tool is not reported as ready',await layer.locator('[data-tool-readiness]').getAttribute('data-interface')==='unrecognised');
   check('Failed iframe leaves Atlas polygon unchanged',JSON.stringify(await coordinates())===JSON.stringify(held));
   await retry.click();await layer.getByRole('button',{name:'Keep working',exact:true}).click();check('Cancel retry does not reload the tool',attempts===1);
   await retry.click();await layer.getByRole('button',{name:'Confirm restart',exact:true}).click();
   await layer.locator('[data-drawing="ready"]').waitFor();check('Confirmed retry loads the actual original tool',attempts===2);
   const frame=page.frameLocator('iframe[title="Cable Geometry"]');await frame.locator('#route_name').fill('Retained separate tool state');await frame.locator('#route_name').press('Tab');
   await layer.getByRole('button',{name:'Close - return to GridAtlas',exact:true}).click();
   check('Closing the recovered tool restores launcher focus',await launch.evaluate(e=>e===document.activeElement));
   await launch.click();check('Reopening preserves the same iframe and its edited input',await page.locator('iframe[title="Cable Geometry"]').count()===1&&(await frame.locator('#route_name').inputValue())==='Retained separate tool state');
   await frame.locator('#route_name').focus();await page.keyboard.press('Escape');check('Escape inside the original tool returns to Atlas',!(await layer.isVisible()));
   await scope.click();await page.locator('#btn-zonedraw').click();check('Returning to Poly Zone retains every original vertex',JSON.stringify(await coordinates())===JSON.stringify(held));
   check('Recovery produces no uncaught script errors',report.errors.length===0,report.errors);
   await page.screenshot({path:path.join(out,viewport.width+'-recovered.png')});
  }catch(error){report.error=error.stack;await page.screenshot({path:path.join(out,viewport.width+'-failure.png')}).catch(()=>{});check('Tool recovery completes',false,error.message);}
  finally{report.attempts=attempts;await context.close();}
 }}finally{await browser.close();}
})().catch(error=>{reports.push({error:error.stack});process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,fixture:'First Cable iframe request returns explicit HTTP503; retry loads actual original files',reports},null,2)+'\n');if(reports.some(r=>r.error||r.checks?.some(c=>!c.pass)))process.exitCode=1;});
