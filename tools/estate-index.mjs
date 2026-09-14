import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const exec = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const add = (map, key, value) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(value); };
const sorted = set => [...set].sort((a, b) => typeof a === 'number' ? a - b : a.localeCompare(b));
export function indexFamilies(records, groups, advertised) {
  const families = new Map(), lines = new Map(), repos = new Map(), sources = new Map(), live = new Map(), memberships = new Map();
  for (const r of records) {
    if (!Number.isSafeInteger(r.n) || r.n < 0 || families.has(r.n) || !Array.isArray(r.lines) || !Array.isArray(r.places)) throw Error('Invalid or duplicate family key: ' + r.n);
    families.set(r.n, r);
    for (const n of r.lines) { if (!Number.isSafeInteger(n) || n < 0) throw Error('Invalid line key'); add(lines, n, r.n); }
    for (const p of r.places) {
      if (!p.repo || !p.path || !/^[a-f0-9]{40}$/.test(p.commit || '')) throw Error('Unpinned source in family ' + r.n);
      add(repos, p.repo, r.n);
      const key = JSON.stringify([p.repo, p.commit, p.path]);
      if (!sources.has(key)) sources.set(key, { repo: p.repo, commit: p.commit, path: p.path, families: new Set() });
      sources.get(key).families.add(r.n);
      if (p.live) {
        const url = new URL(p.live); if (!['https:', 'http:'].includes(url.protocol)) throw Error('Invalid recorded live URL');
        add(live, p.live, r.n);
      }
    }
  }
  if (families.size !== advertised) throw Error(`Family coverage mismatch: ${families.size} versus ${advertised}`);
  for (const [symbol, ids] of Object.entries(groups)) {
    if (!Array.isArray(ids)) throw Error('Invalid membership group');
    for (const n of ids) { if (!families.has(n)) throw Error(`Group ${symbol} references absent family ${n}`); add(memberships, n, symbol); }
  }
  const dangling = [];
  for (const r of families.values()) for (const kind of ['uses', 'used_by']) for (const ref of r[kind] || []) if (!families.has(ref.family)) dangling.push({ family: r.n, kind, target: ref.family });
  return { families, lines, repos, sources, live, memberships, dangling };
}
export async function build({ repo, commit, out, concurrency = 8 }) {
  if (!/^[a-f0-9]{40}$/.test(commit || '')) throw Error('An exact source commit is required');
  const started = new Date().toISOString(), start = performance.now(), inputs = {};
  async function read(name) {
    const { stdout } = await exec('git', ['-C', repo, 'show', `${commit}:${name}`], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    inputs[name] = { bytes: stdout.length, sha256: hash(stdout) }; return JSON.parse(stdout.toString('utf8'));
  }
  const [index, groups, blocks] = await Promise.all([read('code/index.json'), read('blocks/families.json'), read('blocks/blocks.json')]);
  if (!Array.isArray(index.buckets) || !index.buckets.length || new Set(index.buckets).size !== index.buckets.length) throw Error('Missing or duplicate advertised buckets');
  const records = []; let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, index.buckets.length) }, async () => {
    while (next < index.buckets.length) {
      const bucket = index.buckets[next++];
      if (!Number.isSafeInteger(bucket) || bucket < 0) throw Error('Invalid bucket key');
      const rows = await read(`code/f/${bucket}.json`);
      for (const [key, r] of Object.entries(rows)) { if (String(r.n) !== key) throw Error('Family record key differs from permanent key'); records.push(r); }
    }
  }));
  records.sort((a, b) => a.n - b.n);
  const data = indexFamilies(records, groups, index.families);
  // A new output directory prevents overwriting an earlier generated artefact.
  await mkdir(out, { recursive: false });
  const outputs = {};
  async function emit(name, value) {
    const bytes = Buffer.from(JSON.stringify(value));
    if (bytes.length > 600 * 1024) throw Error('Output exceeds 600 KiB: ' + name);
    await writeFile(path.join(out, name), bytes, { flag: 'wx' }); outputs[name] = { bytes: bytes.length, sha256: hash(bytes) };
  }
  async function shards(prefix, rows) {
    const descriptors = [];
    async function page(part) {
      if (Buffer.byteLength(JSON.stringify(part)) > 590 * 1024) {
        if (part.length < 2) throw Error('Single index record exceeds size bound: ' + prefix);
        const middle = Math.floor(part.length / 2); await page(part.slice(0, middle)); await page(part.slice(middle)); return;
      }
      const name = `${prefix}-${descriptors.length}.json`; await emit(name, part);
      descriptors.push({ path: name, count: part.length, first: part[0]?.key, last: part.at(-1)?.key });
    }
    for (let i = 0; i < rows.length; i += 256) await page(rows.slice(i, i + 256));
    return descriptors;
  }
  const lineShards = await shards('lines', [...data.lines].sort((a, b) => a[0] - b[0]).map(([key, ids]) => ({ key, families: sorted(ids) })));
  const familyShards = await shards('families', records.map(r => ({ key: r.n, names: r.names, lines: r.lines, groups: sorted(data.memberships.get(r.n) || new Set()), uses: r.uses || [], used_by: r.used_by || [] })));
  const sourceShards = await shards('sources', [...data.sources].sort(([a], [b]) => a.localeCompare(b)).map(([identity, s]) => ({ key: hash(identity), ...s, families: sorted(s.families) })));
  const liveShards = await shards('recorded-pages', [...data.live].sort(([a], [b]) => a.localeCompare(b)).map(([key, ids]) => ({ key, families: sorted(ids), verification: 'recorded in source snapshot; HTTP status not checked' })));
  await emit('repositories.json', [...data.repos].sort(([a], [b]) => a.localeCompare(b)).map(([key, ids]) => ({ key, families: sorted(ids) })));
  await emit('dangling.json', data.dangling);
  const report = {
    schema: 'stars-estate-index/0.1', source_commit: commit, started_utc: started, completed_utc: new Date().toISOString(), elapsed_ms: Math.round(performance.now() - start),
    source_scope: 'All advertised family buckets at the pinned Stars commit; not a claim of every repository, branch, source line or live page in the estate',
    counts: { buckets: index.buckets.length, families: data.families.size, numbered_lines_in_families: data.lines.size, registry_lines: index.lines, repositories_in_places: data.repos.size, pinned_source_files: data.sources.size, recorded_live_urls: data.live.size, groups: Object.keys(groups).length, named_blocks: blocks.blocks.length, families_with_multiple_groups: [...data.memberships.values()].filter(x => x.size > 1).length, families_without_groups: records.filter(r => !data.memberships.has(r.n)).length, dangling_relations: data.dangling.length },
    indexes: { lines: lineShards, families: familyShards, sources: sourceShards, recorded_pages: liveShards },
    inputs, outputs,
  };
  await emit('manifest.json', report);
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [repo, commit, out] = process.argv.slice(2);
  if (!repo || !commit || !out) throw Error('Usage: node tools/estate-index.mjs <stars-git-repo> <40-char-commit> <new-output-directory>');
  const result = await build({ repo, commit, out });
  console.log(JSON.stringify({ source_commit: result.source_commit, completed_utc: result.completed_utc, elapsed_ms: result.elapsed_ms, counts: result.counts }, null, 2));
  if (result.counts.dangling_relations) process.exitCode = 1;
}
