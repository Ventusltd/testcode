import test from 'node:test';
import assert from 'node:assert/strict';
import { indexFamilies } from './estate-index.mjs';
const place = { repo: 'example/repo', commit: 'a'.repeat(40), path: 'app.js', live: 'https://example.test/app/' };
const records = () => [{ n: 2, lines: [9, 10, 9], places: [place], uses: [{ family: 7 }], used_by: [] }, { n: 7, lines: [9, 12], places: [place], uses: [], used_by: [{ family: 2 }] }];
test('indexes every shared line and every membership without changing keys', () => {
  const d = indexFamilies(records(), { A: [2, 7], B: [2] }, 2);
  assert.deepEqual([...d.lines.get(9)], [2, 7]);
  assert.deepEqual([...d.memberships.get(2)], ['A', 'B']);
  assert.deepEqual([...d.live.get(place.live)], [2, 7]);
  assert.equal(d.sources.size, 1);
  assert.equal(d.dangling.length, 0);
});
test('missing advertised records and invalid identities fail', () => {
  assert.throws(() => indexFamilies(records(), {}, 3), /coverage/);
  assert.throws(() => indexFamilies([...records(), records()[0]], {}, 3), /duplicate/);
  assert.throws(() => indexFamilies(records(), { A: [999] }, 2), /absent/);
  const broken = records(); broken[0].places = [{ ...place, commit: 'main' }];
  assert.throws(() => indexFamilies(broken, {}, 2), /Unpinned/);
});
test('unresolved relationships are explicit completeness failures', () => {
  const broken = records(); broken[0].uses.push({ family: 999 });
  assert.deepEqual(indexFamilies(broken, {}, 2).dangling, [{ family: 2, kind: 'uses', target: 999 }]);
});
