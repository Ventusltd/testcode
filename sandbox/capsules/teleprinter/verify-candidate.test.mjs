import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyCandidate} from './verify-candidate.mjs';
const offline='C:/Users/vikra/OneDrive/Desktop/offline-screenshots/codex-next-print-tests';
await fs.mkdir(offline,{recursive:true});
async function fixture(code,empty=false) {
  const root=await fs.mkdtemp(path.join(offline,'negative-control-'));
  await fs.mkdir(path.join(root,'atlas'));
  await fs.writeFile(path.join(root,'atlas/main.js'),code);
  await fs.writeFile(path.join(root,'atlas/current.json'),JSON.stringify({generation:'fixture',cartridges:empty?[]:[{id:'main',path:'main.js',sha256:createHash('sha256').update(code).digest('hex')}]}));
  await fs.writeFile(path.join(root,'index.html'),'<script>window.ready = true;</script>');
  return root;
}
test('valid generated code and inline script pass',async()=>assert.equal((await verifyCandidate(await fixture('window.ready = true;'))).ok,true));
test('corrupted generated code refuses despite an updated matching hash',async()=>{
  const root=await fixture("window.ready = 'broken\nstring';");
  const r=await verifyCandidate(root);
  assert.equal(r.checks.find(x=>x.name==='cartridge-hash:main').ok,true);
  assert.equal(r.checks.find(x=>x.name==='parse:atlas\\main.js').ok,false);
  const cli=spawnSync(process.execPath,[fileURLToPath(new URL('./verify-candidate.mjs',import.meta.url)),root],{encoding:'utf8',windowsHide:true});
  assert.equal(cli.status,1);
  await fs.writeFile(path.join(root,'refusal.txt'),cli.stdout+cli.stderr);
});
test('zero runtime cartridges cannot report green',async()=>assert.equal((await verifyCandidate(await fixture('window.ready=true;',true))).ok,false));
test('invalid inline script is rejected',async()=>{
  const root=await fixture('window.ready=true;');
  await fs.writeFile(path.join(root,'index.html'),'<script>const broken = ;</script>');
  assert.equal((await verifyCandidate(root)).ok,false);
});
