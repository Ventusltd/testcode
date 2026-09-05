/** Codex: prepare a new immutable Test Code generation; finish source bundles after committing code. */
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile, readdir, rename, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyCandidate } from './verify-candidate.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const mode = args.shift();
const options = {};
while (args.length) { const key = args.shift(); if (!key.startsWith('--') || !args.length) throw new Error('Use --name value options.'); options[key.slice(2)] = args.shift(); }
const engineDir = options['engine-dir'] || process.env.TELEPRINTER_REPO;
if (!engineDir) throw new Error('Provide --engine-dir PATH_TO_TELEPRINTER_REPOSITORY.');
const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { maxBuffer: 256 * 1024 * 1024, windowsHide: true });
const sha256 = value => createHash('sha256').update(value).digest('hex');
const generation = options.generation || (mode === 'prepare' ? new Date().toISOString().replace(/\D/g, '').slice(0, 12) : '');
if (!/^\d{12}$/.test(generation)) throw new Error('A 12-digit --generation UTC timestamp is required.');
const generationRoot = path.join(repo, 'sandbox', generation);
async function requireCandidateSyntax() {
  const result = await verifyCandidate(generationRoot);
  if (!result.ok) throw new Error('Candidate refused: ' + JSON.stringify(result.checks.filter(check => !check.ok)));
  console.log(`Offline candidate gate: ${result.scripts} scripts, ${result.checks.length} checks passed.`);
}
const prefix = `sandbox/${generation}`;
const modules = ['controls.js', 'print-screen.js', 'screen-pdf.mjs', 'png-pixels.mjs', 'print-source-code.js', 'runtime-source.js', 'app-frame.js', 'capture-geometry.mjs', 'clone-visible-ui.js', 'vendor/html2canvas-1.4.1.mjs', 'vendor/html2canvas-LICENSE.txt'];
async function write(relative, contents) {
  const target = path.join(generationRoot, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}
async function walk(dir, base = dir) {
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...await walk(full, base));
    else if (entry.isFile()) output.push(path.relative(base, full).replaceAll('\\', '/'));
    else throw new Error(`Unsupported file type: ${full}`);
  }
  return output.sort();
}
const sourceScopeNote = `# Print source code scope\n\nThis generation adds the Codex-authored Teleprinter controls. Each app's text includes the committed HTML, JavaScript, ESM and CSS in its app directory, its bootstrap, the Teleprinter browser modules and vendored renderer license, and this scope note. Atlas includes current.json, which identifies the immutable remote shell and hashed cartridges. Pipeline includes its small contracts JSON files and code loaders under scripts/data. The landing page includes index.html and capsule-launch.js.\n\nThis inventory describes the pinned base source. The reader-facing Print source code also appends the current DOM, selected layers, map state, observed runtime dependencies and their complete fetched responses. Unreadable responses and dependency-discovery limits are named in that diagnostic file. Generated diagnostic prints stay offline, not in Git.\n\nPinned-base exclusions: application data payload directories (atlas/data and pipeline/data), results, cases, receipts, inherited detector evidence, generated text/manifest/pin files, external CDN libraries, and the remotely hosted Atlas shell. Remote dependencies are referenced by the committed code/configuration; their contents are not represented as locally committed source. This is scoped application source, not an offline reconstruction of every dependency or dataset. source-scopes.json lists every selected path. No source file is silently truncated.\n\nThe source pin is generated only after the application code commit exists. Its full commit SHA identifies the code version; the later pin/text publication does not pretend to include itself. Prior detector results belong to the predecessor generation and have not been rerun by this build.\n`;

