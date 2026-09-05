"""Freeze the sample, source bytes and an instrumented comparison build."""
from pathlib import Path
import json,hashlib,datetime,shutil,html
ROOT=Path('C:/Users/vikra/OneDrive/Documents/GitHub');TC=ROOT/'testcode';HERE=Path(__file__).resolve().parent
G=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M');SEED='grid-compute-100-v1'
OUT=TC/'screenshots'/(G+'-grid-compute-100');OUT.mkdir(parents=True,exist_ok=False)
D=TC/'sandbox'/G;WEB=Path('C:/Users/vikra/globalgrid-testcode-publication')
def read(p):return p.read_text(encoding='utf-8-sig')
def write(p,s):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf8',newline='\n')
def dump(p,x):write(p,json.dumps(x,indent=2,ensure_ascii=False)+'\n')
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
shutil.copytree(TC/'sandbox/202609051300',D,ignore=shutil.ignore_patterns('evidence','PUBLISHED.json','live-*','*console.txt'))
sources=[];pinned={}
for p in (D/'atlas/data/repd-identities').glob('*.json'):
 pinned.update(json.loads(read(p)));sources.append({'path':str(p.relative_to(D)),'sha256':digest(p)})
registry=ROOT/'gridatlas-main-202609050200/data/repd_browser_registry_202608290716.json'
bio=[r for r in json.loads(read(registry))['records'] if r['technology']=='biomass']
sources.append({'path':str(registry),'sha256':digest(registry)})
def located(r):return isinstance(r.get('longitude'),(int,float)) and isinstance(r.get('latitude'),(int,float)) and (r['longitude'] or r['latitude'])
def rank(r):return hashlib.sha256((SEED+str(r['repd_ref'])).encode()).hexdigest()
cases=[]
for tech in ['solar','bess','wind_onshore','wind_offshore','biomass']:
 pool=bio if tech=='biomass' else [r for r in pinned.values() if r['technology']==tech]
 pool=sorted(pool,key=rank);selected=[]
 # Retain known failures and missing locations instead of selecting only good rows.
 forced=['10919','11613','2484','17559','10772'] if tech=='wind_offshore' else (['12588'] if tech=='solar' else [])
 for ref in forced:
  r=next((r for r in pool if str(r['repd_ref'])==ref),None)
  if r:selected.append(r)
 for r in [r for r in pool if not located(r)][:2]+pool:
  if str(r['repd_ref']) not in {str(x['repd_ref']) for x in selected}:selected.append(r)
  if len(selected)==20:break
 assert len(selected)==20
 for r in selected:
  ref=str(r['repd_ref']);cases.append({'case_id':'repd-'+ref,'kind':'repd','entity_id':ref,'technology':tech,'name':r['name'],'longitude':r.get('longitude'),'latitude':r.get('latitude'),'capacity_mw':r.get('capacity_mw'),'repd_technology':r.get('repd_technology',tech),'source':'registry-202608290716' if tech=='biomass' else 'pipeline-pinned-202609051300','geometry_source':r.get('coordinate_source','REPD'),'has_location':bool(located(r))})
assert len(cases)==100 and len({c['entity_id'] for c in cases})==100
industrial=ROOT/'globalgrid2050/heavy_emitters_uk.json';features=json.loads(read(industrial))['features']
features=sorted(features,key=lambda f:hashlib.sha256((SEED+'industrial'+str(f['properties'].get('id'))).encode()).hexdigest())
seen=set()
for f in features:
 p=f['properties'];key=str(p.get('id'));point=f['geometry'].get('coordinates')
 if key in seen or not point or f['geometry']['type']!='Point':continue
 seen.add(key);cases.append({'case_id':'industrial-'+key,'kind':'industrial','entity_id':key,'technology':'naei_emitter','name':p['name'],'longitude':point[0],'latitude':point[1],'emission_tco2e':p.get('emission_tco2e'),'sector':p.get('sector'),'capacity_mw':None,'source':'heavy_emitters_uk.json','has_location':True,'feature':f})
 if len(seen)==10:break
assert len(cases)==110
sources.append({'path':str(industrial),'sha256':digest(industrial)})
subs=ROOT/'gridatlas/atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson'
shutil.copyfile(subs,OUT/'grid_substations.geojson');sources.append({'path':str(subs),'sha256':digest(subs)})
dump(OUT/'cases.json',{'schema':'testcode.grid-compute-cases.v1','seed':SEED,'generation':G,'repd_count':100,'industrial_count':10,'sources':sources,'cases':cases})
dump(D/'cases.json',json.loads(read(OUT/'cases.json')))
engine=ROOT/'ventus-grid-engine/engine'
for name in ['compute-observer.js','v9-geodesy.js','v9-nearest-search.js']:
 shutil.copyfile(engine/name,OUT/'code'/name) if (OUT/'code').exists() else ((OUT/'code').mkdir(),shutil.copyfile(engine/name,OUT/'code'/name))
