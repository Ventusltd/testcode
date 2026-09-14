// Draft conformance boundary for read-only electrical-system evidence graphs.
const kinds = new Set(['project', 'substation', 'equipment', 'terminal', 'scenario', 'quantity', 'calculation', 'evidence', 'decision', 'family', 'line', 'block']);
const relations = new Set(['contains', 'uses', 'used-by', 'shares-line', 'canonical', 'nearest-geographic', 'connected-to', 'publishes', 'calculated-by', 'supported-by', 'under-scenario', 'concerns']);
const need = (ok, message) => { if (!ok) throw new Error(message); };
const digest = value => /^[a-f0-9]{64}$/.test(value || '');
const commit = value => /^[a-f0-9]{40}$/.test(value || '');
function provenance(p, label) {
  need(p && /^https:\/\//.test(p.url || '') && digest(p.sha256) && Number.isFinite(Date.parse(p.retrieved_utc)), label + ': source URL, hash and retrieval time required');
}
export function validate(graph) {
  need(graph?.schema === 'spider-energy/0.1-draft', 'Unknown protocol version');
  need(graph.read_only === true, 'Spider must remain read-only');
  need(['fixture', 'published'].includes(graph.mode), 'Explicit fixture or published mode required');
  need(Array.isArray(graph.nodes) && graph.nodes.length && Array.isArray(graph.edges), 'Missing graph input');
  const nodes = new Map();
  for (const n of graph.nodes) {
    need(kinds.has(n.type) && typeof n.id === 'string' && n.id.startsWith(n.type + ':'), 'Typed stable ID required');
    need(n.id.length > n.type.length + 1 && !nodes.has(n.id), 'Empty or duplicate ID: ' + n.id);
    need(typeof n.label === 'string' && n.label.trim(), n.id + ': label required');
    if (n.type === 'family' || n.type === 'line') need(new RegExp('^' + n.type + ':(0|[1-9][0-9]*)$').test(n.id), 'Permanent code key required');
    if (n.type === 'family') {
      need(n.keyspace === 'stars/code', 'Historical graph numbers are not code-family keys');
      need(n.source && commit(n.source.commit) && n.source.repo && n.source.path, 'Family source must be pinned');
    }
    if (n.type === 'quantity') {
      need(['published', 'modelled', 'missing', 'fixture'].includes(n.status), 'Quantity status required');
      need(n.metric && n.unit && n.basis, 'Quantity metric, unit and basis required');
      if (n.status === 'missing') need(!Object.hasOwn(n, 'value'), 'Missing quantity cannot have a value');
      else need(Number.isFinite(n.value), 'Finite quantity value required');
      if (n.status === 'published') provenance(n.provenance, n.id);
      if (n.status === 'modelled') need(n.scenario && n.calculation && digest(n.inputs_sha256), 'Modelled quantity needs scenario, calculation and input hash');
      if (n.status === 'fixture') need(graph.mode === 'fixture', 'Fixture values cannot be published as observations');
    }
    if (graph.mode === 'published' && ['project', 'substation', 'equipment', 'terminal', 'evidence'].includes(n.type)) provenance(n.provenance, n.id);
    if (n.child_path) need(!n.child_path.includes('..') && !n.child_path.startsWith('/') && !n.child_path.includes('://'), 'Child path must stay within its generation');
    nodes.set(n.id, n);
  }
  for (const e of graph.edges) {
    need(nodes.has(e.from) && nodes.has(e.to), 'Dangling relationship');
    need(relations.has(e.type), 'Unknown relationship: ' + e.type);
    if (e.type === 'nearest-geographic') {
      need(nodes.get(e.from).type === 'project' && nodes.get(e.to).type === 'substation', 'Nearest relation must join project to substation');
      need(e.unit === 'km' && Number.isFinite(e.value) && e.value >= 0 && Number.isFinite(e.radius_m) && e.radius_m > 0, 'Distance must name kilometres and radius');
      need(commit(e.algorithm_commit) && e.method === 'great-circle-exhaustive', 'Distance must name pinned exhaustive algorithm');
      need(!Object.hasOwn(e, 'capacity') && !Object.hasOwn(e, 'headroom') && !Object.hasOwn(e, 'connected'), 'Geographic proximity cannot assert capacity or connection');
    }
    if (e.type === 'connected-to') {
      need(nodes.get(e.from).type === 'terminal' && nodes.get(e.to).type === 'terminal', 'Electrical connection needs terminal endpoints');
      need(e.scenario && nodes.get(e.scenario)?.type === 'scenario', 'Electrical connection needs an explicit scenario');
      provenance(e.provenance, 'Electrical connection');
    }
  }
  for (const n of nodes.values()) if (n.type === 'quantity' && n.status === 'modelled') {
    need(nodes.get(n.scenario)?.type === 'scenario' && nodes.get(n.calculation)?.type === 'calculation', 'Unresolved quantity model context');
    need(graph.edges.some(e => e.from === n.id && e.to === n.calculation && e.type === 'calculated-by'), 'Missing calculation relationship');
  }
  return { nodes: nodes.size, edges: graph.edges.length, mode: graph.mode };
}