if (mode === 'prepare') {
  const predecessor = options.from || '202609051344';
  if (!/^\d{12}$/.test(predecessor) || predecessor === generation) throw new Error('Invalid predecessor generation.');
  const predecessorRoot = path.join(repo, 'sandbox', predecessor);
  await access(predecessorRoot);
  const evidenceGeneration = JSON.parse(await readFile(path.join(predecessorRoot, 'results.json'), 'utf8')).generation || predecessor;
  // mkdir without recursive refuses an existing generation; never repair an old timestamp in place.
  await mkdir(generationRoot);
  for (const entry of await readdir(predecessorRoot)) await cp(path.join(predecessorRoot, entry), path.join(generationRoot, entry), { recursive: true, force: false, errorOnExist: true });
  const engineCommit = git(engineDir, 'rev-parse', '--verify', '--end-of-options', `${options['engine-revision'] || 'HEAD'}^{commit}`).toString().trim();
  for (const filename of modules) await write(`teleprinter/${filename}`, git(engineDir, 'show', `${engineCommit}:drivers/codex/${filename}`));
  const originals = await walk(generationRoot);
  for (const relative of originals) {
    if (!/\.(?:html|js|mjs|css)$/.test(relative) || relative === 'results.html' || relative.startsWith('teleprinter/')) continue;
    const full = path.join(generationRoot, relative);
    let text = (await readFile(full, 'utf8')).replace(/\r\n/g, '\n');
    text = text.replaceAll(predecessor, generation);
    if (relative === 'atlas/index.html') text = text.replace(/<title>[^<]*<\/title>/, `<title>Test Code Atlas ${generation}</title>`);
    await writeFile(full, text);
    if (path.basename(relative).includes(predecessor)) await rename(full, path.join(generationRoot, relative.replaceAll(predecessor, generation)));
  }
  const current = JSON.parse((await readFile(path.join(generationRoot, 'atlas/current.json'), 'utf8')).replaceAll(predecessor, generation));
  current.generation = generation;
  current.previous_generation = predecessor;
  current.composition_id = `${generation}-teleprinter`;
  for (const cartridge of current.cartridges) {
    const relative = path.posix.normalize(`atlas/${cartridge.path}`);
    if (!relative.startsWith('atlas/cartridges/') || relative.includes('..')) throw new Error('Unsafe cartridge path.');
    cartridge.sha256 = sha256(await readFile(path.join(generationRoot, relative)));
  }
  await write('atlas/current.json', JSON.stringify(current, null, 2) + '\n');
  for (const [app, appName] of [['landing', 'Test Code'], ['pipeline', 'Pipeline News'], ['atlas', 'GridAtlas']]) {
    const appDir = app === 'landing' ? '' : `${app}/`;
    const parent = app === 'landing' ? './' : '../';
    await write(`${appDir}teleprinter-bootstrap.js`, `import { mountTeleprinter } from '${parent}teleprinter/controls.js';\nconst base = new URL('${parent}teleprinter/', import.meta.url);\ntry {\n  const response = await fetch(new URL('${app}-source-pin.json', base), { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });\n  if (!response.ok) throw new Error('Source code is still being prepared.');\n  const pin = await response.json();\n  if (pin.generation !== '${generation}' || pin.app !== '${app}' || !/^[a-f0-9]{40}$/.test(pin.commit) || pin.repository !== 'https://github.com/Ventusltd/testcode') throw new Error('The source code version could not be checked.');\n  mountTeleprinter({ printButtons: ${app === 'atlas' ? "'button[data-gm-export]'" : 'undefined'}, appName: ${JSON.stringify(appName)}, manifestUrl: new URL('${app}-source-code.manifest.json', base), textUrl: new URL('${app}-source-code.txt', base), expectedCommit: pin.commit, expectedRepository: pin.repository });\n} catch (error) {\n  const note = document.createElement('p'); note.setAttribute('role', 'status'); note.textContent = 'Print options: ' + error.message; document.body.append(note);\n}\n`);
    let html = await readFile(path.join(generationRoot, `${appDir}index.html`), 'utf8');
    // A predecessor can already have Teleprinter. Replace its mount, never stack it.
    html = html.replace(/      const teleprinterUrl =[^\n]*\n      const teleprinterScript =[^\n]*\n      html =[^\n]*\n\s*\n/g, '');
    html = html.replace(/<script type="module" src="\.\/teleprinter-bootstrap\.js"><\/script>\s*/g, '');
    html = html.replace(/      html = html\.replace\(\/<head>\/i, '<head><link rel="icon" href="data:,">'\);\n/g, '');
    if (!/<link\b[^>]*rel=["']icon["']/i.test(html)) html = /<head>/i.test(html) ? html.replace(/<head>/i, '<head><link rel="icon" href="data:,">') : html.replace(/<!doctype html>/i, '<!doctype html><link rel="icon" href="data:,">');
    if (app === 'atlas') {
      const marker = '      document.open();';
      if (!html.includes(marker)) throw new Error('Atlas composer insertion point missing.');
      html = html.replace(marker, `      html = html.replace(/<head>/i, '<head><link rel="icon" href="data:,">');\n${marker}`);
      html = html.replace(marker, () => `      const teleprinterUrl = new URL('./teleprinter-bootstrap.js', window.location.href).href;\n      const teleprinterScript = '<script type="module" src="' + escapeAttribute(teleprinterUrl) + '">' + SCRIPT_CLOSE;\n      html = /<\\/body>/i.test(html) ? html.replace(/<\\/body>/i, teleprinterScript + '$&') : html + teleprinterScript;\n\n${marker}`);
    } else {
      const mount = '<script type="module" src="./teleprinter-bootstrap.js"></script>';
      html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, mount + '\n</body>') : html + '\n' + mount + '\n';
      if (app === 'landing') {
        html = html.replace(/<p><strong>Inherited detector evidence from \d{12}\.<\/strong>[^<]*<\/p>/g, '');
        html = html.replace(/(<h1>[^<]*<\/h1>)/, `$1<p><strong>Inherited detector evidence from ${evidenceGeneration}.</strong> The grid measurements below were not rerun for this print-test generation.</p>`);
      }
    }
    await write(`${appDir}index.html`, html);
  }
  const predecessorRelease = JSON.parse(await readFile(path.join(predecessorRoot, 'release.json'), 'utf8'));
  await write('inherited-release.json', JSON.stringify(predecessorRelease, null, 2) + '\n');
  await write('release.json', JSON.stringify({ generation, predecessor, built_utc: new Date().toISOString(), purpose: 'Full rendered screen through File Print, retained header/footer, and current-view source with runtime dependencies.', teleprinter: { repository: 'https://github.com/Ventusltd/teleprinter', commit: engineCommit }, inherited_detector_evidence: { generation: evidenceGeneration, rerun: false, files: ['results.json', 'results.html', 'cases.json', 'detector-build.json', 'inherited-release.json'] }, source_publication: 'Run finish only after committing application source; per-app pins identify that code commit.' }, null, 2) + '\n');
  await write('teleprinter/SOURCE-SCOPE.md', sourceScopeNote);
  await write('teleprinter/.gitattributes', '# Source bundle SHA256 applies to these exact bytes on every platform.\n*-source-code.txt -text\n');
  const files = await walk(generationRoot);
  for (const relative of files.filter(file => file.startsWith('pipeline/contracts/') && file.endsWith('.json'))) await write(relative, (await readFile(path.join(generationRoot, relative), 'utf8')).replace(/\r\n/g, '\n'));
  const common = modules.map(name => `teleprinter/${name}`).concat('teleprinter/SOURCE-SCOPE.md');
  const scopes = {};
  for (const app of ['landing', 'pipeline', 'atlas']) {
    const selected = app === 'landing' ? ['index.html', 'capsule-launch.js', 'teleprinter-bootstrap.js'] : files.filter(file => file.startsWith(`${app}/`) && !file.startsWith(`${app}/data/`) && /\.(?:html|js|mjs|css)$/.test(file));
    if (app === 'atlas') selected.push('atlas/current.json');
    if (app === 'pipeline') selected.push(...files.filter(file => file.startsWith('pipeline/contracts/') && file.endsWith('.json')));
    scopes[app] = [...new Set([...selected, ...common])].sort().map(file => `${prefix}/${file}`);
  }
  await write('teleprinter/source-scopes.json', JSON.stringify({ generation, predecessor, engineCommit, scopes, excluded: ['atlas/data/**', 'pipeline/data/**', '**/results*', '**/cases*', '**/receipts*', 'inherited detector evidence', 'generated source text, manifests, and pins', 'external runtime dependencies'] }, null, 2) + '\n');
  await requireCandidateSyntax();
  console.log(JSON.stringify({ generation, codeReady: true, launchPaths: [`/testcode/${generation}/`, `/testcode/${generation}/pipeline/`, `/testcode/${generation}/atlas/`], finish: `node sandbox/capsules/teleprinter/build.mjs finish --generation ${generation} --revision FULL_CODE_COMMIT --engine-dir "${engineDir}"` }, null, 2));
} else if (mode === 'finish') {
  if (!options.revision) throw new Error('Finish requires --revision FULL_CODE_COMMIT after source is committed.');
  const commit = git(repo, 'rev-parse', '--verify', '--end-of-options', `${options.revision}^{commit}`).toString().trim();
  const scopePath = `${prefix}/teleprinter/source-scopes.json`;
  const plan = JSON.parse(git(repo, 'show', `${commit}:${scopePath}`).toString('utf8'));
  if (plan.generation !== generation) throw new Error('Source scope generation mismatch.');
  const engineSource = git(engineDir, 'show', `${plan.engineCommit}:drivers/codex/source-code.mjs`);
  const { writeSourceCodeBundle, verifySourceCodeBundleAgainstRepository } = await import(`data:text/javascript;base64,${engineSource.toString('base64')}`);
  const results = [];
  for (const [app, scopes] of Object.entries(plan.scopes)) {
    if (!['landing', 'pipeline', 'atlas'].includes(app) || !Array.isArray(scopes) || !scopes.length || scopes.some(scope => !scope.startsWith(`${prefix}/`) || scope.split('/').includes('..'))) throw new Error('Invalid committed source scopes.');
    // Deployment files must match the pinned code, including uncommitted worktree changes.
    for (const scope of scopes) {
      const committed = git(repo, 'show', `${commit}:${scope}`);
      const present = await readFile(path.join(repo, scope));
      if (!committed.equals(present)) throw new Error(`Source must be committed before finish: ${scope}`);
    }
    const textPath = path.join(generationRoot, `teleprinter/${app}-source-code.txt`);
    const manifestPath = path.join(generationRoot, `teleprinter/${app}-source-code.manifest.json`);
    const repository = 'https://github.com/Ventusltd/testcode';
    const manifest = await writeSourceCodeBundle({ repoDir: repo, revision: commit, repository, paths: scopes, textPath, manifestPath });
    await verifySourceCodeBundleAgainstRepository(await readFile(textPath, 'utf8'), manifest, { repoDir: repo, expectedCommit: commit, expectedRepository: repository, paths: scopes });
    await write(`teleprinter/${app}-source-pin.json`, JSON.stringify({ generation, app, repository, commit, sha256: manifest.sha256, byteCount: manifest.byteCount }, null, 2) + '\n');
    results.push({ app, commit, included: manifest.includedCount, omitted: manifest.omittedCount, bytes: manifest.byteCount });
  }
  await requireCandidateSyntax();
  console.log(JSON.stringify({ generation, sourceReady: true, results }, null, 2));
} else throw new Error('Use prepare or finish.');