runtime=read(HERE/'browser-adapter.js')
geodesy=read(engine/'v9-geodesy.js').replace('export ','')
observer=read(engine/'compute-observer.js').replace("import { distanceKm } from './v9-geodesy.js';",'').replace('export ','')
prefix=';(()=>{\nconst {distanceKm}=(()=>{\n'+geodesy+'\nreturn {distanceKm};})();\n'+observer+'\n'+runtime+'\n})();\n'
j=json.loads(read(D/'atlas/current.json'));patches=[]
for c in j['cartridges']:
 p=D/'atlas'/c['path'];s=read(p).replace('202609051300',G)
 if c['id']=='sld-sandbox':
  s=prefix+s
  old='''    async function selectAt(origin, name, tech, fromSubstation, statedMw,
      expectedArrivalEpoch = null) {'''
  new='''    async function selectAtActual(origin, name, tech, fromSubstation, statedMw,
      expectedArrivalEpoch = null, recordComputation = null) {'''
  assert old in s;s=s.replace(old,new,1)
  old="""      drawLinks(map, origin, name, tech,
        nearestSubstations(origin[0], origin[1], subs), 'to-substation', statedMw);"""
  new="""      const measuredLinks = nearestSubstations(origin[0], origin[1], subs);
      recordComputation?.({search_completed:true,scanned_count:subs.length, measurements:[...measuredLinks,currentNearest400].filter(Boolean).map(row=>({node_id:row.name || ('coordinate:'+row.at.join(',')),lon:row.at[0],lat:row.at[1],km:row.km}))});
      drawLinks(map, origin, name, tech, measuredLinks, 'to-substation', statedMw);"""
  assert old in s;s=s.replace(old,new,1)
  old='    link.selectAt = selectAt;'
  new='''    async function selectAt(origin,name,tech,fromSubstation,statedMw,expectedArrivalEpoch=null) {
      const detector=window.__TESTCODE_GRID_DETECTOR__;
      const entity={kind:fromSubstation?'substation':(currentRepdRef?'repd':detector.expected.kind),id:String(currentRepdRef||detector.expected.id)};
      const id=detector.request({entity,location:{lon:origin[0],lat:origin[1]},operation:'Atlas selectAt / nearest-grid',dataset:'grid_substations.geojson'});
      let originalReturn;await detector.run(id,async request=>{
        let result=null;
        originalReturn=await selectAtActual(origin,name,tech,fromSubstation,statedMw,expectedArrivalEpoch,value=>{result=value;});
        if(!result)throw new Error('Actual selection returned without completing a grid measurement');
        return {...result,entity:request.entity,origin:request.location};
      });return originalReturn;
    }
    link.selectAt = selectAt;'''
  assert old in s;s=s.replace(old,new,1);patches.append('Wrapper at actual selectAt closure, receipt from actual nearestSubstations + nearestTransmission return values; original return retained.')
 if s!=read(p):
  dest=f'cartridges/{G}-{c["id"]}.js';write(D/'atlas'/dest,s);p.unlink();c.update(path='./'+dest,sha256=hashlib.sha256(s.encode()).hexdigest(),generation=G)
j.update(generation=G,previous_generation='202609051300',composition_id=G+'-compute-detector',live_route='/testcode/'+G+'/atlas/');dump(D/'atlas/current.json',j)
for p in [D/'pipeline/index.html',D/'atlas/source/menu-bar.js']:write(p,read(p).replace('202609051300',G))
dump(D/'detector-build.json',{'generation':G,'predecessor':'202609051300','patches':patches,'engine_sources':{n:digest(engine/n) for n in ['compute-observer.js','v9-geodesy.js']},'purpose':'Observe actual computation; missing data and unsupported click paths retained as failures.'})
rows=''.join('<tr><td>'+html.escape(c['case_id'])+'</td><td>'+html.escape(c['technology'])+'</td><td>'+html.escape(c['name'])+'</td><td><button data-case="'+c['case_id']+'">Visit</button></td></tr>' for c in cases)
write(D/'index.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test Code compute detector '+G+'</title><style>body{background:#08151c;color:#e6f4f4;font:16px system-ui;margin:24px}td,th{padding:10px;border-bottom:1px solid #456}button,a{font:inherit;color:#9eeaff;background:#152c36;padding:12px}table{width:100%}</style><h1>Grid computation detector '+G+'</h1><p>100 distinct REPD records, 20 per technology; 10 industrial CO2 cases counted separately. A rendered map is not a computation receipt.</p><a href="pipeline/">Pipeline News</a><table><thead><tr><th>Case</th><th>Technology</th><th>Project</th><th>Visit</th></tr></thead><tbody>'+rows+'</tbody></table><script src="capsule-launch.js"></script>')
write(D/'capsule-launch.js',read(HERE/'capsule-launch.js'))
shutil.copytree(D,WEB/'testcode'/G)
config={'generation':G,'output':str(OUT),'build':str(D),'webroot':str(WEB),'base':'http://127.0.0.1:8877/testcode/'+G+'/','case_manifest':str(OUT/'cases.json')}
dump(HERE/'latest.json',config);dump(OUT/'run.json',config)
for p in HERE.glob('*'):
 if p.is_file():shutil.copyfile(p,OUT/'code'/p.name)
print(json.dumps(config,indent=2))
