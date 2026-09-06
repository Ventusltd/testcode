import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--owner', required=True)
parser.add_argument('--commit', required=True)
parser.add_argument('--generation', required=True)
args = parser.parse_args()
assert re.fullmatch('[a-f0-9]{40}', args.commit)
assert re.fullmatch('[0-9]{12}', args.generation)
root = Path(__file__).resolve().parents[2]
destination = root / 'sandbox' / args.generation
assert not destination.exists(), 'Immutable generation already exists'
def blob(name):
    return subprocess.check_output(['git', 'show', args.commit + ':' + name], cwd=args.owner)
def sha(data):
    return hashlib.sha256(data).hexdigest()
def write(name, data):
    target = destination / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
prefix = 'releases/' + args.generation + '/'
manifest_bytes = blob(prefix + 'manifest.json')
manifest = json.loads(manifest_bytes)
assert manifest['generation'] == args.generation and manifest['schema'] == 'cable.legacy-syntax-repair.v1'
for item in manifest['files']:
    assert item['path'].startswith('legacy-cable-geometry/') and '..' not in item['path']
    data = blob(prefix + item['path'])
    assert len(data) == item['bytes'] and sha(data) == item['sha256']
    write('cable/' + item['path'].split('/', 1)[1], data)
write('source-manifest.json', manifest_bytes)
title = 'Restored legacy Cable drawing and export'
write('index.html', ('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      '<title>' + title + '</title><body style="background:#0d1117;color:#7fe3d0;font:18px system-ui;padding:24px">'
      '<h1>' + title + '</h1><p>Original geometry, JSON export and editable inputs, with a reachable Drawing View exit.</p>'
      '<p><a style="color:inherit" href="cable/">Open Cable Geometry</a></p></body></html>').encode('utf-8'))
files = [{'path': file.relative_to(destination).as_posix(), 'bytes': file.stat().st_size, 'sha256': sha(file.read_bytes())}
         for file in sorted(destination.rglob('*')) if file.is_file()]
write('publication.json', (json.dumps({'generation': args.generation, 'lane': 'codex', 'name': title,
      'source_repository': 'Ventusltd/cable-trench-or-drill', 'source_commit': args.commit,
      'status': 'candidate awaiting CI and served-byte checks', 'files': files}, indent=2) + '\n').encode('utf-8'))
print(json.dumps({'generation': args.generation, 'sourceCommit': args.commit, 'files': len(files)}))
