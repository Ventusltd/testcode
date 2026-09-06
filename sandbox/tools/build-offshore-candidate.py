"""Compose the reviewed offshore correction over the tested Atlas controls release."""
import datetime
import hashlib
import json
import os
import sys
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
OWNER = pathlib.Path(os.environ.get('GRIDATLAS_OWNER_REPO', 'C:/Users/vikra/atlas-offshore-scope-20260906'))
PARENT = '202609060228'
NOW = datetime.datetime.now(datetime.timezone.utc)
GEN = NOW.strftime('%Y%m%d%H%M')
DEST = ROOT / 'sandbox' / GEN

def blob(repo, path, sha='HEAD'):
    return subprocess.check_output(['git', '-C', str(repo), 'show', f'{sha}:{path}'])

def digest(data):
    return hashlib.sha256(data).hexdigest()

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data.encode('utf-8') if isinstance(data, str) else data)

def function(source, name):
    start = source.index('  function ' + name + '(')
    end = source.index('\n  }', start) + 4
    return source[start:end]

def verify_candidate(generation):
    assert len(generation) == 12 and generation.isdigit(), 'Invalid candidate generation'
    candidate = ROOT / 'sandbox' / generation
    manifest = json.loads((candidate / 'publication.json').read_bytes())
    assert manifest['generation'] == generation
    expected_files = {item['path'] for item in manifest['files']}
    actual_files = {p.relative_to(candidate).as_posix() for p in candidate.rglob('*') if p.is_file()}
    assert actual_files == expected_files | {'publication.json'}, 'Publication file closure differs'
    for item in manifest['files']:
        raw = (candidate / item['path']).read_bytes()
        assert len(raw) == item['bytes'] and digest(raw) == item['sha256'], item['path']
    current = json.loads((candidate / 'atlas/current.json').read_bytes())
    pin = current['testcode_increment']
    assert current['generation'] == generation
    assert pin['source_functions'] == ['corridorBeside', 'openCorridorSheet']
    assert manifest['source_commit'] == pin['owner_commit']
    owner = blob(OWNER, pin['owner_path'], pin['owner_commit'])
    assert digest(owner) == pin['owner_sha256'], 'Owner source identity mismatch'
    parent = json.loads(blob(ROOT, f"sandbox/{manifest['parent']}/atlas/current.json"))
    old = next(c for c in parent['cartridges'] if c['id'] == 'sld-sandbox')
    original = blob(ROOT, 'sandbox/' + old['path'].removeprefix('/testcode/'))
    assert digest(original) == old['sha256'] == pin['parent_cartridge_sha256']
    expected = original.decode()
    source = owner.decode()
    for name in pin['source_functions']:
        previous = function(expected, name)
        assert expected.count(previous) == 1
        expected = expected.replace(previous, function(source, name), 1)
    start = source.index('  const OFFSHORE_CORRIDOR_NOTE =')
    end = source.index('  function corridorBeside', start)
    expected = expected.replace('  function corridorBeside', source[start:end] + '  function corridorBeside', 1)
    cartridge = next(c for c in current['cartridges'] if c['id'] == 'sld-sandbox')
    actual = (candidate / 'atlas' / cartridge['path']).read_bytes()
    assert actual == expected.encode() and digest(actual) == cartridge['sha256'], 'Consumer differs from reviewed owner transformation'
    for c in current['cartridges']:
        relative = c['path']
        dependency = ROOT / 'sandbox' / relative.removeprefix('/testcode/') if relative.startswith('/testcode/') else candidate / 'atlas' / relative
        raw = blob(ROOT, dependency.relative_to(ROOT).as_posix()) if relative.startswith('/testcode/') else dependency.read_bytes()
        assert digest(raw) == c['sha256'], 'Dependency identity mismatch: ' + relative
    print(json.dumps({'generation':generation,'source_commit':pin['owner_commit'],'files':len(expected_files),'provenance':'PASS'}))

if '--verify-generation' in sys.argv:
    verify_candidate(sys.argv[sys.argv.index('--verify-generation') + 1])
    sys.exit(0)
assert not DEST.exists(), 'A published generation cannot be overwritten'

