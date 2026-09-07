#!/usr/bin/env python3
"""Construct a new test-only app pair from exact Git blobs, with explicit adaptations."""
import datetime as dt
import hashlib
import json
import posixpath
from pathlib import Path
import re
import subprocess
import sys
import os

ROOT=Path(__file__).resolve().parents[1]
SOURCES=Path(os.environ.get('GRIDMACHINE_SOURCES','/home/vikram/GitHub'))
STAMP=sys.argv[1] if len(sys.argv)>1 else dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
assert re.fullmatch(r'\d{8}T\d{6}Z',STAMP)
PAIR='GGPAIR-GM02-'+STAMP
DEST=ROOT/'sandbox/gm02'/STAMP
if DEST.exists(): raise SystemExit('Candidate already exists; allocate a new timestamp')
DEST.mkdir(parents=True)
def git(repo,*args): return subprocess.check_output(['git','-C',str(SOURCES/repo),*args])
PINS=json.loads((ROOT/'tools/pair-inputs.json').read_text())
PROVENANCE=[]
def read(repo,path): return git(repo,'show',PINS[repo]+':'+path)
def write(path,b):
    p=DEST/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b.encode() if isinstance(b,str) else b)
def copy(repo,source,target):
    b=read(repo,source);write(target,b)
    PROVENANCE.append({'repository':'Ventusltd/'+repo,'commit':PINS[repo],'source':source,'target':target,'source_sha256':hashlib.sha256(b).hexdigest()})
    return b
def tree(repo,path):return git(repo,'ls-tree','-r','--name-only',PINS[repo],'--',path).decode().splitlines()
def edit(path,old,new):
    p=DEST/path;s=p.read_text();assert old in s,(path,old[:70]);p.write_text(s.replace(old,new),encoding='utf-8')

PIPE='uk_renewables_pipeline/202609071221'
for p in tree('globalgrid2050',PIPE):
    rel=p[len(PIPE)+1:]
    if rel=='index.html' or rel.startswith(('scripts/','styles/','contracts/','data/')):copy('globalgrid2050',p,'pipeline/'+rel)
for name in ['major_project_news_v5.json','major_project_news_v6.json','major_project_news_v9_5_1.json']:
    copy('globalgrid2050','dist/'+name,'pipeline/data/shared/'+name)
for p in (DEST/'pipeline/scripts').rglob('*.js'):
    p.write_text(p.read_text().replace('../../dist/','data/shared/'))
for p in tree('gridatlas','atlas/releases/202608300453-atlas-v9'):
    copy('gridatlas',p,'atlas/runtime/'+p.removeprefix('atlas/'))
for p in tree('gridatlas','atlas/data'):copy('gridatlas',p,'atlas/runtime/'+p.removeprefix('atlas/'))
lane='atlas/v/202609071232'
copy('gridatlas',lane+'/index.html','atlas/index.html')
current=json.loads(read('gridatlas',lane+'/current.json'))
for c in current['cartridges']:
    path=posixpath.normpath(posixpath.join(lane,c['path']))
    b=copy('gridatlas',path,'atlas/runtime/'+path.removeprefix('atlas/'))
    assert hashlib.sha256(b).hexdigest()==c['sha256'],path
    c['source_sha256']=c['sha256'];c['path']='./runtime/'+path.removeprefix('atlas/')
    if c['id']=='sld-sandbox':
        target='atlas/'+c['path'].removeprefix('./')
        old='  const EARTH_KM = 6371.0088;'
        edit(target,old,'  const EARTH_KM = window.__GGPAIR_ENGINE__.EARTH_RADIUS_KM;')
        start=(DEST/target).read_text().index('  function haversineKm(lon1, lat1, lon2, lat2) {', (DEST/target).read_text().index('const EARTH_KM'))
        s=(DEST/target).read_text();end=s.index('\n  }',start)+4
        s=s[:start]+'''  function haversineKm(lon1, lat1, lon2, lat2) {
    window.__GGPAIR__.engine_calls++;
    return window.__GGPAIR_ENGINE__.distanceKm(lon1, lat1, lon2, lat2);
  }'''+s[end:]
        (DEST/target).write_text(s)
    c['sha256']=hashlib.sha256((DEST/'atlas'/c['path']).read_bytes()).hexdigest()
    c['bytes']=(DEST/'atlas'/c['path']).stat().st_size
