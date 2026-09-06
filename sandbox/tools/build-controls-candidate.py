"""Publish a thin Atlas composition over the immutable 1906 baseline."""
import datetime, hashlib, json, pathlib, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
REPO=ROOT.parent
GEN=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M')
DEST=ROOT/GEN
assert not DEST.exists(), 'Use a fresh UTC generation'
BASE='202609051906'
def blob(p): return subprocess.check_output(['git','-C',str(REPO),'show','HEAD:'+p])
def write(p,b):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_bytes(b.encode() if isinstance(b,str) else b)
current=json.loads(blob(f'sandbox/{BASE}/atlas/current.json'))
current.update(generation=GEN,previous_generation=BASE,composition_id=GEN+'-testcode-atlas',live_route=f'/testcode/{GEN}/atlas/')
for item in current['cartridges']:
    item['path']=f'/testcode/{BASE}/atlas/'+item['path'].removeprefix('./')
current['layout_cartridge']={'path':'./map-controls-layout.js','purpose':'Tools above Layers; unobstructed menus; readable address search; Elements label'}
layout=blob('sandbox/capsules/tool-layers/map-controls-layout.js')
current['layout_cartridge']['sha256']=hashlib.sha256(layout).hexdigest()
write(DEST/'atlas/map-controls-layout.js',layout)
write(DEST/'atlas/current.json',json.dumps(current,indent=2)+'\n')
index=blob(f'sandbox/{BASE}/atlas/index.html').decode().replace('Test Code Atlas '+BASE,'Test Code Atlas '+GEN)
write(DEST/'atlas/index.html',index)
write(DEST/'atlas/teleprinter-bootstrap.js',f"import '/testcode/{BASE}/atlas/teleprinter-bootstrap.js';\nimport {{mountMapControlsLayout}} from './map-controls-layout.js';\nmountMapControlsLayout();\n")
# Small identity shards are the only location-relative data in the reused search cartridge.
paths=subprocess.check_output(['git','-C',str(REPO),'ls-tree','-r','--name-only','HEAD',f'sandbox/{BASE}/atlas/data/repd-identities']).decode().splitlines()
for p in paths: write(DEST/'atlas/data/repd-identities'/pathlib.Path(p).name,blob(p))
write(DEST/'index.html',f'<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atlas controls {GEN}</title><body style="background:#0d1117;color:#7fe3d0;font:18px system-ui;padding:24px"><h1>GridAtlas {GEN}</h1><p>Tools above Layers, clear dropdown menus, wider address search and Elements.</p><p><a style="color:inherit" href="atlas/">Open GridAtlas</a></p><p><a style="color:inherit" href="/testcode/202609060213/pipeline/">Open Pipeline News with Cearn</a></p></body></html>')
manifest={'generation':GEN,'status':'candidate awaiting browser and served-byte checks','source_commit':subprocess.check_output(['git','-C',str(REPO),'rev-parse','HEAD']).decode().strip(),'parent':BASE,'files':[]}
for p in sorted(DEST.rglob('*')):
    if p.is_file():
        b=p.read_bytes();manifest['files'].append({'path':p.relative_to(DEST).as_posix(),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
write(DEST/'publication.json',json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'generation':GEN,'files':len(manifest['files']),'bytes':sum(f['bytes'] for f in manifest['files'])}))
