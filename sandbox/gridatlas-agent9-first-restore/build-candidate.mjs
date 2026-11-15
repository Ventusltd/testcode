/**
 * Agent9 isolated candidate cartridge builder.  Reads EXACT historical bytes,
 * writes a NEW test artifact. DOES NOT edit GridAtlas or current.json.
 * Fail closed on every missing/duplicate anchor and source SHA drift.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
const input=process.argv[2],outDir=resolve(process.argv[3]||'agent9-candidate');
if(!input)throw Error('FAIL: explicit historical cartridge path required');
const oldBytes=readFileSync(input);
const hash=x=>createHash('sha256').update(x).digest('hex');
const originalHash='7812953671d8bb22a566de5e98fd3137da2d23411c5aecd526df5afa111ca4ca';
if(hash(oldBytes)!==originalHash)throw Error('FAIL: original SHA drift');
let source=oldBytes.toString('utf8');
const edits=[];
function replaceOnce(name,from,to){
 const a=source.indexOf(from);
 if(a<0||source.indexOf(from,a+from.length)>=0)throw Error('FAIL anchor '+name+' missing/duplicate');
 source=source.slice(0,a)+to+source.slice(a+from.length);
 edits.push(name);
}
// State belongs to a selection, NOT a DOM measurement pass. Changing popup
// instances during the same selection must keep the user choice.
replaceOnce('state-controller-insert',
 '  function addCardBar(content) {',
 [
  "  let agent9SelectionToken = 0;",
  "  let agent9UserChoice = null;",
  "  function agent9SyncCard(content) {",
  "    const popup = content?.closest?.('.maplibregl-popup');",
  "    if (!popup) return;",
  "    let initial = false;",
  "    try { initial = Boolean(sheetTarget()); } catch (_) { initial = false; }",
  "    const collapsed = agent9UserChoice === null ? initial : agent9UserChoice === 'collapsed';",
  "    popup.classList.toggle('gridatlas-min', collapsed);",
  "    const bar = content.querySelector('.gridatlas-card-bar');",
  "    const button = bar?.querySelector('button.min');",
  "    if (button) {",
  "      button.textContent = collapsed ? '+' : '−';",
  "      button.setAttribute('aria-expanded', String(!collapsed));",
  "      button.setAttribute('aria-label', collapsed ? 'Show project measurements' : 'Hide project measurements');",
  "      button.title = collapsed ? 'Show project measurements' : 'Hide project measurements';",
  "      button.style.minWidth = '44px';",
  "      button.style.minHeight = '44px';",
  "    }",
  "  }",
  "",
  "  function addCardBar(content) {"
 ].join('\n'));
replaceOnce('existing-bar-sync',
 "    if (content.querySelector('.gridatlas-card-bar')) { boundCardToMap(); return; }",
 "    if (content.querySelector('.gridatlas-card-bar')) { agent9SyncCard(content); boundCardToMap(); return; }");
replaceOnce('bar-initial-sync',
 "    content.insertBefore(bar, content.firstChild);",
 "    content.insertBefore(bar, content.firstChild);\n    agent9SyncCard(content);");
replaceOnce('one-tap-user-precedence',
 [
  "    bar.querySelector('.min').addEventListener('click', (event) => {",
  "      event.stopPropagation();",
  "      popup.classList.toggle('gridatlas-min');",
  "      bar.querySelector('.min').innerHTML = popup.classList.contains('gridatlas-min')",
  "        ? '&plus;' : '&minus;';"
 ].join('\n'),
 [
  "    bar.querySelector('.min').addEventListener('click', (event) => {",
  "      event.stopPropagation();",
  "      event.preventDefault();",
  "      agent9UserChoice = popup.classList.contains('gridatlas-min') ? 'expanded' : 'collapsed';",
  "      agent9SyncCard(content);"
 ].join('\n'));
replaceOnce('same-selection-preserves-choice',
 [
  "    if (arriveMinimised) popup.classList.add('gridatlas-min');",
  "    else popup.classList.remove('gridatlas-min');"
 ].join('\n'),
 [
  "    const actuallyMinimised = agent9UserChoice === null",
  "      ? arriveMinimised : agent9UserChoice === 'collapsed';",
  "    popup.classList.toggle('gridatlas-min', actuallyMinimised);"
 ].join('\n'));
replaceOnce('late-reset-preserves-explicit-drag',
 [
  "    const popup = content?.closest?.('.maplibregl-popup');",
  "    if (!popup) return;",
  "    popup.classList.remove('gridatlas-free');"
 ].join('\n'),
 [
  "    const popup = content?.closest?.('.maplibregl-popup');",
  "    if (!popup) return;",
  "    if (agent9UserChoice === null) popup.classList.remove('gridatlas-free');"
 ].join('\n'));
replaceOnce('late-reset-preserves-geometry',
 [
  "    popup.classList.toggle('gridatlas-min', actuallyMinimised);",
  "    popup.style.removeProperty('--gx');",
  "    popup.style.removeProperty('--gy');"
 ].join('\n'),
 [
  "    popup.classList.toggle('gridatlas-min', actuallyMinimised);",
  "    if (agent9UserChoice === null) {",
  "      popup.style.removeProperty('--gx');",
  "      popup.style.removeProperty('--gy');",
  "    }"
 ].join('\n'));
replaceOnce('reset-synchronises-aria',
 "    if (toggle) toggle.innerHTML = arriveMinimised ? '&plus;' : '&minus;';",
 "    if (toggle) agent9SyncCard(content);");
replaceOnce('clear-disarms-choice',
 "  function clearLinks() {\n    invalidatePendingArrival('clear');",
 "  function clearLinks() {\n    agent9SelectionToken++;\n    agent9UserChoice = null;\n    invalidatePendingArrival('clear');");
replaceOnce('new-selection-clears-choice',
 [
  "    async function selectAt(origin, name, tech, fromSubstation, statedMw,",
  "      expectedArrivalEpoch = null) {",
  "      const fromCurrentArrival = Number.isInteger(expectedArrivalEpoch);"
 ].join('\n'),
 [
  "    async function selectAt(origin, name, tech, fromSubstation, statedMw,",
  "      expectedArrivalEpoch = null) {",
  "      const agent9MyToken = ++agent9SelectionToken;",
  "      agent9UserChoice = null;",
  "      const fromCurrentArrival = Number.isInteger(expectedArrivalEpoch);"
 ].join('\n'));
replaceOnce('stale-arrival-cannot-overwrite-newer-project',
 "      drawLinks(map, origin, name, tech,\n        nearestSubstations(origin[0], origin[1], subs), 'to-substation', statedMw);",
 "      if (agent9MyToken !== agent9SelectionToken) return false;\n      drawLinks(map, origin, name, tech,\n        nearestSubstations(origin[0], origin[1], subs), 'to-substation', statedMw);");
replaceOnce('card-keeper-token-binding',
 "    cardKeeperPayload = { links, direction, layerLoaded };",
 "    cardKeeperPayload = { links, direction, layerLoaded, token: agent9SelectionToken };");
replaceOnce('card-keeper-stale-reject',
 "        if (!payload) return;",
 "        if (!payload || payload.token !== agent9SelectionToken) return;");
replaceOnce('raf-late-selection-reject',
 "      requestAnimationFrame(() => injectIntoCard(links, direction, layerLoaded));",
 [
  "      const agent9ExpectedToken = agent9SelectionToken;",
  "      requestAnimationFrame(() => {",
  "        if (agent9ExpectedToken === agent9SelectionToken)",
  "          injectIntoCard(links, direction, layerLoaded);",
  "      });"
 ].join('\n'));
const out=join(outDir,'agent9-sld-mobile-restore-candidate.js');
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,source,'utf8');
const record={
 schema:'agent9.testcode.candidate.v1',
 evidence_class:'OFFLINE BUILT CANDIDATE; NOT HOSTED PREVIEW, NOT REAL BROWSER, NOT RELEASE',
 origin_source_sha256:originalHash,
 candidate_sha256:hash(Buffer.from(source)),
 original_repo_commit:'4c52780c04a90608d8a072172138b9063e5a4684',
 original_generation:'202611132345',
 edits,artifact:out,
 prohibits_mutation:['gridatlas/atlas/current.json','gridatlas/STATE.md','globalgrid2050','homepage']
};
writeFileSync(join(outDir,'candidate-manifest.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record));