current.update(generation=STAMP,composition_id=PAIR,live_route='./',pair_id=PAIR)
current['shell']={'release_id':current['shell']['release_id'],'index':'./runtime/releases/202608300453-atlas-v9/index.html','base':'./runtime/releases/202608300453-atlas-v9/'}
write('atlas/current.json',json.dumps(current,indent=2)+'\n')
copy('ventus-grid-engine','engine/v9-geodesy.js','engine/v9-geodesy.js')
copy('ventus-grid-engine','LICENSE','engine/LICENSE')
copy('ventus-grid-engine','NOTICE','engine/NOTICE')
write('package.json','{"type":"module","private":true}\n')
for repo in ['globalgrid2050','gridatlas']:
    for name in ['LICENSE','NOTICE']:
        try:copy(repo,name,'attribution/'+repo+'/'+name)
        except subprocess.CalledProcessError:pass

# Explicit test receiver: retain production identity construction/withdrawal logic,
# but bind both compiled and verified receiver paths to this paired Atlas.
receiver='pipeline/scripts/core/atlas-receiver-v9-7.js'
edit(receiver,'const RECEIVERS_URL = "https://ventusltd.github.io/ventus-grid-engine/deeplink/receivers.json";',
'''const PAIR_ATLAS = new URL("../../../atlas/", import.meta.url).href;
const RECEIVERS_URL = new URL("../../../receivers.json", import.meta.url).href;'''.replace('../../../','../../../../'))
# core is pipeline/scripts/core: three parent segments reach the pair root.
edit(receiver,'../../../../atlas/','../../../atlas/')
edit(receiver,'../../../../receivers.json','../../../receivers.json')
edit(receiver,'route: "https://ventusltd.github.io/gridatlas/atlas/",','route: PAIR_ATLAS,')
# The JSON contract route is resolved against its fetch URL before validation.
edit(receiver,'const live = await response.json();','const live = await response.json();\n      live.canonical.route = new URL(live.canonical.route, RECEIVERS_URL).href;')
write('receivers.json',json.dumps({'schema':'ventus.grid-engine.deeplink-receivers.v1','canonical':{'id':PAIR,'route':'./atlas/','carries_engine':True},'retired':[],'pair_id':PAIR},indent=2)+'\n')
write('pair-runtime.js',f'''import * as engine from './engine/v9-geodesy.js';
window.__GGPAIR_ENGINE__=engine;
window.__GGPAIR__={{pair_id:{json.dumps(PAIR)},engine_commit:{json.dumps(PINS['ventus-grid-engine'])},engine_calls:0}};
document.documentElement.dataset.ggpair={json.dumps(PAIR)};
''')
edit('atlas/index.html','    try {','    try {\n      await import("../pair-runtime.js");')
# document.open replaces the DOM; publish the pair sentinel into the composed document too.
edit('atlas/index.html','window.__GRIDATLAS_ATLAS__=${publicState};','window.__GRIDATLAS_ATLAS__=${publicState};document.documentElement.dataset.ggpair='+json.dumps(PAIR)+';')
edit('pipeline/index.html','</head>','<script type="module" src="../pair-runtime.js"></script>\n</head>')
edit('pipeline/index.html','href="https://ventusltd.github.io/gridatlas/atlas/"','href="../atlas/"')
# Pipeline's displayed interconnector span consumes the same engine module.
link='pipeline/scripts/core/atlas-interconnector-link-v9-8.js'
edit(link,'import { atlasReceiverV9_7,', 'import { distanceKm } from "../../../engine/v9-geodesy.js";\nimport { atlasReceiverV9_7,')
# Preserve missing-coordinate semantics; calculate only from the actual converter inputs.
edit(link,'${record.span.straight_line_km}', '${distanceKm(record.gb_end.longitude,record.gb_end.latitude,record.far_end.longitude,record.far_end.latitude).toFixed(3)}')
# Rebuild span measurements with the pinned JS primitive and re-sign the partition.
subprocess.run(['node','--input-type=module','-e',r'''
import fs from 'node:fs';
const root=process.argv[1];const {distanceKm,EARTH_RADIUS_KM}=await import('file://'+root+'/engine/v9-geodesy.js');
const file=root+'/pipeline/data/v9.8/interconnectors.json';const d=JSON.parse(fs.readFileSync(file));
for(const r of d.records){if(r.gb_end&&r.far_end&&r.span){
 const a=r.gb_end,b=r.far_end;const km=distanceKm(a.longitude,a.latitude,b.longitude,b.latitude);
 r.span.straight_line_km=Number(km.toFixed(3));r.span.earth_radius_km=EARTH_RADIUS_KM;
 if(r.span.known_submarine_cable_km)r.span.route_factor=Number((r.span.known_submarine_cable_km/km).toFixed(6));
 const g=r.span.great_circle_midpoint;if(g)r.span.midpoints_differ_km=Number(distanceKm(r.longitude,r.latitude,g.longitude,g.latitude).toFixed(3));
}}
fs.writeFileSync(file,JSON.stringify(d,null,2)+'\n');
''',str(DEST)],check=True)
mp=DEST/'pipeline/data/v9.8/interconnectors_manifest.json';m=json.loads(mp.read_text());m['partition']['sha256']=hashlib.sha256((DEST/'pipeline/data/v9.8/interconnectors.json').read_bytes()).hexdigest();m['test_pair_id']=PAIR;mp.write_text(json.dumps(m,indent=2)+'\n')

