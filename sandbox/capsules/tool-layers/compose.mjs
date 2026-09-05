import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const hash = b => createHash('sha256').update(b).digest('hex');
/** Only committed, manifest-checked producer bytes enter a candidate. */
export async function composeToolOwner(root, owner, revision, release) {
  if (!/^[a-f0-9]{40}$/.test(revision) || !/^\d{12}$/.test(release)) throw Error('Full owner commit and release timestamp required');
  const git = (...args) => execFileSync('git',['-C',owner,...args],{maxBuffer:64*1024*1024,windowsHide:true});
  const prefix = `releases/${release}/`;
  const raw = git('show',`${revision}:${prefix}manifest.json`);
  const manifest = JSON.parse(raw);
  if (manifest.generation !== release || !manifest.files?.length) throw Error('Invalid producer manifest');
  const prepared = [];
  for (const file of manifest.files) {
    if (!file.path || file.path.includes('\\') || file.path.split('/').some(p=>p==='..'||p==='') || path.isAbsolute(file.path)) throw Error('Unsafe producer path');
    const bytes = git('show',`${revision}:${prefix}${file.path}`);
    if (hash(bytes)!==file.sha256 || bytes.length!==file.bytes) throw Error(`Producer mismatch: ${file.path}`);
    prepared.push({file,bytes});
  }
  for (const {file,bytes} of prepared) {
    const target = path.join(root,'layer-apps',file.path);
    await mkdir(path.dirname(target),{recursive:true}); await writeFile(target,bytes);
  }
  return {repository:git('remote','get-url','origin').toString().trim(),commit:revision,release,manifestSha256:hash(raw),applications:manifest.applications,rootOriginDependencies:manifest.rootOriginDependencies};
}
