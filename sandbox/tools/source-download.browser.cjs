const fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright');}
const base=process.argv[2],out=path.resolve(process.env.TEST_OUTPUT||'source-download-artifacts');
const generation=new URL(base).pathname.match(/^\/testcode\/(\d{12})\/atlas\/$/)?.[1];
if(!generation)throw Error('Pass an immutable TestCode Atlas URL');
const root=path.resolve(__dirname,'../..'),sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const blob=p=>execFileSync('git',['show',sourceCommit+':'+p],{cwd:root,maxBuffer:64*1024*1024});
fs.mkdirSync(out,{recursive:true});
const results=[];
(async()=>{
 const browser=await pw[process.env.TEST_ENGINE||'chromium'].launch();
 try{for(const viewport of [{width:393,height:852}]){
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
   const menu=page.locator('#gridatlas-menu-bar .gm-menu').filter({has:page.locator('[data-gm-export]')}).first();
   await menu.locator('.gm-title').click();
   const pending=page.waitForEvent('download',{timeout:240000}).catch(error=>({failed:error.message}));
   await page.locator('[data-codex-print-source]').click();
   const download=await pending;if(download.failed)throw Error(download.failed+' '+await page.locator('#codex-teleprinter #status').innerText());
   const filename=path.join(out,'atlas-runtime-source.txt');await download.saveAs(filename);
   const bytes=fs.readFileSync(filename),text=bytes.toString('utf8');
   const manifest=JSON.parse(text.split('===== BEGIN DIAGNOSTIC MANIFEST =====\n')[1].split('\n===== END DIAGNOSTIC MANIFEST =====')[0]);
   receipt.manifest={complete:manifest.complete,observedResourcesComplete:manifest.observedResourcesComplete,counts:manifest.counts,failures:manifest.failures,discoveryWarnings:manifest.discoveryWarnings};
   check('Source download honestly declares browser discovery incomplete',manifest.complete===false&&text.includes('Completeness: INCOMPLETE'));
   check('Source download records current release URL',manifest.state.url===base);
   check('Source download retains exact drawn polygon',JSON.stringify(manifest.state.map.sources['src-zonedraw-fill'].data)===JSON.stringify(receipt.geometry));
   let verified=0;const headers=[...text.matchAll(/===== BEGIN RESOURCE ("[^\n]+?") \| originalBytes=(\d+) \| encoding=([^ ]+) \| sha256=([a-f0-9]+) =====\n/g)];
   for(const match of headers){const end=text.indexOf('\n===== END RESOURCE '+match[1]+' =====',match.index+match[0].length);if(end<0)throw Error('Missing resource boundary');const value=text.slice(match.index+match[0].length,end),body=Buffer.from(value,match[3]==='base64'?'base64':'utf8');if(body.length!==Number(match[2])||hash(body)!==match[4])throw Error('Resource hash mismatch '+match[1]);verified++;}
   check('Every downloaded resource body matches its own full byte hash',verified===manifest.counts.included,{verified});
   const current=JSON.parse(blob('sandbox/'+generation+'/atlas/current.json'));
   const cartridge=current.cartridges.find(c=>c.id==='substation-intelligence');
   check('Runtime source includes exact current executable cartridge',manifest.resources.some(resource=>resource.url===new URL(cartridge.path,base).href&&resource.sha256===cartridge.sha256&&resource.status==='included'));
   check('Runtime source includes every pinned executable cartridge',current.cartridges.every(cartridge=>manifest.resources.some(resource=>resource.url===new URL(cartridge.path,base).href&&resource.sha256===cartridge.sha256&&resource.status==='included')));
   check('Runtime source contains the exact router document',manifest.resources.some(resource=>resource.url===base&&resource.sha256===hash(blob('sandbox/'+generation+'/atlas/index.html'))&&resource.status==='included'));
   const pinsPath='sandbox/'+generation+'/atlas/tool-layers.json';
   const pins=JSON.parse(blob(pinsPath));
   if(pins.hostGeneration){
    const prefix='sandbox/'+pins.hostGeneration+'/tool-layers/';
    const files=execFileSync('git',['ls-tree','-r','--name-only',sourceCommit,prefix],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(p=>p.endsWith('.js'));
    check('Runtime source contains every pinned tool host module',files.length>0&&files.every(p=>manifest.resources.some(resource=>resource.url===new URL('/testcode/'+p.slice(8),base).href&&resource.sha256===hash(blob(p))&&resource.status==='included')),{files});
   }
   receipt.download={bytes:bytes.length,sha256:hash(bytes),filename:download.suggestedFilename()};
   check('Source capture causes no uncaught script errors',receipt.errors.length===0,receipt.errors);
  }catch(error){receipt.error=error.stack;check('Source download completes',false,error.message);}
  finally{await context.close();}
 }}finally{await browser.close();}
})().catch(error=>{results.push({error:error.stack});process.exitCode=1;}).finally(()=>{
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,generation,sourceCommit,results},null,2)+'\n');
 if(results.some(r=>r.error||r.checks?.some(c=>!c.pass)))process.exitCode=1;
});