manifest={'schema':'testcode.pair.v1','pair_id':PAIR,'timestamp':STAMP,'implementation_lane':'gm02','parent_pair_id':None,
 'source_commits':PINS,'engine_binding':{'repository':'Ventusltd/ventus-grid-engine','commit':PINS['ventus-grid-engine'],'module':'engine/v9-geodesy.js','consumption':'Atlas interconnector haversineKm and Pipeline span display/build call pinned distanceKm; other pre-existing engine functions retain their baseline implementation'},
 'pipeline':'pipeline/','gridatlas':'atlas/','product_verdict':'NOT_RUN','production_approval':'NOT_RECORDED',
 'limitations':['External map/data dependencies remain to be measured and pinned by runtime receipts.','This candidate does not claim all historical MAP buttons or every direction has passed.'],
 'source_files':PROVENANCE,'files':[]}
write('index.html',f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{PAIR}</title><style>body{{background:#0b1622;color:#e3f1fa;font:18px/1.6 system-ui;max-width:1000px;margin:50px auto;padding:24px}}a{{color:#6edccb}}.pair{{display:grid;grid-template-columns:1fr 1fr;gap:24px}}article{{padding:24px;border:1px solid #345365;border-radius:12px}}code{{overflow-wrap:anywhere;font-size:14px}}</style><p>GLOBALGRID2050 · GRID MACHINE TEST PAIR</p><h1>PipelineNews × GridAtlas</h1><code>{PAIR}</code><div class="pair"><article><h2>PipelineNews</h2><a href="pipeline/">Open PipelineNews →</a></article><article><h2>GridAtlas</h2><a href="atlas/">Open GridAtlas →</a></article></div><p>Test candidate. Production approval is not recorded.</p><p><a href="pair.json">Exact version vector and hashes</a></p></html>''')
for p in sorted(DEST.rglob('*')):
    if p.is_file():manifest['files'].append({'path':p.relative_to(DEST).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size})
write('pair.json',json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'pair_id':PAIR,'directory':str(DEST),'files':len(manifest['files']),'bytes':sum(f['bytes'] for f in manifest['files'])}))
