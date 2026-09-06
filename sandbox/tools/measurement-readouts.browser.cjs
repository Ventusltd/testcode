const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright');}
const base=process.argv[2],out=path.resolve(process.env.TEST_OUTPUT||'measurement-readouts-artifacts');fs.mkdirSync(out,{recursive:true});const reports=[];
(async()=>{const browser=await pw.chromium.launch();try{for(const viewport of [{width:320,height:568},{width:393,height:852},{width:1440,height:900}]){
 const phone=viewport.width<700,context=await browser.newContext({viewport,isMobile:phone,hasTouch:phone}),page=await context.newPage(),r={viewport,checks:[],errors:[]};reports.push(r);
 const check=(name,pass,detail)=>{r.checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',viewport.width,name);};const activate=l=>phone?l.tap():l.click();page.on('pageerror',e=>r.errors.push(e.message));
 try{
  await page.goto(base);await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__?.getSource('src-zonedraw-line'));
  await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.jumpTo({center:[1,51],zoom:14}));
  await activate(page.locator('.gm-title').filter({hasText:/^Scope$/}));await activate(page.locator('#btn-zonedraw'));await page.keyboard.press('Escape');
  const box=await page.locator('#map canvas').boundingBox();if(phone)await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);else await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-line')._data.features.length&&!window.__GRIDATLAS_V9_MAP__.isMoving());
  const coords=()=>page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-line')._data.features[0]?.geometry.coordinates);
  const held=await coords();
  for(const label of ['Square Metres','Hectares']){
   const info=await page.locator('.measurement-dock-values span').filter({hasText:new RegExp('^'+label+'$')}).evaluate(e=>{const value=e.nextElementSibling,a=e.getBoundingClientRect(),b=value.getBoundingClientRect(),r=e.closest('#gridatlas-measurement-dock').getBoundingClientRect(),m=document.querySelector('#map canvas').getBoundingClientRect();const inside=q=>q.left>=r.left&&q.right<=r.right&&q.top>=r.top&&q.bottom<=r.bottom;const clear=q=>!(q.left<m.right&&q.right>m.left&&q.top<m.bottom&&q.bottom>m.top);return{visible:inside(a)&&inside(b),clear:clear(a)&&clear(b),label:e.textContent,value:value.textContent,scroll:e.closest('#gridatlas-measurement-dock').scrollTop};});
   check(label+' and its value are visible immediately after drawing',info.visible,info);
   check(label+' stays outside the active map canvas',info.clear,info);
  }
  await page.screenshot({path:path.join(out,viewport.width+'-fresh-measurements.png')});
  await activate(page.locator('#btn-zonedraw-reset'));check('Reset remains reachable in the controls',!(await coords()));
  await activate(page.locator('#btn-zonedraw-undo'));check('Undo after Reset restores every drawn coordinate',JSON.stringify(await coords())===JSON.stringify(held));
  const layers=page.locator('#gridatlas-dash-toggle'),collapsed=await page.evaluate(()=>window.__GRIDATLAS_DASH__.collapsed);await activate(layers);check('Original Layers control remains reachable',await page.evaluate(()=>window.__GRIDATLAS_DASH__.collapsed)!==collapsed);await activate(layers);
  check('Control use retains the outline and causes no errors',JSON.stringify(await coords())===JSON.stringify(held)&&r.errors.length===0,r.errors);
 }catch(e){r.error=e.stack;check('Readout review completes',false,e.message);}finally{await context.close();}
}}finally{await browser.close();}})().catch(e=>{reports.push({error:e.stack});process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,reports},null,2));if(reports.some(r=>r.error||r.checks?.some(c=>!c.pass)))process.exitCode=1;});
