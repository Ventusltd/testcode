import path from 'node:path';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Index standalone source boundaries without concatenating code or executing it. */
export async function buildToolSourceScopes(registry, readManifest, readCandidate) {
  const apps=[];
  for(const tool of registry) {
    const raw=await readManifest(tool.owner);
    if(sha(raw)!==tool.owner.manifestSha256)throw Error('Tool manifest pin mismatch: '+tool.id);
    const manifest=JSON.parse(raw);
    if(manifest.generation!==tool.owner.release)throw Error('Tool release identity mismatch');
    const safe=value=>typeof value==='string'&&!/[\\:%?#]/.test(value)&&!value.split('/').some(part=>!part||part==='.'||part==='..');
    if(!['globalgrid.original-runtime.v1','globalgrid.derived-runtime.v1'].includes(manifest.schema)||!Array.isArray(manifest.applications)||!manifest.applications.length||!Array.isArray(manifest.files)||!manifest.files.length)throw Error('Invalid tool source manifest schema');
    const ids=new Set(),entries=new Set(),paths=new Set();
    for(const item of manifest.applications){if(typeof item.id!=='string'||!item.id||ids.has(item.id)||!safe(item.entry)||entries.has(item.entry))throw Error('Invalid tool source application');ids.add(item.id);entries.add(item.entry);}
    for(const file of manifest.files){if(!safe(file.path)||paths.has(file.path)||!Number.isSafeInteger(file.bytes)||file.bytes<0||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Invalid tool source member');paths.add(file.path);}
    let dependencyManifest=manifest;
    if(manifest.baseline){
      const baseline=manifest.baseline;
      if(!/^[a-f0-9]{40}$/.test(baseline.commit||'')||!/^\d{12}$/.test(baseline.generation||'')||!/^[a-f0-9]{64}$/.test(baseline.manifestSha256||''))throw Error('Invalid baseline dependency pin');
      const original=await readManifest({...tool.owner,commit:baseline.commit,release:baseline.generation,manifestSha256:baseline.manifestSha256});
      if(sha(original)!==baseline.manifestSha256)throw Error('Baseline dependency manifest mismatch');
      dependencyManifest=JSON.parse(original);
      if(dependencyManifest.schema!=='globalgrid.original-runtime.v1'||dependencyManifest.generation!==baseline.generation)throw Error('Baseline dependency identity mismatch');
    }
    for(const record of [manifest,dependencyManifest])for(const key of ['externalLiteralUrls','rootOriginDependencies'])if(record[key]!==undefined&&(!Array.isArray(record[key])||record[key].some(value=>typeof value!=='string')))throw Error('Invalid dependency declarations');
    if(manifest.crossOwnerNavigation!==undefined&&!Array.isArray(manifest.crossOwnerNavigation))throw Error('Invalid navigation declarations');

    const app=manifest.applications?.find(app=>app.id===tool.id);
    if(!app || '../layer-apps/'+app.entry!==tool.entry)throw Error('Tool source entry mismatch');
    const own=path.posix.dirname(app.entry)+'/', others=manifest.applications.filter(a=>a.id!==tool.id).map(a=>path.posix.dirname(a.entry)+'/');
    const selected=manifest.files.filter(file=>file.path.startsWith(own)||!others.some(prefix=>file.path.startsWith(prefix)));
    const files=[],seen=new Set();
    for(const file of selected) {
      if(typeof file.path!=='string'||/[\\:%?#]/.test(file.path)||file.path.split('/').some(part=>!part||part==='.'||part==='..')||seen.has(file.path))throw Error('Unsafe or duplicate tool source path');
      seen.add(file.path);const candidate='layer-apps/'+file.path,bytes=await readCandidate(candidate);
      if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw Error('Composed source differs from owner: '+candidate);
      files.push({path:candidate,bytes:file.bytes,sha256:file.sha256,kind:/\.(?:js|mjs|css|html)$/.test(file.path)?'source':'data'});
    }
    if(!seen.has(app.entry))throw Error('Tool entry absent from source scope');
    apps.push({id:tool.id,title:tool.title,entry:tool.entry,owner:tool.owner,files,
      externalDependencies:manifest.externalLiteralUrls||dependencyManifest.externalLiteralUrls||[],rootOriginDependencies:manifest.rootOriginDependencies||[],
      baselineNavigation:manifest.crossOwnerNavigation||[]});
  }
  return {schema:'ventus.layer-source-scopes.v1',apps,scope:'Each composed standalone tool indexed separately. External and root-origin dependencies are declared, not bundled or verified here. No runtime source concatenation.'};
}
