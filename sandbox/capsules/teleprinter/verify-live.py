"""Verify published Test Code bytes and homepage. No screenshot/PDF artifacts."""
from pathlib import Path
import sys,subprocess,urllib.request,hashlib,json,datetime,time,concurrent.futures
repo=Path(sys.argv[1]);generation=sys.argv[2];output=Path(sys.argv[3]);base='https://www.globalgrid2050.com/'
commit=subprocess.check_output(['git','-C',str(repo),'rev-parse','HEAD'],text=True).strip()
prefix='testcode/'+generation+'/'
paths=subprocess.check_output(['git','-C',str(repo),'ls-tree','-r','--name-only',commit,'--',prefix],text=True).splitlines()
paths=[p for p in paths if not any(part.startswith('.') for part in p.split('/'))]
assert len(paths)>100
expected_index=subprocess.check_output(['git','-C',str(repo),'show',commit+':'+prefix+'index.html'])
for attempt in range(45):
    try:
        actual=urllib.request.urlopen(base+prefix+'index.html',timeout=15).read()
        if actual==expected_index:break
    except Exception:pass
    if attempt%3==0:print('Waiting for published Teleprinter '+generation,flush=True)
    time.sleep(20)
else:raise SystemExit('Committed generation not yet served after 15 minutes.')
def check(p):
    expected=subprocess.check_output(['git','-C',str(repo),'show',commit+':'+p])
    try:
        response=urllib.request.urlopen(urllib.request.Request(base+p,headers={'Cache-Control':'no-cache'}),timeout=45)
        actual=response.read()
        return {'path':p,'bytes':len(actual),'matches_commit':actual==expected,'sha256':hashlib.sha256(actual).hexdigest()}
    except Exception as error:return {'path':p,'matches_commit':False,'error':str(error)}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:results=list(pool.map(check,paths+['index.html']))
record={'checked_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'generation':generation,'files':len(results),'matching':sum(x['matches_commit'] for x in results),'results':results}
output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:v for k,v in record.items() if k!='results'}),flush=True)
if any(not x['matches_commit'] for x in results):
    print(json.dumps([x for x in results if not x['matches_commit']]),flush=True)
    raise SystemExit(1)
