/** Resolve actual composed destinations; historical navigation declarations remain separate. */
export function buildNavigationRegistry(config) {
  if(!Array.isArray(config?.owners) || !Array.isArray(config?.tools))throw Error('Navigation owners and tools are required');
  const pin=owner=>{
    if(!owner || typeof owner.repository!=='string' || !owner.repository.trim() || !/^[a-f0-9]{40}$/.test(owner.commit||'') || !/^\d{12}$/.test(owner.release||'') || !/^[a-f0-9]{64}$/.test(owner.manifestSha256||''))throw Error('Complete navigation owner pin required');
    return {repository:owner.repository,commit:owner.commit,release:owner.release,manifestSha256:owner.manifestSha256};
  };
  const identity=owner=>JSON.stringify(pin(owner));
  const entryFor=app=>{
    if(typeof app?.id!=='string' || !app.id || typeof app.entry!=='string' || /[\\:%?#]/.test(app.entry) || app.entry.split('/').some(p=>!p || p==='.' || p==='..'))throw Error('Unsafe navigation application path');
    return '../layer-apps/'+app.entry;
  };
  const candidates=new Map();
  for(const owner of config.owners) {
    const bound=pin(owner);
    if(!Array.isArray(owner.applications))throw Error('Owner applications required');
    for(const app of owner.applications) {
      const entry=entryFor(app), key=identity(bound)+'\n'+entry;
      if(!candidates.has(app.id))candidates.set(app.id,new Map());
      candidates.get(app.id).set(key,{id:app.id,entry,owner:bound});
    }
  }
  const explicit=new Map();
  for(const tool of config.tools) {
    if(explicit.has(tool.id))throw Error('Duplicate explicit navigation tool: '+tool.id);
    const options=[...(candidates.get(tool.id)?.values()||[])];
    const matches=options.filter(item=>identity(item.owner)===identity(tool.owner) && item.entry===tool.entry);
    if(matches.length!==1)throw Error('Explicit tool does not match a composed owner/application: '+tool.id);
    explicit.set(tool.id,{...matches[0],title:tool.title || tool.id,owner:pin(tool.owner)});
  }
  const entries=[],paths=new Set();
  for(const [id,options] of candidates) {
    let resolved=explicit.get(id);
    if(!resolved) {
      if(options.size!==1)throw Error('Ambiguous unlaunched navigation owner: '+id);
      resolved={...options.values().next().value,title:id==='dc-ac-lv-topology-review'?'DC/AC LV Topology Review':id};
    }
    if(paths.has(resolved.entry))throw Error('Multiple applications share a navigation destination: '+resolved.entry);
    paths.add(resolved.entry);entries.push({...resolved,owner:pin(resolved.owner)});
  }
  return entries;
}
