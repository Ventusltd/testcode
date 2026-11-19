import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative, extname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url));
const cfg=JSON.parse(readFileSync(resolve(here,'inputs.json'),'utf8'));
const source=resolve(process.env.SOURCE_ROOT||resolve(here,'source'));
const atlas=resolve(process.env.ATLAS_ROOT||resolve(here,'gridatlas'));
const pipeline=resolve(process.env.PIPELINE_ROOT||resolve(here,'pipelinenews'));
const out=resolve(process.env.EVIDENCE_DIR||resolve(here,'evidence'));
mkdirSync(out,{recursive:true});
const report={input:cfg.source.sha,source,atlas,pipeline,checks:[],missing:[],sri_mismatch:[],resources:[],external:[],bugs:[],comparisons:[]};
const check=(name,condition,details='')=>{report.checks.push({name,pass:!!condition,details});if(!condition)console.error('FAIL',name,details);};
const git=(dir,...args)=>{try{return execFileSync('git',['-C',dir,...args],{encoding:'utf8'}).trim();}catch{return '';}};
check('pinned GlobalGrid2050 commit',git(source,'rev-parse','HEAD')===cfg.source.sha,git(source,'rev-parse','HEAD'));
check('pinned GridAtlas rollback',git(atlas,'rev-parse','HEAD')===cfg.atlas.sha,git(atlas,'rev-parse','HEAD'));
check('pinned PipelineNews repo',git(pipeline,'rev-parse','HEAD')===cfg.pipelinenews.sha,git(pipeline,'rev-parse','HEAD'));
const release=resolve(source,cfg.source.release),index=resolve(release,'index.html');
check('exact V9.55 index blob',git(source,'hash-object',index)===cfg.source.index_git_blob,git(source,'hash-object',index));
for(const prior of cfg.source.comparison_releases){const file=resolve(source,prior.path,'index.html');check('historical index preserved '+prior.path,git(source,'hash-object',file)===prior.index_git_blob,git(source,'hash-object',file));}
for(const p of ['data','news','solar1000','map-entry.mjs','scripts']){
 const a=git(source,'rev-parse','HEAD:'+cfg.source.release+'/'+p),b=git(source,'rev-parse','HEAD:uk_renewables_pipeline/202611191154/'+p);
 report.comparisons.push({path:p,v955:a,v954:b,equal:a===b});
 check('unchanged '+p+' vs V9.54',!!a&&a===b,a+' / '+b);
}
const html=readFileSync(index,'utf8');
check('one real gauge canvas of each ID',['g1','g2','g3'].every(id=>(html.match(new RegExp('id="'+id+'"','g'))||[]).length===1));
check('HUD outside disclosure',html.indexOf('class="gauges hud-gauges"')>html.indexOf('id="repdPanel"')&&html.indexOf('class="gauges hud-gauges"')<html.indexOf('class="compact-analytics"'));
if(/<title>[^<]*V9\.54/.test(html)||/V9\.54 · PIPELINE NEWS/.test(html))report.bugs.push({severity:'minor',code:'PN-955-LABEL',evidence:'V9.55 index title and Site tools still label V9.54',scope:'release metadata; not a data integrity issue'});
const checked=new Set();
function attr(tag,key){return tag.match(new RegExp('\\b'+key+'\\s*=\\s*["\\x27]([^"\\x27]+)["\\x27]','i'))?.[1]||'';}
function pathFor(from,raw){
 if(!raw||/^(?:https?:|data:|#|mailto:|javascript:|\/\/)/i.test(raw))return null;
 const clean=raw.split(/[?#]/)[0];
 const dest=clean.startsWith('/')?resolve(source,clean.slice(1)):resolve(dirname(from),decodeURIComponent(clean));
 if(dest!==source&&!dest.startsWith(source+'/'))return {escaped:dest};
 return {file:dest};
}
function visit(from,raw,integrity='',kind=''){
 if(/^https?:\/\//i.test(raw)){report.external.push({from:relative(source,from),url:raw,kind,integrity});return;}
 const resolved=pathFor(from,raw);
 if(!resolved)return;
 if(resolved.escaped){report.missing.push({from:relative(source,from),raw,reason:'outside source root'});return;}
 const file=resolved.file;
 if(!existsSync(file)){report.missing.push({from:relative(source,from),raw,kind,reason:'missing local asset'});return;}
 const rel=relative(source,file);
 if(integrity.startsWith('sha256-')){
  const actual='sha256-'+createHash('sha256').update(readFileSync(file)).digest('base64');
  if(actual!==integrity)report.sri_mismatch.push({file:rel,expected:integrity,actual});
 }
 if(checked.has(file))return;
 checked.add(file);report.resources.push({path:rel,kind,git_blob:git(source,'hash-object',file)});
 if(!/\.(?:m?js|css)$/.test(file))return;
 const content=readFileSync(file,'utf8');
 if(/\.css$/.test(file)){
  for(const m of content.matchAll(/@import\s+(?:url\()?["']?([^"'\s)]+)["']?\)?/g))visit(file,m[1],'','css-import');
  return;
 }
 const staticImports=[...content.matchAll(/\b(?:import|export)\s+(?:[^;'"]*?\s+from\s*)?['"]([^'"]+)['"]/g),...content.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g)];
 for(const m of staticImports)if(m[1].startsWith('.')||m[1].startsWith('/'))visit(file,m[1],'','module-import');
}
for(const m of html.matchAll(/<(?:script|link)\b[^>]*>/gi)){
 const tag=m[0],tagName=tag.slice(1).split(/\s/)[0].toLowerCase();
 if(tagName==='link'&&!/\brel=["']stylesheet["']/i.test(tag))continue;
 const src=attr(tag,tagName==='script'?'src':'href');
 if(src)visit(index,src,attr(tag,'integrity'),tagName);
}
check('complete static HTML + ESM + CSS import closure',report.missing.length===0,JSON.stringify(report.missing.slice(0,15)));
check('local sha256 SRI checks',report.sri_mismatch.length===0,JSON.stringify(report.sri_mismatch.slice(0,15)));
check('Chart.js exact external SRI declared',report.external.some(x=>x.url===cfg.runtime.chart_js.url&&x.integrity===cfg.runtime.chart_js.integrity));
writeFileSync(resolve(out,'offline.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks:report.checks.length,passed:report.checks.filter(c=>c.pass).length,local_resources:report.resources.length,external_resources:report.external.length,missing:report.missing.length,sri_mismatch:report.sri_mismatch.length,observed_bugs:report.bugs},null,2));
assert.ok(report.checks.every(c=>c.pass),'Offline dependency closure or immutable source identity failed; browser stage must not run.');
