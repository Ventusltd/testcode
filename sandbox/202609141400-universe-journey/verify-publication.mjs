import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = new URL('./', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('publication.json', root), 'utf8'));
assert.deepEqual(Object.keys(manifest.files).sort(), ['core.js', 'index.html', 'journey.css', 'journey.js']);
for (const [name, expected] of Object.entries(manifest.files)) {
  const bytes = readFileSync(new URL(name, root));
  assert.equal(bytes.length, expected.bytes, name + ' byte count');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, name + ' sha256');
  console.log('Verified ' + name);
}
