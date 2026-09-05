"""Preserve the failing baseline; add attributed offshore areas and missing drawn results."""
from pathlib import Path
import json,hashlib,datetime,shutil
H=Path(__file__).resolve().parent
cfg=json.loads((H/'latest.json').read_text()); old=cfg['generation']
G=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M')
assert G!=old
D=Path(cfg['build']).parent/G; O=Path(cfg['output']).parent/(G+'-grid-compute-100')
shutil.copytree(cfg['build'],D); O.mkdir()
def read(p): return p.read_text(encoding='utf-8-sig')
def write(p,s): p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf8',newline='\n')
def dump(p,x): write(p,json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
manifest=json.loads(read(Path(cfg['case_manifest'])))
joins=[('11613','crown-estate-scotland-wind-sites.geojson','OBJECTID_1',24,'Property_Description','Buchan Offshore Wind Farm','Crown Estate Scotland','https://www.arcgis.com/home/item.html?id=1f27fd9899e04cebbf40779ba75f69f5'),('11109','crown-estate-wind-sites.geojson','OBJECTID',58,'Name_Prop','R4 Project 2 (Dogger Bank South East)','The Crown Estate','https://www.arcgis.com/home/item.html?id=22a1be6fb0c5416e9369f97743f387b1'),('13735','crown-estate-scotland-wind-sites.geojson','OBJECTID_1',31,'Property_Description','Spiorad na Mara','Crown Estate Scotland','https://www.arcgis.com/home/item.html?id=1f27fd9899e04cebbf40779ba75f69f5')]
provenance=[]
for ref,file,idkey,fid,namekey,name,owner,url in joins:
 source=Path(cfg['output'])/file; geo=json.loads(read(source))
 f=next(f for f in geo['features'] if f['properties'][idkey]==fid)
 assert f['properties'][namekey]==name, f['properties']
 geom=f['geometry'];polys=[geom['coordinates']] if geom['type']=='Polygon' else geom['coordinates']
 # Signed ring moments, with exterior areas positive and interior areas negative.
 moments=[]
 for poly in polys:
  for i,ring in enumerate(poly):
   pairs=list(zip(ring,ring[1:]));cross=[p[0]*q[1]-q[0]*p[1] for p,q in pairs];a=sum(cross)
   if not a: continue
   x=sum((p[0]+q[0])*v for (p,q),v in zip(pairs,cross))/(3*a)
   y=sum((p[1]+q[1])*v for (p,q),v in zip(pairs,cross))/(3*a)
   moments.append((abs(a)*(1 if i==0 else -1),x,y))
 area=sum(m[0] for m in moments);lon=sum(a*x for a,x,y in moments)/area;lat=sum(a*y for a,x,y in moments)/area
 assert -10<lon<5 and 49<lat<62
 meta={'repd_ref':ref,'source':owner,'source_url':url,'source_sha256':sha(source),'source_feature_id':fid,'source_feature_name':name,'retrieved_utc':datetime.datetime.fromtimestamp(source.stat().st_mtime,datetime.timezone.utc).isoformat(),'method':'Planar area-weighted polygon centroid in WGS84; approximate screening origin, not a surveyed turbine, landfall or agreed grid connection.','longitude':lon,'latitude':lat,'notice':'Approximate location: '+owner+' lease-area centre. Grid distances are indicative; this is not a turbine, landfall or agreed connection point.'}
 if ref=='11613':meta.update(identity_evidence='https://buchanoffshorewind.com/project/',capacity_note='REPD retains 1000 MW; Crown Estate Scotland polygon lists 960 MW. Capacity was not overwritten.')
 shard=D/'atlas/data/repd-identities'/(str(int(ref)//1000)+'.json'); data=json.loads(read(shard));row=data[ref]
 assert row.get('longitude') is None and row.get('latitude') is None
 row.update(longitude=lon,latitude=lat,geometry_status='approximate_lease_area_centre',coordinate_source=owner,location_provenance=meta);dump(shard,data)
 dump(D/('atlas/data/project-areas/'+ref+'.geojson'),{'type':'FeatureCollection','features':[f]});dump(D/('atlas/data/project-areas/'+ref+'-provenance.json'),meta)
 c=next(c for c in manifest['cases'] if c['entity_id']==ref);c.update(longitude=lon,latitude=lat,has_location=True,geometry_source=owner,location_provenance=meta)
 shutil.copyfile(source,O/file);provenance.append(meta)
j=json.loads(read(D/'atlas/current.json'))
for c in j['cartridges']:
 p=D/'atlas'/c['path'];s=read(p).replace(old,G)
 if c['id']=='sld-sandbox':
  needle="    if (direction === 'to-substation' && currentDeclared?.at) {"
  assert needle in s
  s=s.replace(needle,"""    // Draw the measured transmission result even beyond the 40 km nearby search.
    // This is indicative straight-line screening, never an agreed connection.
    if (direction === 'to-substation' && currentNearest400?.at &&
        !links.some(l => l.at[0] === currentNearest400.at[0] && l.at[1] === currentNearest400.at[1])) {
      const t = currentNearest400;
      lines.push({type:'Feature',properties:{colour:'#ffd166',strength:0.75,km:t.km,role:'indicative-nearest-transmission'},geometry:{type:'LineString',coordinates:[origin,t.at]}});
      nodes.push({type:'Feature',properties:{colour:'#ffd166',label:`Indicative 400 kV · ${t.km.toFixed(2)} km`},geometry:{type:'Point',coordinates:t.at}});
    }
"""+needle,1)
  s=s.replace("+' | '+record.status.toUpperCase()", "+' | ENGINE '+record.status.toUpperCase()")
 dest='cartridges/'+G+'-'+c['id']+'.js';write(D/'atlas'/dest,s)
 if p!=D/'atlas'/dest:p.unlink()
 c.update(path='./'+dest,generation=G,sha256=hashlib.sha256(s.encode()).hexdigest())
j.update(generation=G,previous_generation=old,composition_id=G+'-offshore-compute-results',live_route='/testcode/'+G+'/atlas/');dump(D/'atlas/current.json',j)
for rel in ['index.html','pipeline/index.html','atlas/source/menu-bar.js']:
 p=D/rel;write(p,read(p).replace(old,G))
p=D/'pipeline/scripts/plugins/projects-v9-5-1.js';s=read(p);s=s.replace("String(project.repd_ref) === '10919'", "['10919','11613','11109','13735'].includes(String(project.repd_ref))");write(p,s)
manifest.update(generation=G,baseline_generation=old);dump(O/'cases.json',manifest);dump(D/'cases.json',manifest);dump(O/'offshore-provenance.json',provenance)
shutil.copyfile(Path(cfg['output'])/'grid_substations.geojson',O/'grid_substations.geojson')
shutil.copytree(D,Path(cfg['webroot'])/'testcode'/G)
new={**cfg,'generation':G,'output':str(O),'build':str(D),'base':cfg['base'].replace(old,G),'case_manifest':str(O/'cases.json')};dump(H/'candidate.json',new);dump(O/'run.json',new)
print(json.dumps(new,indent=2))
