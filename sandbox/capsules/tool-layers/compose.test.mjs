import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm, readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {composeToolOwner} from './compose.mjs';

const RELEASE = '202609051855';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function fixture(t, entries = [['index.html', '<h1>Original GIS</h1>']]) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'tool-owner-proof-'));
  t.after(async () => {
    const resolved = path.resolve(temp);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('tool-owner-proof-')) throw Error('Refusing cleanup outside the owned fixture');
    await rm(resolved, {recursive: true, force: true});
  });
  const owner = path.join(temp, 'owner'), target = path.join(temp, 'candidate');
  await mkdir(owner); await mkdir(target);
  const git = (...args) => execFileSync('git', ['-C', owner, ...args], {encoding:'utf8', windowsHide:true, stdio:['ignore','pipe','pipe']}).trim();
  git('init', '--quiet'); git('remote', 'add', 'origin', 'https://github.com/example/fixture-owner.git');
  await writeFile(path.join(owner, '.gitattributes'), '* -text\n');
  const release = path.join(owner, 'releases', RELEASE);
  const files = [];
  for (const [name, text] of entries) {
    const bytes = Buffer.from(text);
    const file = path.join(release, name);
    await mkdir(path.dirname(file), {recursive:true}); await writeFile(file, bytes);
    files.push({path:name, bytes:bytes.length, sha256:digest(bytes)});
  }
  const manifest = {schema:'globalgrid.original-runtime.v1',generation:RELEASE,
    applications:[{id:'fixture',entry:entries[0][0]}],files};
  const commit = async () => {
    await writeFile(path.join(release, 'manifest.json'), JSON.stringify(manifest));
    git('add', '--', '.');
    git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','fixture');
    return git('rev-parse', 'HEAD');
  };
  return {owner,target,release,manifest,commit};
}

test('only the pinned committed bytes are copied despite a dirty producer worktree', async t => {
  const f = await fixture(t); const revision = await f.commit();
  await writeFile(path.join(f.release, 'index.html'), '<h1>Uncommitted change</h1>');
  const receipt = await composeToolOwner(f.target, f.owner, revision, RELEASE);
  assert.equal(await readFile(path.join(f.target,'layer-apps','index.html'),'utf8'), '<h1>Original GIS</h1>');
  assert.equal(receipt.commit, revision);
  assert.equal(receipt.manifestSha256.length, 64);
});

test('short revisions and floating branch references are refused', async t => {
  const f = await fixture(t); await f.commit();
  await assert.rejects(composeToolOwner(f.target,f.owner,'main',RELEASE), /Full owner commit/);
  await assert.rejects(composeToolOwner(f.target,f.owner,'abc1234',RELEASE), /Full owner commit/);
});

test('wrong generation in a committed manifest is refused', async t => {
  const f = await fixture(t); f.manifest.generation='202609051623';
  const revision=await f.commit();
  await assert.rejects(composeToolOwner(f.target,f.owner,revision,RELEASE), /Invalid producer manifest/);
});

test('a committed hash mismatch is refused', async t => {
  const f = await fixture(t); f.manifest.files[0].sha256='0'.repeat(64);
  const revision=await f.commit();
  await assert.rejects(composeToolOwner(f.target,f.owner,revision,RELEASE), /Producer mismatch/);
});

test('parent traversal cannot escape the candidate', async t => {
  const f = await fixture(t); f.manifest.files[0].path='../escape.html';
  const revision=await f.commit();
  await assert.rejects(composeToolOwner(f.target,f.owner,revision,RELEASE), /Unsafe producer path/);
  assert.deepEqual(await readdir(f.target), []);
});

test('a bad later member is rejected before any candidate file is written', async t => {
  const f = await fixture(t, [['first.html','<p>First</p>'],['second.js','const second = 2;']]);
  f.manifest.files[1].sha256='0'.repeat(64); const revision=await f.commit();
  await assert.rejects(composeToolOwner(f.target,f.owner,revision,RELEASE), /Producer mismatch/);
  assert.deepEqual(await readdir(f.target), [], 'Preflight all producer members before creating a partial candidate');
});
