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
const output = path.resolve(process.env.TEST_OUTPUT || 'poly-zone-artifacts');
fs.mkdirSync(output, {recursive:true});
const report = {generation, profiles:[], sourceMode:'Actual composed files; no request interception or source substitution', limitations:['Chrome phone emulation is not physical-device evidence.','Polygon coordinates and rendered labels are checked independently.']};
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
  const base=process.env.TEST_BASE||`http://127.0.0.1:${server.address().port}/testcode/${generation}/atlas/`;
  report.base=base;
  const browser=await playwright.chromium.launch({headless:true,...(process.env.CHROME_CHANNEL==='chromium'?{}:{channel:process.env.CHROME_CHANNEL||'chrome'})});
  report.browser=browser.version();
  try {
    for(const profile of [{name:'desktop',viewport:{width:1440,height:900}},{name:'phone',viewport:{width:393,height:852},isMobile:true,hasTouch:true}]) {
      const {name,...options}=profile,context=await browser.newContext(options);
      const result={name,errors:[],checks:[]};report.profiles.push(result);
      const check=(label,pass,detail)=>{result.checks.push({name:label,pass:!!pass,detail});save();console.log(name,pass?'PASS':'FAIL',label);};
      try {
        await context.addInitScript(()=>{
          Object.defineProperty(window,'maplibregl',{configurable:true,set(value){
            Object.defineProperty(window,'maplibregl',{configurable:true,writable:true,value});
            value.Map=new Proxy(value.Map,{construct(target,args,newTarget){const map=Reflect.construct(target,args,newTarget);window.__POLY_TEST_MAP__=map;return map;}});
          }});
        });
        const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
        await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
        await page.waitForFunction(()=>window.__POLY_TEST_MAP__?.getSource('src-zonedraw-points')&&document.querySelector('#gridatlas-menu-bar .gm-title'),null,{timeout:60000});
        await page.evaluate(()=>window.__POLY_TEST_MAP__.jumpTo({center:[0.935,51.339],zoom:14}));
        const scope=page.locator('.gm-title').filter({hasText:/^Scope$/});
        await scope.click();await page.locator('#btn-zonedraw').click();
        await page.locator('#zonedraw-radius-input').fill('0.337');
        const canvas=page.locator('#map canvas.maplibregl-canvas');
        await canvas.click({position:{x:(await canvas.boundingBox()).width/2,y:(await canvas.boundingBox()).height/2}});
        await page.waitForFunction(()=>document.querySelector('.measurement-dock-values')?.textContent.includes('Hectares'),null,{timeout:30000});
        await page.waitForFunction(()=>!window.__POLY_TEST_MAP__.isMoving());
        const coordinates=()=>page.evaluate(()=>window.__POLY_TEST_MAP__.getSource('src-zonedraw-fill')._data.features[0]?.geometry.coordinates);
        const before=await coordinates();
        const separated=()=>page.evaluate(()=>{
          const a=document.querySelector('#map canvas').getBoundingClientRect(),b=document.querySelector('#gridatlas-measurement-dock').getBoundingClientRect();
          return {clear:a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1,canvas:{x:a.x,y:a.y,width:a.width,height:a.height},panel:{x:b.x,y:b.y,width:b.width,height:b.height},noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth};
        });
        const boxes=await separated();check('labels occupy a separate area from drawing canvas',boxes.clear,boxes);check('no page width overflow',boxes.noHorizontalOverflow);
        check('polygon drawn with 24 editable vertices',before?.[0]?.length===25);
        await page.screenshot({path:path.join(output,name+'-labels.png')});
        await page.locator('#gridatlas-measurement-dock [title="Collapse"]').click();
        check('collapsing labels preserves exact geometry',JSON.stringify(await coordinates())===JSON.stringify(before));
        await page.locator('.measurement-dock-values>div').click();
        check('expanding labels preserves exact geometry',JSON.stringify(await coordinates())===JSON.stringify(before));
        const vertex=await page.evaluate(()=>{
          const map=window.__POLY_TEST_MAP__,f=map.getSource('src-zonedraw-points')._data.features.find(f=>f.properties.kind==='vertex');
          const p=map.project(f.geometry.coordinates),r=map.getCanvas().getBoundingClientRect();return{x:p.x+r.left,y:p.y+r.top};
        });
        await page.mouse.move(vertex.x,vertex.y);await page.mouse.down();await page.mouse.move(vertex.x+24,vertex.y+16,{steps:5});await page.mouse.up();
        const afterDrag=await coordinates();check('corner drag edits the existing polygon',JSON.stringify(afterDrag)!==JSON.stringify(before)&&afterDrag[0].length===25);
        if(process.env.TEST_HISTORY==='1') {
          await page.locator('#btn-zonedraw-undo').click();
          check('Undo restores the whole outline before the drag',JSON.stringify(await coordinates())===JSON.stringify(before));
          await page.locator('#btn-zonedraw-redo').click();
          check('Redo restores the exact edited outline',JSON.stringify(await coordinates())===JSON.stringify(afterDrag));
          await page.locator('#btn-zonedraw-reset').click();
          await page.locator('#btn-zonedraw-undo').click();
          check('Undo recovers a deliberately reset polygon',JSON.stringify(await coordinates())===JSON.stringify(afterDrag));
          await page.locator('#btn-zonedraw-redo').click();
          check('Redo can repeat the reset',!(await coordinates()));
          await page.locator('#btn-zonedraw-undo').click();
        }
        if(process.env.TEST_LOCK==='1') {
          const held=await coordinates();
          const point=await page.evaluate(()=>{const m=window.__POLY_TEST_MAP__,p=m.project(m.getSource('src-zonedraw-fill')._data.features[0].geometry.coordinates[0][0]),r=m.getCanvas().getBoundingClientRect();return{x:p.x+r.left,y:p.y+r.top};});
          await page.locator('#btn-zonedraw-lock').click();
          check('lock hides vertex edit handles',await page.evaluate(()=>window.__POLY_TEST_MAP__.getSource('src-zonedraw-points')._data.features.length===0));
          const center=await page.evaluate(()=>window.__POLY_TEST_MAP__.getCenter().toArray());
          await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+35,point.y+20,{steps:5});await page.mouse.up();
          check('locked vertex drag leaves every coordinate intact',JSON.stringify(await coordinates())===JSON.stringify(held));
          check('locked polygon still allows map pan',JSON.stringify(await page.evaluate(()=>window.__POLY_TEST_MAP__.getCenter().toArray()))!==JSON.stringify(center));
          await page.locator('#btn-zonedraw-lock').click();
          check('unlock restores editable corner handles',await page.evaluate(()=>window.__POLY_TEST_MAP__.getSource('src-zonedraw-points')._data.features.some(f=>f.properties.kind==='vertex')));
        }
        if(process.env.TEST_RESET==='1') {
          const r=await canvas.boundingBox();await canvas.click({position:{x:r.width*.1,y:r.height*.75}});
          check('ordinary map click keeps edited polygon',JSON.stringify(await coordinates())===JSON.stringify(afterDrag));
          await page.locator('#btn-zonedraw-reset').click();
          check('explicit reset clears only the polygon',!(await coordinates()));
          await canvas.click({position:{x:r.width*.6,y:r.height*.5}});
          await page.waitForFunction(()=>window.__POLY_TEST_MAP__.getSource('src-zonedraw-fill')._data.features.length===1);
          check('new circle starts only after explicit reset',(await coordinates())[0].length===25);
        }
        await scope.click();await page.locator('#btn-radius-area').click();
        if(process.env.TEST_RESET==='1')check('changing tools preserves the drawn polygon',(await coordinates())?.[0]?.length===25);
        const areaCanvas=await canvas.boundingBox();await canvas.click({position:{x:areaCanvas.width/2,y:areaCanvas.height/2}});
        await page.waitForFunction(()=>document.querySelector('.measurement-dock-values')?.textContent.includes('Hectares'),null,{timeout:15000});
        check('circle measurements stay outside canvas',(await separated()).clear);
        const circle=await page.evaluate(()=>window.__POLY_TEST_MAP__.getSource('src-radius-area')._data.features);
        check('circle remains mapped',circle.length===1);
        await page.screenshot({path:path.join(output,name+'-circle.png')});
        await scope.click();await page.locator('#btn-radius-area').click();
        check('leaving measurement mode restores map layout',await page.locator('#gridatlas-measurement-dock').count()===0);
        if(process.env.TEST_RESET==='1') {
          const held=await coordinates();await scope.click();await page.locator('#btn-zonedraw').click();
          check('returning to Poly Zone restores its exact outline',JSON.stringify(await coordinates())===JSON.stringify(held));
        }
        if(process.env.TEST_EXPORT==='1') {
          const held=await coordinates();
          const pending=page.waitForEvent('download');await page.locator('#btn-zonedraw-export').click();
          const download=await pending;const file=path.join(output,name+'-polygon.geojson');await download.saveAs(file);
          const data=JSON.parse(fs.readFileSync(file,'utf8')),feature=data.features?.[0],ring=feature?.geometry?.coordinates?.[0];
          check('download is a single attributed GeoJSON polygon',data.type==='FeatureCollection'&&data.features.length===1&&feature.geometry.type==='Polygon'&&feature.properties.source==='User-drawn outline');
          check('download preserves every edited vertex and closes the ring',ring?.length===held[0].length&&JSON.stringify(ring[0])===JSON.stringify(ring.at(-1))&&ring.every(p=>held[0].some(q=>JSON.stringify(p)===JSON.stringify(q))));
          check('download contains positive area and perimeter in named units',feature.properties.area_m2>0&&feature.properties.perimeter_km>0);
          check('export leaves the working polygon untouched',JSON.stringify(await coordinates())===JSON.stringify(held));
        }
        if(process.env.TEST_IMPORT==='1') {
          const file=path.join(output,name+'-polygon.geojson');
          const saved=JSON.parse(fs.readFileSync(file,'utf8')).features[0].geometry.coordinates;
          await page.locator('#btn-zonedraw-reset').click();
          await page.locator('#zonedraw-file').setInputFiles(file);
          await page.waitForFunction(()=>document.querySelector('#zonedraw-storage-status')?.textContent.startsWith('Opened'));
          check('opening the downloaded file restores its exact ring',JSON.stringify(await coordinates())===JSON.stringify(saved));
          const held=await coordinates();
          await page.locator('#zonedraw-file').setInputFiles({name:'broken.geojson',mimeType:'application/geo+json',buffer:Buffer.from('{broken')});
          await page.waitForFunction(()=>document.querySelector('#zonedraw-storage-status')?.textContent.includes('not valid JSON'));
          check('invalid import keeps the entire existing outline',JSON.stringify(await coordinates())===JSON.stringify(held));
          const chooser=page.waitForEvent('filechooser');await page.locator('#btn-zonedraw-import').click();
          check('Open GeoJSON launches the native file chooser',!!(await chooser));
        }
        if(process.env.TEST_DRAFT==='1') {
          const held=await coordinates();
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.__POLY_TEST_MAP__?.getSource('src-zonedraw-points')&&document.querySelector('#gridatlas-menu-bar .gm-title'),null,{timeout:60000});
          await scope.click();await page.locator('#btn-zonedraw').click();
          check('reload restores every edited coordinate',JSON.stringify(await coordinates())===JSON.stringify(held));
          check('restoration is disclosed in controls',(await page.locator('#zonedraw-storage-status').innerText()).includes('Restored'));
          await page.locator('#btn-zonedraw-reset').click();
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.__POLY_TEST_MAP__?.getSource('src-zonedraw-points')&&document.querySelector('#gridatlas-menu-bar .gm-title'),null,{timeout:60000});
          await scope.click();await page.locator('#btn-zonedraw').click();
          check('reset remains cleared after reload',!(await coordinates()));
          await page.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('Test storage denied');};});
          const r=await canvas.boundingBox();await canvas.click({position:{x:r.width/2,y:r.height/2}});
          check('storage denial keeps drawn geometry',(await coordinates())?.[0]?.length===25);
          check('storage denial has an honest status',(await page.locator('#zonedraw-storage-status').innerText()).includes('unavailable'));
        }
        check('no uncaught script errors',result.errors.length===0,result.errors);
        result.pass=result.checks.every(c=>c.pass);
      }catch(error){result.error=error.stack;result.pass=false;console.log(name,error.message);}
      finally{await context.close();save();}
    }
  }finally{await browser.close();}
})().catch(error=>{report.error=error.stack;process.exitCode=1;}).finally(()=>{
  report.finishedUTC=new Date().toISOString();save();server.close();
  if(report.profiles.length!==2||report.profiles.some(p=>!p.pass))process.exitCode=1;
});
