import { validate } from './validate.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Projection only: the richer protocol envelope remains the evidence source.
export function toSpider(protocol) {
  validate(protocol);
  return {
    id: 'energy-transition', title: protocol.mode === 'fixture' ? 'Energy transition protocol — synthetic fixture' : 'Energy transition evidence',
    protocol: protocol.schema, read_only: true,
    nodes: protocol.nodes.map(n => ({
      id: n.id, label: n.label, type: n.type, rag: 'grey',
      reason: `<b>${esc(n.id)}</b><br>${n.type === 'quantity' ? esc(n.status === 'missing' ? 'No published figure recorded' : `${n.value} ${n.unit} · ${n.status}`) : esc(n.type)}${protocol.mode === 'fixture' ? '<br>Synthetic fixture; no real asset measurement.' : ''}`,
      gh: n.type === 'family' && protocol.mode === 'published' ? `https://github.com/${n.source.repo}/blob/${n.source.commit}/${n.source.path}` : null,
      ext: n.provenance?.url || null,
      ...(n.child_path ? { child_path: n.child_path } : {}),
    })),
    edges: protocol.edges.map(e => ({ ...e })),
  };
}
