const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright');}
const base=process.argv[2],out=path.resolve(process.env.TEST_OUTPUT||'polygon-boundaries-artifacts');fs.mkdirSync(out,{recursive:true});
const reports=[];
(async()=>{const browser=await pw.chromium.launch();
 try{for(const viewport of [{width:393,height:852},{width:1440,height:900}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),report={viewport,checks:[],errors:[]};reports.push(report);
  const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',viewport.width,name);};
  page.on('pageerror',error=>report.errors.push(error.message));
  try{
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__?.getSource('src-zonedraw-points'));
   await page.locator('.gm-title').filter({hasText:/^Scope$/}).click();await page.locator('#btn-zonedraw').click();
   const coords=()=>page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-fill')._data.features[0]?.geometry.coordinates[0]);
   const input=ring=>page.locator('#zonedraw-file').setInputFiles({name:'boundary.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify({type:'Polygon',coordinates:[ring]}))});
   const rectangle=[[1,51],[1.01,51],[1.01,51.01],[1,51.01],[1,51]];await input(rectangle);
   await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-fill')._data.features.length===1);
   const pending=page.waitForEvent('download');await page.locator('#btn-zonedraw-export').click();const download=await pending,file=path.join(out,viewport.width+'-rectangle.geojson');await download.saveAs(file);
   const feature=JSON.parse(fs.readFileSync(file,'utf8')).features[0],R=6378.137,rad=Math.PI/180;
   const area=R*R*(rectangle[1][0]-rectangle[0][0])*rad*(Math.sin(51.01*rad)-Math.sin(51*rad))*1e6;
   // Independent central angle from 3D unit-vector cross/dot, not haversine.
   const vector=([x,y])=>[Math.cos(y*rad)*Math.cos(x*rad),Math.cos(y*rad)*Math.sin(x*rad),Math.sin(y*rad)];
   const distance=(a,b)=>{a=vector(a);b=vector(b);const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];return R*Math.atan2(Math.hypot(...cross),a.reduce((s,v,i)=>s+v*b[i],0));};
   const perimeter=rectangle.slice(0,-1).reduce((sum,p,i)=>sum+distance(p,rectangle[i+1]),0);
   check('Downloaded spherical rectangle area matches independent strip integral',Math.abs(feature.properties.area_m2-area)<area*1e-8,{actual:feature.properties.area_m2,expected:area});
   check('Downloaded hectares retain exact metric conversion',feature.properties.area_ha===feature.properties.area_m2/10000);
   check('Downloaded perimeter matches independent vector central angles',Math.abs(feature.properties.perimeter_km-perimeter)<1e-8,{actual:feature.properties.perimeter_km,expected:perimeter});
   const ring=Array.from({length:4096},(_,i)=>[1+.01*Math.cos(2*Math.PI*i/4096),51+.01*Math.sin(2*Math.PI*i/4096)]);ring.push(ring[0].slice());
   const start=Date.now();await input(ring);await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-zonedraw-fill')._data.features[0]?.geometry.coordinates[0].length===4097);
   await page.waitForFunction(()=>!window.__GRIDATLAS_V9_MAP__.isMoving()&&window.__GRIDATLAS_V9_MAP__.isSourceLoaded('src-zonedraw-fill'));
   report.maximumImportMilliseconds=Date.now()-start;
   check('Maximum4096 vertices survive the actual import and map render',JSON.stringify(await coords())===JSON.stringify(ring),{milliseconds:report.maximumImportMilliseconds});
   await page.setViewportSize({width:viewport.height,height:viewport.width});
   await page.locator('#btn-zonedraw-fit').click();await page.waitForFunction(()=>!window.__GRIDATLAS_V9_MAP__.isMoving());
   check('Orientation change and Fit retain all4096 vertices',JSON.stringify(await coords())===JSON.stringify(ring));
   const tooMany=ring.slice(0,-1);tooMany.push([1.02,51.02]);tooMany.push(tooMany[0]);await input(tooMany);
   check('4097-vertex input is rejected without replacing the working polygon',JSON.stringify(await coords())===JSON.stringify(ring)&&(await page.locator('#zonedraw-storage-status').innerText()).includes('4096'));
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__?.getSource('src-zonedraw-points'));
   await page.locator('.gm-title').filter({hasText:/^Scope$/}).click();await page.locator('#btn-zonedraw').click();
   check('Reload restores the complete maximum-sized draft',JSON.stringify(await coords())===JSON.stringify(ring));
   check('Boundary cases cause no script errors',report.errors.length===0,report.errors);
  }catch(error){report.error=error.stack;check('Boundary review completes',false,error.message);}
  finally{await context.close();}
 }}finally{await browser.close();}
})().catch(error=>{reports.push({error:error.stack});process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,reports},null,2)+'\n');if(reports.some(r=>r.error||r.checks?.some(c=>!c.pass)))process.exitCode=1;});
