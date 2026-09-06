const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright');}
const base=process.argv[2],out=path.resolve(process.env.TEST_OUTPUT||'polygon-remove-artifacts');fs.mkdirSync(out,{recursive:true});const reports=[];
(async()=>{const browser=await pw.chromium.launch();
 try{for(const viewport of [{width:393,height:852},{width:1440,height:900}]){
  const phone=viewport.width<700,context=await browser.newContext({viewport,isMobile:phone,hasTouch:phone}),page=await context.newPage(),r={viewport,checks:[],errors:[]};reports.push(r);
  const check=(name,pass,detail)=>{r.checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',viewport.width,name);};
  page.on('pageerror',e=>r.errors.push(e.message));
  const activate=locator=>phone?locator.tap():locator.click();
  try{
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__?.getSource('src-zonedraw-line'));
   await activate(page.locator('.gm-title').filter({hasText:/^Scope$/}));await activate(page.locator('#btn-zonedraw'));
   const ring=[[1,51],[1.01,51],[1.01,51.01],[1,51.01],[1,51]];
   const input=points=>page.locator('#zonedraw-file').setInputFiles({name:'vertices.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify({type:'Polygon',coordinates:[points]}))});
   const coords=()=>page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-line')._data.features[0]?.geometry.coordinates.slice(0,-1));
   await input(ring);await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-line')._data.features[0]?.geometry.coordinates.length===5);
   await activate(page.locator('#zonedraw-coordinate-editor summary'));
   const remove=page.getByRole('button',{name:'Remove selected vertex',exact:true});await remove.waitFor({state:'visible',timeout:10000});
   const original=await coords();await page.locator('#zonedraw-vertex').selectOption('1');await activate(remove);
   const expected=original.filter((_,i)=>i!==1);check('Removal changes only the selected vertex',JSON.stringify(await coords())===JSON.stringify(expected));
   check('A triangle cannot lose another vertex',await remove.isDisabled());
   await activate(page.locator('#btn-zonedraw-undo'));check('Undo restores the exact four-vertex outline',JSON.stringify(await coords())===JSON.stringify(original));
   await activate(page.locator('#btn-zonedraw-redo'));check('Redo repeats the exact removal',JSON.stringify(await coords())===JSON.stringify(expected));
   await activate(page.locator('#btn-zonedraw-undo'));await activate(page.locator('#btn-zonedraw-lock'));check('Locked outline disables vertex removal',await remove.isDisabled());
   await activate(page.locator('#btn-zonedraw-lock'));await page.locator('#zonedraw-vertex').selectOption('3');await activate(remove);
   check('Removing the last vertex keeps its neighbours unchanged',JSON.stringify(await coords())===JSON.stringify(original.slice(0,3)));
   check('Vertex selection remains in range after removal',(await page.locator('#zonedraw-vertex').inputValue())==='2');
   const repeated=[ring[0],ring[1],ring[1],ring[2],ring[3],ring[0]];await input(repeated);
   await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-line')._data.features[0]?.geometry.coordinates.length===6);
   check('Coincident vertex preserves the invalid boundary for repair',await page.locator('#btn-zonedraw-export').isDisabled());
   await page.locator('#zonedraw-vertex').selectOption('2');await activate(remove);
   check('Removing the duplicate repairs the exact original boundary',JSON.stringify(await coords())===JSON.stringify(original));
   check('Repair restores assessed area and GeoJSON export',await page.locator('#btn-zonedraw-export').isEnabled()&&await page.locator('#zonedraw-validity-warning').count()===0);
   await activate(page.locator('#btn-zonedraw-undo'));check('Undo can restore the invalid boundary without discarding it',JSON.stringify(await coords())===JSON.stringify(repeated.slice(0,-1))&&await page.locator('#btn-zonedraw-export').isDisabled());
   await activate(page.locator('#btn-zonedraw-redo'));await page.reload();await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__?.getSource('src-zonedraw-line')&&document.querySelector('#btn-zonedraw'));
   await activate(page.locator('.gm-title').filter({hasText:/^Scope$/}));await activate(page.locator('#btn-zonedraw'));
   check('Reload retains the repaired outline exactly',JSON.stringify(await coords())===JSON.stringify(original));
   check('Removal causes no script errors',r.errors.length===0,r.errors);
   await page.screenshot({path:path.join(out,viewport.width+'-repaired.png')});
  }catch(e){r.error=e.stack;check('Vertex removal completes',false,e.message);await page.screenshot({path:path.join(out,viewport.width+'-failure.png')}).catch(()=>{});}
  finally{await context.close();}
 }}finally{await browser.close();}
})().catch(e=>{reports.push({error:e.stack});process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,reports},null,2));if(reports.some(r=>r.error||r.checks?.some(c=>!c.pass)))process.exitCode=1;});
