/** Offline gate for the exact candidate bytes, including generated cartridges. */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export async function verifyCandidate(root) {
  root = path.resolve(root);
  const checks = [];
  const check = (name, ok, detail) => checks.push({name, ok, detail});
  async function parse(name, code, module) {
    try {
      if (module) {
        const r = spawnSync(process.execPath, ['--check','--input-type=module'], {input:code,encoding:'utf8',windowsHide:true,timeout:15000});
        if (r.status !== 0) throw new Error((r.stderr || String(r.error)).slice(0,1000));
      } else new vm.Script(code, {filename:name});
      check(`parse:${name}`,true,'syntax only; code not executed');
    } catch (error) { check(`parse:${name}`,false,String(error.message)); }
  }
  const files = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir,{withFileTypes:true})) {
      if (entry.name === '.git') continue;
      const p = path.join(dir,entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (entry.isFile()) files.push(p);
      else check('file-type',false,p);
    }
  }
  await walk(root);
  const current = JSON.parse(await fs.readFile(path.join(root,'atlas/current.json'),'utf8'));
  check('cartridges-nonempty',Array.isArray(current.cartridges) && current.cartridges.length>0,'Zero runtime cartridges cannot pass');
  for (const entry of current.cartridges || []) {
    const p = path.resolve(root,'atlas',entry.path);
    const relative = path.relative(root,p);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { check('cartridge-path',false,entry.path); continue; }
    try { check(`cartridge-hash:${entry.id}`,sha(await fs.readFile(p))===entry.sha256,entry.path); }
    catch(error) { check(`cartridge-hash:${entry.id}`,false,error.message); }
  }
  let scripts = 0;
  for (const p of files) {
    const name = path.relative(root,p);
    if (/\.(?:m?js|html)$/.test(p)) {
      const code = await fs.readFile(p,'utf8');
      if (/\.m?js$/.test(p)) {
        scripts++;
        await parse(name,code,p.endsWith('.mjs') || /^\s*(?:export\b|import\s+(?!\())/m.test(code));
      } else {
        let index=0;
        for(const [,attrs,body] of code.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
          if (/\bsrc\s*=/.test(attrs) || !body.trim()) continue;
          const type=attrs.match(/\btype\s*=\s*["']([^"']+)/i)?.[1];
          if(type && !['module','text/javascript','application/javascript'].includes(type)) continue;
          scripts++;
          await parse(`${name}:inline-${++index}`,body,type==='module');
        }
      }
    }
  }
  check('scripts-nonempty',scripts>0,`${scripts} scripts inspected`);
  return {generation:current.generation,files:files.length,scripts,checks,ok:checks.every(x=>x.ok),scope:'Offline syntax and declared cartridge hash checks; no browser, GPU shader compilation or runtime outcome claim.'};
}

if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result=await verifyCandidate(process.argv[2]);
    if(process.argv[3]) await fs.writeFile(process.argv[3],JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({generation:result.generation,scripts:result.scripts,passed:result.checks.filter(x=>x.ok).length,failed:result.checks.filter(x=>!x.ok)}));
    if(!result.ok)process.exitCode=1;
  } catch(error) { console.error(String(error));process.exitCode=1; }
}
