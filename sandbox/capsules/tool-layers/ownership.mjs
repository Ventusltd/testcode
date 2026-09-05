/** Resolve one explicit producer per tool while retaining historical bundle manifests. */
export function mergeToolOwnership(previous, owner, applications, names = {}) {
  const pin = ({repository,commit,release,manifestSha256}) => ({repository,commit,release,manifestSha256});
  const combined = new Map(previous.tools.map(tool => {
    if (tool.owner) return [tool.id,tool];
    const candidates = previous.owners.filter(item => item.applications.some(app => app.id === tool.id));
    if (candidates.length !== 1) throw Error(`Ambiguous historical owner for ${tool.id}`);
    return [tool.id,{...tool,owner:pin(candidates[0])}];
  }));
  for (const app of applications) combined.set(app.id, {
    id:app.id,title:names[app.id] || app.id,entry:'../layer-apps/'+app.entry,owner:pin(owner)
  });
  return {owners:previous.owners.filter(item=>item.repository!==owner.repository).concat(owner),tools:[...combined.values()]};
}
