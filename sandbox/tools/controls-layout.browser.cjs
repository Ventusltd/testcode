/* Chrome layout regression against the real composed candidate, including its remote shell. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch (error) {
  const installed = 'C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright';
  if (process.env.PLAYWRIGHT_MODULE || !fs.existsSync(installed)) throw error;
  playwright = require(installed);
}
const root = path.resolve(__dirname, '../..');
const generation = process.env.TEST_GENERATION || '202609060228';
if (!/^\d{12}$/.test(generation)) throw new Error('TEST_GENERATION must be a twelve-digit immutable generation');
const output = path.resolve(process.env.TEST_OUTPUT || 'controls-layout-artifacts');
fs.mkdirSync(output, {recursive: true});
const report = {generation, commit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(), checks: [], profiles: [], limitations: ['393px Chrome touch emulation is not a physical phone.', 'The composed Atlas imports a remote immutable shell and map dependencies; this is a network browser gate, not an offline or deployment acceptance gate.']};
function check(name, ok, detail) { report.checks.push({name, ok: !!ok, detail}); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok?'':': '+JSON.stringify(detail)}`); fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2)+'\n'); }
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = pathname.startsWith('/testcode/') ? '/sandbox/' + pathname.slice(10) : pathname;
  let file = path.resolve(root, '.' + relative);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    const mime = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css'};
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    // Historical immutable dependencies use committed bytes, avoiding Windows checkout CRLF conversion.
    const repoPath=path.relative(root,file).split(path.sep).join('/');
    if(repoPath.startsWith('sandbox/202609051906/')) {
      res.end(execFileSync('git',['show','HEAD:'+repoPath],{cwd:root,maxBuffer:64*1024*1024}));
    } else fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  report.base = process.env.TEST_BASE || `http://127.0.0.1:${server.address().port}/testcode/${generation}/atlas/`;
  const browser = await playwright.chromium.launch({headless: true, ...(process.env.CHROME_CHANNEL === 'chromium' ? {} : {channel: process.env.CHROME_CHANNEL || 'chrome'})});
  report.browser = browser.version();
  try {
    for (const profile of [{name: 'desktop', viewport: {width: 1440, height: 900}}, {name: 'mobile-393', viewport: {width: 393, height: 852}, isMobile: true, hasTouch: true, deviceScaleFactor: 1}]) {
      const {name, ...options} = profile;
      const context = await browser.newContext(options);
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const result = {name, errors}; report.profiles.push(result);
      try {
        await page.goto(report.base, {waitUntil: 'domcontentloaded', timeout: 60000});
        await page.waitForFunction(() => document.querySelector('#codex-tool-layers>button') && document.querySelector('#gridatlas-dash-toggle') && document.querySelector('#atlas-map-controls-layout'), null, {timeout: 60000});
        await page.waitForFunction(() => document.querySelector('.gm-title') && document.querySelector('.search-bar-wrapper[data-testcode-search="persistent"]') && document.querySelector('a[href*="/spider_printer"]'), null, {timeout: 60000});
        result.layout = await page.evaluate(() => {
          const rect = el => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
          const color = el => {const c = getComputedStyle(el); return [c.backgroundColor,c.color,c.borderTopColor];};
          const layer = document.querySelector('#gridatlas-dash-toggle');
          const tray = document.querySelector('#codex-tool-layers');
          const search = document.querySelector('.search-bar-wrapper[data-testcode-search="persistent"]');
          return {width: innerWidth, height:innerHeight, scroll:document.documentElement.scrollWidth, layers:rect(layer), layerColor:color(layer), tray:rect(tray), buttons:[...tray.querySelectorAll(':scope>button')].map(el=>({text:el.textContent.trim(),rect:rect(el),color:color(el)})), search:search&&rect(search), input:document.querySelector('#search-input')&&rect(document.querySelector('#search-input')), elements:[...document.querySelectorAll('a[href*="/spider_printer"]')].map(el=>el.textContent.trim()), generation:window.__GRIDATLAS_ATLAS__?.generation};
        });
        const f = result.layout;
        check(name+' exact viewport and generation', f.width===options.viewport.width && f.generation===generation, f);
        check(name+' three named tools', f.buttons.length===3 && f.buttons.some(b=>/GIS.*SLD/.test(b.text)) && f.buttons.some(b=>/Module Layout/.test(b.text)) && f.buttons.some(b=>/Cable Geometry/.test(b.text)), f.buttons);
        check(name+' tools above Layers at right', f.tray.bottom<=f.layers.y && f.tray.right<=f.width && f.tray.right>=f.width-30 && f.tray.y>f.height/2, f);
        check(name+' buttons match Layers colors', f.buttons.every(b=>JSON.stringify(b.color)===JSON.stringify(f.layerColor)), f);
        check(name+' controls within viewport', f.scroll<=f.width && f.buttons.every(b=>b.rect.x>=0 && b.rect.right<=f.width && b.rect.height>=44), f);
        check(name+' Elements label', f.elements.length>0 && f.elements.every(label=>label==='Elements'), f.elements);
        check(name+' visible usable address field', f.search && f.search.x>=0 && f.search.right<=f.width && f.input?.width>=(name==='desktop'?450:250), {search:f.search,input:f.input});
        const titles = page.locator('.gm-title');
        const count = await titles.count();
        check(name+' menus exist', count>0, count);
        result.menus=[];
        for(let i=0;i<count;i++) {
          const title=titles.nth(i);
          if(!await title.isVisible()) continue;
          await title.click();
          check(name+' tools yield to open menu '+i, await page.locator('#codex-tool-layers').evaluate(el=>getComputedStyle(el).visibility==='hidden' && getComputedStyle(el).pointerEvents==='none'), 'Tray hidden and non-interactive while menu expanded');
          const menu=await title.evaluate(el=>{
            const panel=el.closest('.gm-menu')?.querySelector('.gm-panel');
            if(!panel || panel.hidden || !panel.getBoundingClientRect().height) return {label:el.textContent,open:false};
            const r=panel.getBoundingClientRect();
            const left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
            const samples=[];
            for(const fx of [.1,.5,.9])for(const fy of [.1,.5,.9]){
              const x=left+(right-left)*fx,y=top+(bottom-top)*fy,hit=document.elementFromPoint(x,y);
              samples.push({x,y,clear:!!hit&&(hit===panel||panel.contains(hit)),hit:hit?.id||hit?.className,obstruction:hit&&!panel.contains(hit)?hit.outerHTML.slice(0,320):null});
            }
            return {label:el.textContent.trim(),open:true,samples};
          });
          result.menus.push(menu);
          check(name+' unobstructed menu '+menu.label,menu.open && menu.samples.every(s=>s.clear),menu);
          await page.screenshot({path:path.join(output,`${name}-menu-${i}.png`)});
          await page.keyboard.press('Escape');
          check(name+' tools return after menu '+i,await page.locator('#codex-tool-layers').isVisible(),'Tray visible again after Escape');
        }
        await page.screenshot({path:path.join(output,name+'.png')});
        check(name+' no uncaught script errors', errors.length===0, errors);
      } catch(error) {check(name+' completed',false,error.stack); await page.screenshot({path:path.join(output,name+'-failure.png')}).catch(()=>{});}
      finally {await context.close();}
    }
  } finally {await browser.close();}
})().catch(error=>check('harness completed',false,error.stack)).finally(()=>{
  report.finished=new Date().toISOString();
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2)+'\n');
  server.close();
  process.exitCode=report.checks.some(check=>!check.ok)?1:0;
});

