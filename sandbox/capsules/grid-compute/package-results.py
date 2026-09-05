"""Publish compact observations and code; never include screenshots."""
from pathlib import Path
import json,hashlib,datetime,shutil,subprocess,html,re,sys
H=Path(__file__).resolve().parent;TC=H.parents[2];cfg=json.loads((H/'publish-candidate.json').read_text());G=cfg['generation'];O=Path(cfg['output']);D=Path(cfg['build']);WEB=Path(cfg['webroot']);SRC=Path('C:/Users/vikra/testcode-source-publication')
def read(p):return p.read_text(encoding='utf-8-sig')
def dump(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
report=json.loads(read(O/'backend-browser-report.json'));cross=json.loads(read(O/'cross-browser-report.json'))
assert report.get('finished_utc') and report['counts']['tested']==110
assert cross.get('finished_utc') and cross['counts']['tested']==35
assert len({r['case_id'] for r in report['checks'] if r['kind']=='repd'})==100
def compact(r):
 keys=['case_id','name','kind','technology','browser','browser_version','visit_id','url','passed','outcome','engine_fired','map_result_drawn','investigation','checks']
 d={k:r.get(k) for k in keys};latest=r.get('latest') or {};d['measurement_origin']=latest.get('location');d['measurements']=latest.get('measurements');d['engine_events']=latest.get('events');d['map_geometry']=r.get('raw',{}).get('presentation');d['error']=r.get('error');return d
summary={'schema':'testcode.grid-compute-observations.v1','generation':G,'finished_utc':report['finished_utc'],'repd':{'tested':100,'passed':sum(r['passed'] for r in report['checks'] if r['kind']=='repd')},'industrial':{'tested':10,'passed':sum(r['passed'] for r in report['checks'] if r['kind']=='industrial')},'cross_browser':cross['counts'],'screenshots':'Disabled and deleted by user instruction; none included in this release.','limits':['Missing coordinates are failures, not omitted cases.','Windows WebKit and mobile emulation are not real Safari/iPhone or Android hardware.','Industrial selection is tested at zoom 17 to distinguish neighbouring sites.','Distances are indicative screening, not agreed grid connections.'],'checks':[compact(r) for r in report['checks']],'browser_checks':[compact(r) for r in cross['checks']]}
dump(O/'results.json',summary);dump(D/'results.json',summary)
base=TC/'screenshots/202609051320-grid-compute-100/backend-browser-report.json';baseline=json.loads(read(base));dump(O/'baseline-summary.json',{'generation':'202609051320','counts':baseline['counts'],'checks':[compact(r) for r in baseline['checks']]})
visits=json.loads(read(TC/'screenshots/202609051329-grid-compute-100/codex-chrome-visits.json'))
for v in visits:
 v.pop('saved',None);v.update(screenshot='deleted at user request',method='Actual connected Chrome extension; Pipeline search then MAP click; DOM observation and actual computation receipt recorded; tab closed.')
 observed=read(TC/('screenshots/202609051329-grid-compute-100/codex-repd-'+v['ref']+'.txt'));match=re.search(r'visit-\d+-[a-f0-9]+',observed)
 assert match,'Missing correlated receipt for '+v['ref']
 receipt=TC/('screenshots/202609051320-grid-compute-100/receipts/'+match.group()+'.jsonl');events=[json.loads(line) for line in read(receipt).splitlines()];actual=events[-1]['record']
 v.update(visit_id=match.group(),engine_status=actual['status'],entity=actual['entity'],location=actual['location'],measurements=actual.get('measurements'),engine_events=actual['events'],visible_observation=next((line for line in observed.splitlines() if 'Nearest 400 kV substation:' in line),'No nearest-substation paragraph'),dom_observation_sha256=hashlib.sha256(observed.encode()).hexdigest())
dump(O/'extension-visits.json',{'generation':'202609051329','count':len(visits),'visits':visits})
code=O/'code';code.mkdir(exist_ok=True)
for p in H.iterdir():
 if p.suffix in ['.mjs','.cjs','.js','.py','.ps1','.md']:shutil.copyfile(p,code/p.name)
dump(O/'code-sha256.json',{p.name:digest(p) for p in code.iterdir() if p.is_file()})
failure_rows=''.join('<li>'+html.escape(r['case_id']+' — '+r['name']+' — '+r['outcome'])+'</li>' for r in report['checks'] if not r['passed'])
p=D/'index.html';s=read(p);needle='<h1>Grid computation detector '+G+'</h1>';assert needle in s
notice=needle+'<p><strong>Measured result: '+str(summary['repd']['passed'])+'/100 REPD and '+str(summary['industrial']['passed'])+'/10 industrial cases passed.</strong> '+str(cross['counts']['passed'])+'/35 representative cross-browser visits passed. Missing coordinates remain failed; no screenshots are stored.</p><p><a href="results.json">Read the coded observations</a> · <a href="https://github.com/Ventusltd/testcode/tree/main/sandbox/capsules/grid-compute">Detector code</a></p><details open><summary>Failures retained in the test</summary><ul>'+failure_rows+'</ul></details>'
s=s.replace(needle,notice,1);p.write_text(s,encoding='utf8',newline='\n')
shutil.copytree(D,WEB/'testcode'/G,dirs_exist_ok=True)
shutil.copytree(D,SRC/'sandbox'/G,dirs_exist_ok=True)
capsule=SRC/'sandbox/capsules/grid-compute';capsule.mkdir(parents=True,exist_ok=True)
for p in code.iterdir():shutil.copyfile(p,capsule/p.name)
shutil.copyfile(H/'publish-candidate.json',capsule/'publish-candidate.json')
ev=capsule/'results'/G;ev.mkdir(parents=True,exist_ok=True)
for name in ['results.json','baseline-summary.json','extension-visits.json','code-sha256.json','offshore-provenance.json']:shutil.copyfile(O/name,ev/name)
if (O/'final-chrome-observations.json').exists():shutil.copyfile(O/'final-chrome-observations.json',ev/'final-chrome-observations.json')
for p in O.glob('*wind-sites.geojson'):shutil.copyfile(p,ev/p.name)
# Measure and save a restore point before editing homepage navigation.
home=WEB/'index.html';before=read(home);versions=WEB/'homepage_versions';files=list(versions.glob('homepage_v*.html'));n=max(int(p.stem.split('_v')[1]) for p in files)+1;snapshot=versions/f'homepage_v{n:03}.html'
measurement={'file_count':len(list(versions.iterdir())),'html_version_file':snapshot.name,'line_count':len(before.splitlines()),'word_count':len(before.split()),'character_count':len(before),'sha256':digest(home),'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=WEB,text=True).strip(),'intention':'Append the measured grid-compute Test Code candidate and retain earlier comparison links; remove screenshot claims after user-requested deletion.'};dump(versions/(snapshot.stem+'-measurement.json'),measurement);shutil.copyfile(home,snapshot)
assert '<h2>Test Code</h2>' in before
entry='<h2>Test Code</h2>\n<p><a href="./testcode/'+G+'/">Grid compute detector — '+G+' UTC</a>: 100 REPD records plus 10 industrial sites; '+str(summary['repd']['passed'])+'/100 REPD and '+str(summary['industrial']['passed'])+'/10 industrial cases pass. <a href="./testcode/'+G+'/results.json">Coded results and remaining failures</a>. No screenshots retained.</p>'
after=before.replace('<h2>Test Code</h2>',entry,1).replace('five Chrome MAP journeys with screenshots; Morgan uses an attributed approximate lease-area centre.','earlier comparison build; superseded by the detector above. Screenshot files were removed.')
home.write_text(after,encoding='utf8',newline='\n')
subprocess.run([sys.executable,str(H/'release-metadata.py')],check=True)
print(json.dumps({'generation':G,'repd':summary['repd'],'industrial':summary['industrial'],'cross_browser':summary['cross_browser'],'result_bytes':(D/'results.json').stat().st_size,'snapshot':str(snapshot)},indent=2))
