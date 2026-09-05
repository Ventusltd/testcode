"""Stop tracking generated test screenshots; do not rewrite history or delete user images."""
from pathlib import Path
import subprocess,json,datetime
repos=[Path('C:/Users/vikra/OneDrive/Documents/GitHub/testcode'),Path('C:/Users/vikra/testcode-source-publication'),Path('C:/Users/vikra/globalgrid-testcode-publication')]
records=[]
for repo in repos:
 tracked=subprocess.check_output(['git','ls-files','-z'],cwd=repo).decode().split('\0')
 images=[p for p in tracked if Path(p).suffix.lower() in ['.png','.jpg','.jpeg','.webp'] and any('evidence' in part or part.startswith('compatibility-') or part=='screenshots' for part in Path(p).parts)]
 size=sum((repo/p).stat().st_size for p in images if (repo/p).exists())
 for i in range(0,len(images),50):subprocess.run(['git','rm','--cached','--ignore-unmatch','--',*images[i:i+50]],cwd=repo,check=True,stdout=subprocess.DEVNULL)
 patterns=['screenshots/**/*.png','screenshots/**/*.jpg','screenshots/**/*.jpeg','screenshots/**/*.webp']
 for root in ['sandbox','testcode']:
  for ext in ['png','jpg','jpeg','webp']:
   patterns += [f'{root}/**/evidence*/**/*.{ext}',f'{root}/**/compatibility*/**/*.{ext}',f'{root}/compatibility-*/**/*.{ext}']
 p=repo/'.gitignore';existing=p.read_text() if p.exists() else ''
 extra=[s for s in patterns if s not in existing.splitlines()]
 if extra:p.write_text(existing.rstrip()+'\n# Temporary browser test screenshots: code and text/JSON receipts are retained.\n'+'\n'.join(extra)+'\n',encoding='utf8',newline='\n')
 records.append({'repo':str(repo),'removed_from_current_index':len(images),'bytes_excluded':size,'files':images})
out=Path(__file__).resolve().parents[3]/'screenshots'/'SCREENSHOT-GIT-POLICY.json'
out.write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'history_rewritten':False,'local_images_deleted':False,'repositories':records},indent=2)+'\n')
print(json.dumps([{k:v for k,v in r.items() if k!='files'} for r in records],indent=2))
