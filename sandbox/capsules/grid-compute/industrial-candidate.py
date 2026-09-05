"""Join CO2 map clicks to actual grid computation, preserving industrial units."""
from pathlib import Path
import json,shutil,datetime,hashlib
H=Path(__file__).resolve().parent;c=json.loads((H/'candidate.json').read_text());old=c['generation'];G=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M');assert G!=old
D=Path(c['build']).parent/G;O=Path(c['output']).parent/(G+'-grid-compute-100');shutil.copytree(c['build'],D);O.mkdir()
def read(p):return p.read_text(encoding='utf-8-sig')
def write(p,s):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf8',newline='\n')
def dump(p,x):write(p,json.dumps(x,indent=2,ensure_ascii=False)+'\n')
j=json.loads(read(D/'atlas/current.json'))
for cart in j['cartridges']:
 p=D/'atlas'/cart['path'];s=read(p).replace(old,G)
 if cart['id']=='sld-sandbox':
  s=s.replace('  let currentNearest400 = null;','  let currentNearest400 = null;\n  let currentIndustrialEntity = null;',1)
  s=s.replace("return isProjectTech(tech) || feature.layer?.id === SUBS_LAYER_ID;","return isProjectTech(tech) || tech === 'naei_emitter' || feature.layer?.id === SUBS_LAYER_ID;",1)
  needle="        const origin = representativePoint(hit.geometry)\n          || [event.lngLat.lng, event.lngLat.lat];"
  replacement="""        // Rendered GeoJSON features are tile-quantised. Recover the selected
        // source feature before measuring; never use the expected test point.
        const sourceData = map.getSource(hit.source)?._data;
        const candidates = tech === 'naei_emitter' ? (sourceData?.features || []).filter(f =>
          f.properties?.name === properties.name && f.properties?.operator === properties.operator &&
          Math.abs(f.geometry?.coordinates?.[0] - hit.geometry?.coordinates?.[0]) < 0.001 &&
          Math.abs(f.geometry?.coordinates?.[1] - hit.geometry?.coordinates?.[1]) < 0.001) : [];
        const exactHit = candidates.length === 1 ? candidates[0] : null;
        const origin = representativePoint(exactHit?.geometry || hit.geometry)
          || [event.lngLat.lng, event.lngLat.lat];
        currentIndustrialEntity = tech === 'naei_emitter'
          ? {kind:'industrial',id:String(properties.name || '')+'@'+origin.map(n=>n.toFixed(6)).join(',')}
          : null;"""
  assert needle in s;s=s.replace(needle,replacement,1)
  needle="const entity={kind:fromSubstation?'substation':(currentRepdRef?'repd':detector.expected.kind),id:String(currentRepdRef||detector.expected.id)};"
  assert needle in s;s=s.replace(needle,"const entity=currentIndustrialEntity || {kind:fromSubstation?'substation':(currentRepdRef?'repd':detector.expected.kind),id:String(currentRepdRef||detector.expected.id)};",1)
 dest='cartridges/'+G+'-'+cart['id']+'.js';write(D/'atlas'/dest,s);p.unlink();cart.update(path='./'+dest,generation=G,sha256=hashlib.sha256(s.encode()).hexdigest())
j.update(generation=G,previous_generation=old,composition_id=G+'-industrial-grid-compute',live_route='/testcode/'+G+'/atlas/');dump(D/'atlas/current.json',j)
for rel in ['index.html','pipeline/index.html','atlas/source/menu-bar.js']:
 p=D/rel;write(p,read(p).replace(old,G))
manifest=json.loads(read(Path(c['case_manifest'])))
for row in manifest['cases']:
 if row['kind']=='industrial':
  row['source_entity_id']=row['entity_id'];row['entity_id']=row['name']+'@'+format(row['longitude'],'.6f')+','+format(row['latitude'],'.6f');row['identity_method']='Exact source name and WGS84 coordinates; Parquet projection omits the original NAEI ID.'
manifest['generation']=G;dump(O/'cases.json',manifest);dump(D/'cases.json',manifest)
for p in Path(c['output']).glob('*'):
 if p.name in ['grid_substations.geojson','offshore-provenance.json'] or p.name.endswith('wind-sites.geojson'):shutil.copyfile(p,O/p.name)
shutil.copytree(D,Path(c['webroot'])/'testcode'/G)
new={**c,'generation':G,'output':str(O),'build':str(D),'case_manifest':str(O/'cases.json'),'base':c['base'].replace(old,G)};dump(H/'final-candidate.json',new);dump(O/'run.json',new);print(json.dumps(new,indent=2))
