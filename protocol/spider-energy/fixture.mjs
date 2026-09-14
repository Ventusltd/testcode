// Synthetic protocol fixture. These values describe no actual electrical asset.
export const fixture = {
  schema: 'spider-energy/0.1-draft', read_only: true, mode: 'fixture',
  nodes: [
    { id: 'project:fixture-p1', type: 'project', label: 'Synthetic generation project' },
    { id: 'substation:fixture-s1', type: 'substation', label: 'Synthetic substation' },
    { id: 'quantity:fixture-headroom', type: 'quantity', label: 'No published headroom recorded', metric: 'published-headroom', unit: 'MW', basis: 'No source record supplied', status: 'missing' },
    { id: 'family:2', type: 'family', keyspace: 'stars/code', label: 'Permanent key reference; fixture source', source: { repo: 'example/fixture', path: 'distance.js', commit: '0'.repeat(40) } },
    { id: 'line:9', type: 'line', label: 'Permanent line key reference' },
  ],
  edges: [
    { from: 'project:fixture-p1', to: 'substation:fixture-s1', type: 'nearest-geographic', value: 1.25, unit: 'km', radius_m: 6371000, algorithm_commit: '0'.repeat(40), method: 'great-circle-exhaustive' },
    { from: 'substation:fixture-s1', to: 'quantity:fixture-headroom', type: 'contains' },
    { from: 'family:2', to: 'line:9', type: 'contains' },
  ],
};