owner_sha = subprocess.check_output(['git', '-C', str(OWNER), 'rev-parse', 'HEAD']).decode().strip()
source_path = 'atlas/parts/202609060246-sld-sandbox-offshore-corridor-scope.js'
source_bytes = blob(OWNER, source_path, owner_sha)
source = source_bytes.decode()
current = json.loads(blob(ROOT, f'sandbox/{PARENT}/atlas/current.json'))
cartridge = next(c for c in current['cartridges'] if c['id'] == 'sld-sandbox')
baseline_path = 'sandbox/' + cartridge['path'].removeprefix('/testcode/')
baseline_bytes = blob(ROOT, baseline_path)
assert digest(baseline_bytes) == cartridge['sha256'], 'Parent source hash mismatch'
updated = baseline_bytes.decode()
for name in ['corridorBeside', 'openCorridorSheet']:
    old = function(updated, name)
    assert updated.count(old) == 1, 'Ambiguous consumer boundary'
    updated = updated.replace(old, function(source, name), 1)
note_start = source.index('  const OFFSHORE_CORRIDOR_NOTE =')
note_end = source.index('  function corridorBeside', note_start)
updated = updated.replace('  function corridorBeside', source[note_start:note_end] + '  function corridorBeside', 1)
updated_bytes = updated.encode()
cartridge.update(path=f'./cartridges/{GEN}-sld-sandbox.js', generation=GEN,
                 sha256=digest(updated_bytes), version='testcode-' + GEN)
current.update(generation=GEN, previous_generation=PARENT,
               composition_id=GEN + '-testcode-atlas', live_route=f'/testcode/{GEN}/atlas/')
current['testcode_increment'] = {
    'change': 'Keep offshore straight-line measurements without highway corridor factors',
    'owner_commit': owner_sha, 'owner_path': source_path,
    'owner_sha256': digest(source_bytes), 'parent_cartridge_sha256': digest(baseline_bytes),
    'source_functions': ['corridorBeside', 'openCorridorSheet'],
    'status': 'candidate awaiting browser, CI and served-byte verification',
}
write(DEST / 'atlas' / cartridge['path'].removeprefix('./'), updated_bytes)
write(DEST / 'atlas/current.json', json.dumps(current, indent=2) + '\n')
for name in ['index.html', 'map-controls-layout.js', 'teleprinter-bootstrap.js']:
    data = blob(ROOT, f'sandbox/{PARENT}/atlas/{name}')
    if name == 'index.html':
        data = data.replace(('Test Code Atlas ' + PARENT).encode(), ('Test Code Atlas ' + GEN).encode())
    write(DEST / 'atlas' / name, data)
# Identity shards remain relative to the consumer; retain the exact baseline bytes.
paths = subprocess.check_output(['git', '-C', str(ROOT), 'ls-tree', '-r', '--name-only', 'HEAD',
                                f'sandbox/{PARENT}/atlas/data/repd-identities']).decode().splitlines()
for path in paths:
    write(DEST / 'atlas/data/repd-identities' / pathlib.Path(path).name, blob(ROOT, path))
write(DEST / 'index.html', f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GridAtlas {GEN}</title><body style="background:#0d1117;color:#7fe3d0;font:18px system-ui;padding:24px"><h1>GridAtlas {GEN}</h1><p>Offshore projects retain measured straight-line distances. Highway-derived corridor estimates are withheld for offshore export routes.</p><p><a style="color:inherit" href="atlas/">Open GridAtlas</a></p><p><a style="color:inherit" href="/testcode/202609060232/pipeline/">Open Pipeline News</a></p></body></html>''')
manifest = {'generation': GEN, 'lane': 'codex', 'name': current['testcode_increment']['change'],
            'builtUTC': NOW.isoformat(), 'parent': PARENT, 'source_commit': owner_sha,
            'status': 'candidate awaiting browser and served-byte checks', 'files': []}
for path in sorted(DEST.rglob('*')):
    if path.is_file():
        data = path.read_bytes()
        manifest['files'].append({'path': path.relative_to(DEST).as_posix(), 'bytes': len(data), 'sha256': digest(data)})
write(DEST / 'publication.json', json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'generation': GEN, 'owner_commit': owner_sha, 'files': len(manifest['files']),
                  'cartridge_sha256': digest(updated_bytes)}))
