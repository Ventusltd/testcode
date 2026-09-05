"""Compare every deployed candidate byte with its committed source; no screenshots."""
import urllib.request,urllib.error,hashlib,subprocess,time,json,datetime,concurrent.futures
from pathlib import Path
H=Path(__file__).resolve().parent;cfg=json.loads((H/'publish-candidate.json').read_text());repo=Path(cfg['webroot']);gen=cfg['generation'];prefix='testcode/'+gen+'/';base='https://www.globalgrid2050.com/'
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
paths=subprocess.check_output(['git','ls-tree','-r','--name-only',commit,'--',prefix],cwd=repo,text=True).splitlines();assert len(paths)>100
for attempt in range(45):
 try:
  with urllib.request.urlopen(base+prefix+'index.html',timeout=15) as r:body=r.read()
  if ('Grid computation detector '+gen).encode() in body:break
 except Exception:pass
 if attempt%3==0:print('Waiting for committed candidate '+gen+' to be served',flush=True)
 time.sleep(20)
else:raise SystemExit('Publication not observable after 15 minutes')
def check(p):
 expected=subprocess.check_output(['git','show',commit+':'+p],cwd=repo)
 try:
  with urllib.request.urlopen(urllib.request.Request(base+p,headers={'Cache-Control':'no-cache'}),timeout=40) as r:actual=r.read();status=r.status;url=r.url
  return {'path':p,'status':status,'url':url,'bytes':len(actual),'sha256':hashlib.sha256(actual).hexdigest(),'matches_commit':actual==expected}
 except Exception as e:return {'path':p,'error':str(e),'matches_commit':False}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:results=list(pool.map(check,paths))
with urllib.request.urlopen(base,timeout=40) as r:homepage=r.read().decode()
record={'checked_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'homepage_has_test_code':'<h2>Test Code</h2>' in homepage and prefix in homepage,'results':results}
out=Path(cfg['output'])/'live-byte-verification.json';out.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'files':len(results),'matching':sum(x['matches_commit'] for x in results),'homepage':record['homepage_has_test_code'],'failed':[x for x in results if not x['matches_commit']]}),flush=True)
raise SystemExit(0 if record['homepage_has_test_code'] and all(x['matches_commit'] for x in results) else 1)
