"""Freeze browser-neutral industrial data delivery and public-safe local logging."""
from pathlib import Path
import json,shutil,datetime,hashlib
H=Path(__file__).resolve().parent;c=json.loads((H/'final-candidate.json').read_text());old=c['generation'];G=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M');assert G!=old
D=Path(c['build']).parent/G;O=Path(c['output']).parent/(G+'-grid-compute-100');shutil.copytree(c['build'],D);O.mkdir()
def read(p):return p.read_text(encoding='utf-8-sig')
def write(p,s):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf8',newline='\n')
def dump(p,x):write(p,json.dumps(x,indent=2,ensure_ascii=False)+'\n')
source=Path('C:/Users/vikra/OneDrive/Documents/GitHub/globalgrid2050/heavy_emitters_uk.json');dest=D/'atlas/data/heavy_emitters_uk.json';shutil.copyfile(source,dest)
j=json.loads(read(D/'atlas/current.json'))
for cart in j['cartridges']:
 p=D/'atlas'/cart['path'];s=read(p).replace(old,G)
 if cart['id']=='streaming-parquet-bridge':
  needle='    const readyKey = mapReadyKey(pathname);';assert needle in s
  s=s.replace(needle,"""    // A pinned 722 KB GeoJSON keeps industrial identities and works without
    // a second-origin Parquet/WASM round trip before a site can be selected.
    if (legacyStem(pathname) === 'heavy_emitters_uk') {
      return nativeFetch(new URL('./data/heavy_emitters_uk.json', location.href), {...(init || {}), cache:'force-cache'});
    }
"""+needle,1)
 if cart['id']=='sld-sandbox':
  s=s.replace("fetch(new URL('/__testcode/receipt'", "if(['127.0.0.1','localhost'].includes(location.hostname))fetch(new URL('/__testcode/receipt'",1)
  s=s.replace("const entity=currentIndustrialEntity ||", "const entity=(tech === 'naei_emitter' ? currentIndustrialEntity : null) ||",1)
  s=s.replace("id:String(properties.name || '')+'@'+origin.map(n=>n.toFixed(6)).join(',')", "id:properties.id != null ? String(properties.id) : String(properties.name || '')+'@'+origin.map(n=>n.toFixed(6)).join(',')",1)
  s=s.replace('bottom:3px;left:190px;right:160px;', 'bottom:3px;left:8px;right:8px;max-height:28px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;')
 if cart['id']=='substation-intelligence':
  needle=" if (!new URLSearchParams(location.search).get('repd_ref')) return;\n document.documentElement.classList.add('testcode-arrival');"
  assert needle in s;s=s.replace(needle," // The same usable layout also applies when opening industrial layers.\n document.documentElement.classList.add('testcode-arrival');",1)
 dest='cartridges/'+G+'-'+cart['id']+'.js';write(D/'atlas'/dest,s);p.unlink();cart.update(path='./'+dest,generation=G,sha256=hashlib.sha256(s.encode()).hexdigest())
j.update(generation=G,previous_generation=old,composition_id=G+'-grid-compute-capsule',live_route='/testcode/'+G+'/atlas/');dump(D/'atlas/current.json',j)
for rel in ['index.html','pipeline/index.html','atlas/source/menu-bar.js']:
 p=D/rel;write(p,read(p).replace(old,G))
manifest=json.loads(read(Path(c['case_manifest'])))
for row in manifest['cases']:
 if row['kind']=='industrial':row.update(entity_id=row['source_entity_id'],identity_method='Original NAEI ID retained in pinned same-origin GeoJSON.')
manifest['generation']=G;dump(O/'cases.json',manifest);dump(D/'cases.json',manifest)
for p in Path(c['output']).glob('*'):
 if p.name in ['grid_substations.geojson','offshore-provenance.json'] or p.name.endswith('wind-sites.geojson'):shutil.copyfile(p,O/p.name)
meta=json.loads(read(D/'detector-build.json'));meta.update(generation=G,predecessor=old,engine_commit='f9531a7',screenshots='disabled by user; coded observations only',industrial_data={'source':str(source),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'bytes':source.stat().st_size},patches=meta['patches']+['Draw measured nearest transmission outside 40 km local search.','Crown Estate and Crown Estate Scotland attributed approximate areas for three unresolved offshore records.','Industrial clicks compute using actual source coordinates and original NAEI identity.','Same-origin industrial GeoJSON avoids Parquet dependency for map selection.']);dump(D/'detector-build.json',meta)
shutil.copytree(D,Path(c['webroot'])/'testcode'/G)
new={**c,'generation':G,'output':str(O),'build':str(D),'case_manifest':str(O/'cases.json'),'base':c['base'].replace(old,G)};dump(H/'publish-candidate.json',new);dump(O/'run.json',new);print(json.dumps(new,indent=2))
