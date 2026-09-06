const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright');}
const base=process.argv[2],out=path.resolve(process.env.TEST_OUTPUT||'polygon-vertex-limit-artifacts');fs.mkdirSync(out,{recursive:true});const reports=[];
(async()=>{const browser=await pw.chromium.launch();
 try{for(const viewport of [{width:393,height:852},{width:1440,height:900}]){
  const phone=viewport.width<700,context=await browser.newContext({viewport,isMobile:phone,hasTouch:phone}),page=await context.newPage(),r={viewport,checks:[],errors:[]};reports.push(r);
  const check=(name,pass,detail)=>{r.checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',viewport.width,name);};page.on('pageerror',e=>r.errors.push(e.message));
  const activate=l=>phone?l.tap():l.click();
  try{
   await page.goto(base);await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__?.getSource('src-zonedraw-points'));
   await activate(page.locator('.gm-title').filter({hasText:/^Scope$/}));await activate(page.locator('#btn-zonedraw'));await page.keyboard.press('Escape');
   const points=[[1,51],[1.01,51],[1.01,51.01],...Array.from({length:4093},(_,i)=>[1.01-.01*(i+1)/4093,51.01])];
   const ring=[...points,points[0]];
   await page.locator('#zonedraw-file').setInputFiles({name:'maximum.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify({type:'Polygon',coordinates:[ring]}))});
   await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-points')._data.features.filter(f=>f.properties.kind==='vertex').length===4096&&!window.__GRIDATLAS_V9_MAP__.isMoving());
   const coords=()=>page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-line')._data.features[0]?.geometry.coordinates.slice(0,-1));
   const addCorner=async()=>{const target=await page.evaluate(()=>{const m=window.__GRIDATLAS_V9_MAP__,f=m.getSource('src-zonedraw-points')._data.features.find(f=>f.properties.kind==='mid'&&f.properties.edgeIdx===0&&f.properties.t===.5);if(!f)throw Error('Actual first-edge midpoint is not rendered');const p=m.project(f.geometry.coordinates),r=m.getCanvas().getBoundingClientRect();return{x:r.x+p.x,y:r.y+p.y,coordinates:f.geometry.coordinates};});if(phone)await page.touchscreen.tap(target.x,target.y);else await page.mouse.click(target.x,target.y);return target.coordinates;};
   const draft=await page.evaluate(()=>localStorage.getItem('gridatlas.polygon-draft.v1'));await addCorner();
   check('Clicking a midpoint at the vertex limit preserves every coordinate',JSON.stringify(await coords())===JSON.stringify(points));
   check('Maximum-size polygon keeps its assessed fill and export',await page.locator('#btn-zonedraw-export').isEnabled()&&await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-fill')._data.features.length===1));
   check('Vertex limit explains how to continue editing',(await page.locator('#zonedraw-storage-status').innerText()).includes('4096'));
   check('Refused insertion leaves the saved draft untouched',await page.evaluate(()=>localStorage.getItem('gridatlas.polygon-draft.v1'))===draft);
   await activate(page.locator('#btn-zonedraw-undo'));check('Refused insertion does not consume an Undo step',!(await coords()));
   await activate(page.locator('#btn-zonedraw-redo'));check('Redo restores the original maximum boundary',JSON.stringify(await coords())===JSON.stringify(points));
   await activate(page.locator('#zonedraw-coordinate-editor summary'));await page.locator('#zonedraw-vertex').selectOption('4095');await activate(page.locator('#btn-zonedraw-remove'));
   const reduced=await coords(),inserted=await addCorner(),expected=reduced.slice();expected.splice(1,0,inserted);
   check('Removing a corner permits one real midpoint insertion',JSON.stringify(await coords())===JSON.stringify(expected)&&expected.length===4096);
   await activate(page.locator('#btn-zonedraw-undo'));check('Undo restores the exact boundary before the permitted insertion',JSON.stringify(await coords())===JSON.stringify(reduced));
   check('Limit handling produces no script errors',r.errors.length===0,r.errors);
   await page.screenshot({path:path.join(out,viewport.width+'-limit.png')});
  }catch(e){r.error=e.stack;check('Vertex-limit review completes',false,e.message);}
  finally{await context.close();}
 }}finally{await browser.close();}
})().catch(e=>{reports.push({error:e.stack});process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,reports},null,2));if(reports.some(r=>r.error||r.checks?.some(c=>!c.pass)))process.exitCode=1;});
