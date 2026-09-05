"""Use a pinned, attributed Crown Estate lease area for indicative Morgan screening."""
from pathlib import Path
import json, hashlib, datetime
R=Path(__file__).resolve().parents[1]; D=R/'202609051300'; A=D/'atlas'
def read(p): return p.read_text(encoding='utf-8-sig')
def write(p,s): p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf8',newline='\n')
source=R/'tools/source-data/morgan-crown-estate.geojson'
geo=json.loads(read(source)); assert len(geo['features'])==1
f=geo['features'][0]; assert f['properties']['Name_Prop']=='R4 Project 6 (Morgan)'
ring=f['geometry']['coordinates'][0]; assert len(f['geometry']['coordinates'])==1
# Planar polygon centroid in lon/lat: an explicitly approximate representative
# point, not a turbine, substation, landfall or a surveyed project coordinate.
cross=[p[0]*q[1]-q[0]*p[1] for p,q in zip(ring,ring[1:])]; area2=sum(cross)
lon=sum((p[0]+q[0])*v for p,q,v in zip(ring,ring[1:],cross))/(3*area2)
lat=sum((p[1]+q[1])*v for p,q,v in zip(ring,ring[1:],cross))/(3*area2)
assert -4.3<lon<-3.7 and 53.8<lat<54.2
url='https://services2.arcgis.com/PZklK9Q45mfMFuZs/arcgis/rest/services/WindSite_EngWalNI_TheCrownEstate/FeatureServer/0/query?f=geojson&where=Name_Prop%20like%20%27%25Morgan%25%27&outFields=*&outSR=4326'
meta={'repd_ref':'10919','source':'The Crown Estate, Wind Site Agreements','source_url':url,'source_item':'https://www.arcgis.com/home/item.html?id=22a1be6fb0c5416e9369f97743f387b1','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'retrieved_utc':datetime.datetime.fromtimestamp(source.stat().st_mtime,datetime.timezone.utc).isoformat(),'method':'Planar area-weighted polygon centroid in WGS84 lon/lat; approximate screening origin. Lease boundary, not consented array boundary.','longitude':lon,'latitude':lat,'notice':'Approximate location: Crown Estate lease-area centre. Grid distances are indicative; this is not a turbine, landfall or agreed connection point.'}
write(A/'data/project-areas/10919.geojson',json.dumps(geo,separators=(',',':'))+'\n')
write(A/'data/project-areas/10919-provenance.json',json.dumps(meta,indent=2)+'\n')
p=A/'data/repd-identities/10.json'; data=json.loads(read(p));row=data['10919'];assert row['longitude'] is None and row['latitude'] is None
row.update(longitude=lon,latitude=lat,geometry_status='approximate_lease_area_centre',coordinate_source=meta['source'],location_provenance=meta)
write(p,json.dumps(data,separators=(',',':'))+'\n')
# Keep the name/capacity identity source separate from the geometry provenance.
j=json.loads(read(A/'current.json'))
for c in j['cartridges']:
 if c['id']!='uk-gazetteer-flyto': continue
 p=A/c['path'];s=read(p);needle="        identity_source: exact.identity_source || 'OFFICIAL_ACTIVE_REGISTER',"
 assert needle in s;s=s.replace(needle,"        location_provenance: exact.location_provenance || null,\n"+needle)
 dest='cartridges/202609051300-uk-gazetteer-flyto.js';write(A/dest,s)
 if p.resolve()!=(A/dest).resolve(): p.unlink()
 c.update(path='./'+dest,sha256=hashlib.sha256(s.encode()).hexdigest(),generation='202609051300')
write(A/'current.json',json.dumps(j,indent=2)+'\n')
p=D/'pipeline/scripts/plugins/projects-v9-5-1.js';s=read(p);needle='  const located = atlasCentresOnRepdPointV9_7(project);';assert needle in s
s=s.replace(needle,"  if (String(project.repd_ref) === '10919') return `<a class=\"action-link atlaslink\" target=\"_blank\" rel=\"noopener\" href=\"${escapeHtml(href)}\">MAP &#8599;</a><div class=\"map-note\">Approximate Crown Estate lease-area centre; indicative grid distances.</div>`;\n"+needle);write(p,s)
print(json.dumps(meta,indent=2))
