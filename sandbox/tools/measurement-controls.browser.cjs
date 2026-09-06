const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright');}
const base=process.argv[2],out=path.resolve(process.env.TEST_OUTPUT||'measurement-controls-artifacts');fs.mkdirSync(out,{recursive:true});const reports=[];
const engine=process.env.BROWSER_ENGINE||'chromium';
if(!['chromium','firefox','webkit'].includes(engine))throw Error('Unsupported browser engine: '+engine);
(async()=>{const browser=await pw[engine].launch();
 try{for(const viewport of [{width:320,height:568},{width:393,height:852},{width:667,height:375},{width:1440,height:900}]){
  const phone=viewport.width<700,context=await browser.newContext({viewport,...(engine==='firefox'?{}:{isMobile:phone}),hasTouch:phone}),page=await context.newPage(),r={viewport,checks:[],errors:[]};reports.push(r);
  const check=(name,pass,detail)=>{r.checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',viewport.width,name);};
  page.on('pageerror',e=>r.errors.push(e.message));const activate=l=>phone?l.tap():l.click();
  try{
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__?.getSource('src-zonedraw-line')&&document.querySelector('#gridatlas-dash-toggle'));
   const scope=page.locator('.gm-title').filter({hasText:/^Scope$/}),layers=page.locator('#gridatlas-dash-toggle');
   const home=await layers.evaluate(e=>e.parentElement.tagName);await activate(scope);await activate(page.locator('#btn-zonedraw'));await page.keyboard.press('Escape');
   const ring=[[1,51],[1.01,51],[1.01,51.01],[1,51.01],[1,51]];
   await page.locator('#zonedraw-file').setInputFiles({name:'dock.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify({type:'Polygon',coordinates:[ring]}))});
   await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-fill')._data.features[0]?.geometry.coordinates[0].length===5&&!window.__GRIDATLAS_V9_MAP__.isMoving());
   const coords=()=>page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-line')._data.features[0]?.geometry.coordinates);
   const held=await coords();
   const layout=await page.evaluate(()=>{
    const button=document.querySelector('#gridatlas-dash-toggle'),rail=document.querySelector('#gridatlas-measurement-dock'),values=rail.querySelector('.measurement-dock-values'),canvas=document.querySelector('#map canvas');
    const rect=e=>{const q=e.getBoundingClientRect();return{x:q.x,y:q.y,right:q.right,bottom:q.bottom,width:q.width,height:q.height};};
    const overlap=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
    const a=rect(button);return{inRail:rail.contains(button),button:a,rail:rect(rail),canvas:rect(canvas),overlapsCanvas:overlap(a,rect(canvas)),overlapsReadouts:overlap(a,rect(values)),badge:getComputedStyle(document.querySelector('#testcode-compute-receipt')).visibility,overflow:document.documentElement.scrollWidth>innerWidth};
   });
   check('Existing Layers launcher is inside the measurement controls',layout.inRail,layout);
   check('Layers launcher does not cover the drawing or measurement values',!layout.overlapsCanvas&&!layout.overlapsReadouts,layout);
   check('Layers retains a 44 pixel target without page overflow',layout.button.height>=44&&!layout.overflow,layout);
   check('Diagnostic badge yields while measurements are open',layout.badge==='hidden');
   check('Version link yields while measurements are open',await page.locator('.testcode-identity').evaluate(e=>getComputedStyle(e).visibility==='hidden'));
   const before=await page.evaluate(()=>window.__GRIDATLAS_DASH__.collapsed);await activate(layers);
   check('The original Layers handler still changes its panel',await page.evaluate(()=>window.__GRIDATLAS_DASH__.collapsed)!==before);
   check('Opening Layers retains the exact polygon',JSON.stringify(await coords())===JSON.stringify(held));
   const panelBounds=await page.locator('.scada-wrapper').evaluate(e=>{const a=e.getBoundingClientRect(),b=document.querySelector('#gridatlas-measurement-dock').getBoundingClientRect();return{clear:!(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top),inside:a.left>=0&&a.right<=innerWidth&&a.top>=0&&a.bottom<=innerHeight};});
   check('Open Layers panel stays inside the viewport and clear of measurements',panelBounds.clear&&panelBounds.inside,panelBounds);
   const lastOption=page.locator('.scada-wrapper input[type="checkbox"]').last();await lastOption.scrollIntoViewIfNeeded();
   check('The last layer option remains reachable by scrolling its panel',await lastOption.evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;}));
   await activate(layers);await activate(scope);await activate(page.locator('#btn-zonedraw'));await page.keyboard.press('Escape');
   check('Leaving measurement returns the same Layers control to its home',await layers.evaluate((e,tag)=>e.parentElement.tagName===tag&&getComputedStyle(e).position==='fixed',home));
   check('Diagnostic badge visibility returns without changing its receipt',await page.locator('#testcode-compute-receipt').evaluate(e=>getComputedStyle(e).visibility==='visible'&&e.textContent.startsWith('TEST CODE')));
   check('Version link returns after measurement closes',await page.locator('.testcode-identity').evaluate(e=>getComputedStyle(e).visibility==='visible'));
   await activate(scope);await activate(page.locator('#btn-radius-area'));await page.keyboard.press('Escape');
   check('Circle measurements reuse the same clear Layers control',await layers.evaluate(e=>!!e.closest('#gridatlas-measurement-dock')));
   await activate(scope);await activate(page.locator('#btn-zonedraw'));await page.keyboard.press('Escape');
   check('Switching measurement modes preserves every polygon vertex',JSON.stringify(await coords())===JSON.stringify(held));
   check('There is exactly one Layers launcher after repeated moves',await layers.count()===1);
   check('Control relocation causes no script errors',r.errors.length===0,r.errors);
   await page.screenshot({path:path.join(out,viewport.width+'-clear.png')});
  }catch(e){r.error=e.stack;check('Measurement control review completes',false,e.message);await page.screenshot({path:path.join(out,viewport.width+'-failure.png')}).catch(()=>{});}
  finally{await context.close();}
 }}finally{await browser.close();}
})().catch(e=>{reports.push({error:e.stack});process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,engine,reports},null,2));if(reports.some(r=>r.error||r.checks?.some(c=>!c.pass)))process.exitCode=1;});
