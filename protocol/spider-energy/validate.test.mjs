import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './validate.mjs';
import { fixture } from './fixture.mjs';
import { toSpider } from './spider-adapter.mjs';
test('accepts explicit synthetic graph and keeps missing headroom unknown', () => {
  assert.deepEqual(validate(fixture), { nodes: 5, edges: 3, mode: 'fixture' });
});
const negative = (name, mutate, pattern) => test(name, () => { const g = structuredClone(fixture); mutate(g); assert.throws(() => validate(g), pattern); });
negative('rejects duplicate permanent identity', g => g.nodes.push(g.nodes[3]), /duplicate/);
negative('rejects historical number substituted for code key', g => g.nodes[3].keyspace = 'electron', /Historical/);
negative('rejects dangling relationship', g => g.edges[2].to = 'line:999', /Dangling/);
negative('rejects proximity promoted to capacity', g => g.edges[0].capacity = 100, /proximity/);
negative('rejects a value invented for missing headroom', g => g.nodes[2].value = 0, /Missing quantity/);
negative('rejects electrical connection inferred from a geographic edge', g => g.edges[0].type = 'connected-to', /terminal/);
negative('rejects unpinned distance algorithm', g => g.edges[0].algorithm_commit = 'main', /pinned/);
negative('rejects fixture promoted to publication without provenance', g => g.mode = 'published', /source URL/);
negative('rejects a child path escaping the generation', g => g.nodes[0].child_path = '../older.json', /generation/);
test('Spider projection preserves every primary key and relationship', () => {
  const graph = toSpider(fixture);
  assert.deepEqual(graph.nodes.map(n => n.id), fixture.nodes.map(n => n.id));
  assert.deepEqual(graph.edges, fixture.edges);
  assert.ok(graph.nodes.every(n => n.reason.includes('Synthetic fixture')));
  assert.ok(graph.nodes.every(n => !n.gh));
});
