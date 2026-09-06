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
const output = path.resolve(process.env.TEST_OUTPUT || 'offshore-route-artifacts');
fs.mkdirSync(output, {recursive:true});
const report = {generation, profiles:[], sourceMode:'Actual composed files; no request interception or source substitution', limitations:['Chrome phone emulation is not physical-device evidence.','Straight lines are mapped measurements, not surveyed export routes.']};
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
      const {name,...options}=profile;
      const context=await browser.newContext(options);
      try {
        const page=await context.newPage();
        const result={name,errors:[],checks:[]};report.profiles.push(result);
        page.on('pageerror',e=>result.errors.push(e.message));
        await page.goto(base+'?repd_ref=9873&technology=wind_offshore&latitude=56.4431397&longitude=-1.4664021&zoom=12',{waitUntil:'domcontentloaded',timeout:60000});
        await page.waitForFunction(()=>document.querySelector('.neon-answer')?.textContent.includes('Offshore export route unassessed'),null,{timeout:60000});
        result.card=await page.locator('.neon-answer').innerText();
        result.actualGeneration=await page.evaluate(()=>window.__GRIDATLAS_ATLAS__?.generation);
        await page.locator('[data-gridatlas-corridor="1"]').click({timeout:15000});
        result.sheet=await page.locator('#gridatlas-corridor-sheet').innerText();
        result.checks.push({name:'correct candidate',pass:result.actualGeneration===generation},
          {name:'straight measurement retained',pass:result.card.includes('78.96 km straight')&&result.sheet.includes('78.96 km straight')},
          {name:'unsupported highway estimate absent',pass:!/~98\.3|98\.3 km corridor|times 1\.245/.test(result.card+result.sheet)},
          {name:'offshore scope shown inline and expanded',pass:result.card.includes('Offshore export route unassessed')&&result.sheet.includes('Offshore export route unassessed')});
        await page.screenshot({path:path.join(output,name+'-offshore.png')});
        await page.locator('[data-gridatlas-corridor-close="1"]').click();
        result.checks.push({name:'route sheet closes',pass:!(await page.locator('#gridatlas-corridor-sheet').isVisible())});
        await page.goto(base+'?repd_ref=14926&technology=solar&latitude=51.779&longitude=-1.337&zoom=12',{waitUntil:'domcontentloaded',timeout:60000});
        await page.waitForFunction(()=>document.querySelector('.neon-answer')?.textContent.includes('km straight'),null,{timeout:60000});
        result.onshoreCard=await page.locator('.neon-answer').innerText();
        result.checks.push({name:'onshore corridor remains available',pass:/corridor estimate/.test(result.onshoreCard)&&!result.onshoreCard.includes('Offshore export route unassessed')},
          {name:'no uncaught script errors',pass:result.errors.length===0});
        await page.screenshot({path:path.join(output,name+'-onshore.png')});
        result.pass=result.checks.every(c=>c.pass);save();console.log(name,JSON.stringify(result.checks));
      }finally{await context.close();}
    }
  }finally{await browser.close();}
})().catch(error=>{report.error=error.stack;process.exitCode=1;}).finally(()=>{
  report.finishedUTC=new Date().toISOString();save();server.close();
  if(report.profiles.length!==2||report.profiles.some(p=>!p.pass))process.exitCode=1;
});
