"""Build isolated, timestamped comparison candidates; never edit source products."""
import pathlib, json, hashlib, datetime, shutil, re, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
GITHUB=ROOT.parents[1]
PIPE=GITHUB/'globalgrid2050/uk_renewables_pipeline/v9.7'
PIPE_REF='313f56238b91dbe4f8104f286c1fd54cab05ba12'
ATLAS=GITHUB/'gridatlas-main-202609050200'
GEN=sys.argv[1] if len(sys.argv)>1 else datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M')
DEST=ROOT/GEN
assert re.fullmatch(r'\d{12}',GEN)
if (DEST/'PUBLISHED.json').exists():raise SystemExit('Published timestamps are immutable; use a new one')
DEST.mkdir(exist_ok=True)
def write(p,s):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf-8',newline='\n')
def read(p):return p.read_text(encoding='utf-8-sig').replace('\r\n','\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def head(p):return subprocess.check_output(['git','-C',str(p),'rev-parse','HEAD']).decode().strip()
def replace(s,a,b):
 if a not in s:raise ValueError('Expected source fragment missing: '+a[:90])
 return s.replace(a,b)
provenance={'generation':GEN,'built_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pipeline_parent_commit':PIPE_REF,'atlas_parent_commit':head(ATLAS),'sources':[],'status':'candidate; not production validation','iphone':'user will test real iPhone'}
def source(p):
 text=(subprocess.check_output(['git','-C',str(GITHUB/'globalgrid2050'),'show',PIPE_REF+':'+p.relative_to(GITHUB/'globalgrid2050').as_posix()]).decode('utf-8').replace('\r\n','\n') if p.is_relative_to(PIPE) else read(p));provenance['sources'].append({'path':str(p.relative_to(GITHUB)).replace('\\','/'),'sha256_lf':sha(text.encode())});return text

# Pipeline: use the actual existing product, retaining filters, news and full CSV export.
P=DEST/'pipeline'
for folder in ['scripts','styles','contracts']:
 for f in (PIPE/folder).rglob('*'):
  if f.is_file() and f.suffix in ['.js','.json','.css','.mjs']:
   s=source(f).replace('../../dist/','/dist/')
   write(P/f.relative_to(PIPE),s)
for f in ['data/v9.1/build_manifest.json','data/v9.7/regional_news.json','data/v9.7/regional_manifest.json']:
 s=source(PIPE/f)
 if 'build_manifest' in f:
  obj=json.loads(s)
  for part in obj['project_partitions']:part['path']='/uk_renewables_pipeline/v9.7/'+part['path']
  s=json.dumps(obj,indent=2)+'\n'
 write(P/f,s)
h=source(PIPE/'index.html')
h=replace(h,'<title>','<title>Test Code '+GEN+' · ')
h=re.sub(r'<nav\b[^>]*>.*?</nav>',f'''<nav aria-label="Version comparison" class="testcode-nav"><a href="../">Test Code {GEN}</a><a href="/uk_renewables_pipeline/v9.7/">Claude current Pipeline</a><a href="../atlas/" id="mapAtlasNav">Test Code Atlas</a><button type="button" id="export">Export CSV</button></nav>''',h,count=1,flags=re.S)
h=replace(h,'<tbody id="tbody"></tbody>','<tbody id="tbody"><tr><td colspan="11" role="status">Loading project records…</td></tr></tbody>')
h=replace(h,'<div class="tablewrap">','<nav id="projectPagination" aria-label="Project pages"></nav>\n    <div class="tablewrap">')
h=replace(h,'</head>','<link rel="stylesheet" href="styles/testcode.css">\n</head>')
h=h.replace('../../repd_grid_atlasv8/','../atlas/').replace('V9.7 CANDIDATE',f'TEST CODE {GEN}')
write(P/'index.html',h)
f=P/'scripts/plugins/projects-v9-5-1.js';s=read(f)
s=replace(s,'let all = [];','let pageIndex = 0;\nconst PAGE_SIZE = 50;\nlet all = [];')
s=replace(s,'body.innerHTML = filtered.map((project) => {','pageIndex = Math.min(pageIndex, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));\n  body.innerHTML = filtered.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE).map((project) => {')
s=replace(s,'  }).join("");\n}\n\nfunction updateResultSummary()', '''  }).join("");
  const pagination = document.getElementById("projectPagination");
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  pagination.innerHTML = `<button type="button" id="pagePrevious" ${pageIndex === 0 ? "disabled" : ""}>Previous</button><span role="status" aria-live="polite">Page ${pageIndex + 1} of ${pages} · ${filtered.length ? pageIndex * PAGE_SIZE + 1 : 0}–${Math.min((pageIndex + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString("en-GB")}</span><button type="button" id="pageNext" ${pageIndex + 1 >= pages ? "disabled" : ""}>Next</button>`;
  for (const [id, delta] of [["pagePrevious", -1], ["pageNext", 1]]) {
    document.getElementById(id).onclick = () => { pageIndex += delta; renderTable(); pagination.scrollIntoView({block:"start"}); };
  }
}

function updateResultSummary()''')
s=replace(s,'function apply({ syncUrl = true } = {}) {','function apply({ syncUrl = true } = {}) {\n  pageIndex = 0;')
# Candidate links stay inside the same timestamped comparison pair.
s=replace(s,'  const href = atlasUrlV9_5_1(project);','  const canonicalHref = atlasUrlV9_5_1(project);\n  const href = canonicalHref ? new URL("../atlas/" + new URL(canonicalHref).search, window.location.href).href : "";')
s=replace(s,'  nav.href = route;', '  nav.href = new URL("../atlas/", window.location.href).href;')
write(f,s)
f=P/'scripts/data/canonical-projects-v9-1.js';s=read(f).replace('{ cache: "no-store" }','{ cache: "force-cache" }');write(f,s)
write(P/'styles/testcode.css','''
.testcode-nav{display:flex;gap:12px;flex-wrap:wrap;padding:12px;border-block:1px solid #28525a}
.testcode-nav a{min-height:44px;display:flex;align-items:center;font-size:13px}
#projectPagination{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;scroll-margin-top:12px}
#projectPagination button{min-height:48px;min-width:78px;background:#101d23;color:#bdf9ff;border:1px solid #49747b;font:inherit;cursor:pointer}
#projectPagination button:disabled{opacity:.4;cursor:default}
#projectPagination span{font-size:13px;text-align:center}
.project-actions .map-note{flex:0 0 auto;max-width:145px}
@media(max-width:768px){
 .tablewrap table{min-width:0}.tablewrap .hide-mobile{display:none}
 .tablewrap table,.tablewrap tbody{display:block;width:100%}.tablewrap thead{display:none}
 .tablewrap tr{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);border:1px solid #28434a;margin-bottom:12px;padding:10px;gap:12px;background:#0a1117}
 .tablewrap td{display:block!important;min-width:0!important;width:auto!important;padding:0!important;border:0!important;overflow-wrap:anywhere;white-space:normal!important}
 .tablewrap td.hide-mobile{display:none!important}.tablewrap td:first-child,.tablewrap td:last-child{grid-column:1/-1}
 .tablewrap td::before{display:block;font-size:10px;color:#8aabb4;margin-bottom:4px}
 .tablewrap td:nth-child(4)::before{content:"TECHNOLOGY"}.tablewrap td:nth-child(5)::before{content:"OFFICIAL STATUS"}
 .tablewrap td:nth-child(6)::before{content:"CAPACITY"}.tablewrap td:nth-child(10)::before{content:"NEWS SIGNAL"}
 .project-actions{display:flex!important;flex-direction:row!important;flex-wrap:wrap;gap:8px!important;align-items:center!important}
 .project-actions .map-note{flex-basis:100%!important;max-width:none!important;order:5}
 .action-link,.action-disabled,.copy-id{min-width:48px;min-height:48px;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}
 .site{min-width:130px}#projectPagination{gap:6px}.tablewrap{max-height:70dvh;overflow:auto;overscroll-behavior:contain}
 .badge{white-space:normal}.project-actions .map-note{font-size:11px;line-height:1.45;max-width:110px}
}
''')

# Atlas: reassemble only the changed cartridge, retaining the immutable shell.
A=DEST/'atlas';current=json.loads(source(ATLAS/'atlas/current.json'))
atlasOrigin='https://ventusltd.github.io/gridatlas/atlas/'
current['previous_generation']=current['generation'];current['generation']=GEN
current['composition_id']=GEN+'-testcode-atlas';current['live_route']='/testcode/'+GEN+'/atlas/'
current['shell']['index']=atlasOrigin+current['shell']['index'].removeprefix('./')
current['shell']['base']=atlasOrigin+current['shell']['base'].removeprefix('./')
module=source(ATLAS/'atlas/modules/202609031958-menu-bar.js')
module=replace(module,'    move(panels.File, ready.nodes.search);','    // Search stays on the map throughout initialization.\n    if (ready.nodes.search) ready.nodes.search.setAttribute("data-testcode-search", "persistent");')
start=module.index('  function printView(doc) {');end=module.index('  /* Was anything actually drawn?',start)
module=module[:start]+read(ROOT/'tools/print-view.js')+'\n\n'+module[end:]
# Add visible candidate identity and persistent search without a second UI runtime.
module+=f'''\n;(() => {{
 const style=document.createElement('style');style.textContent=`
 .search-bar-wrapper{{display:flex!important;position:absolute!important;top:64px!important;left:12px!important;right:12px!important;width:auto!important;max-width:520px!important;z-index:1100!important;margin:0!important;transform:none!important}}
 .search-bar-wrapper input{{min-height:48px!important;font-size:16px!important;width:100%!important;box-sizing:border-box}}
 .testcode-identity{{position:fixed;right:12px;bottom:64px;z-index:2000;background:#08161fee;color:#aaf6ff;padding:8px;border:1px solid #36616a;font:12px monospace;text-decoration:none}}
 @media print{{.testcode-identity,.search-bar-wrapper{{display:none!important}}}}
 `;document.head.append(style);
 const link=document.createElement('a');link.className='testcode-identity';link.href='/testcode/{GEN}/';link.textContent='Test Code · {GEN}';document.body.append(link);
}})();\n'''
write(A/'source/menu-bar.js',module)
for item in current['cartridges']:
 originalPath=item['path'].removeprefix('./')
 if item['id']=='substation-intelligence':
  manifest=json.loads(source(ATLAS/'atlas'/item['assembled_from'].removeprefix('./')))
  pieces=[];parts=[]
  for part in manifest['assembled_from']:
   text=module if part['path'].endswith('/202609031958-menu-bar.js') else source(ATLAS/part['path'])
   pieces.append(text);parts.append({'source':part['path'],'sha256':sha(text.encode()),'bytes':len(text.encode())})
  assembled=f'/* Test Code {GEN}; reassembled from individually hashed parts. */\n'+'\n'.join(pieces)
  filename=f'cartridges/{GEN}-substation-intelligence.js';write(A/filename,assembled)
  item.update(path='./'+filename,sha256=sha(assembled.encode()),generation=GEN,version='testcode-'+GEN,assembled_from='./parts.json')
  write(A/'parts.json',json.dumps({'generation':GEN,'parts':parts,'sha256':item['sha256']},indent=2)+'\n')
 else:
  data=(ATLAS/'atlas'/originalPath).read_bytes().replace(b'\r\n',b'\n')
  assert sha(data)==item['sha256'],originalPath
  dest=A/originalPath;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
write(A/'current.json',json.dumps(current,indent=2)+'\n')
write(A/'index.html',source(ATLAS/'atlas/index.html').replace('<title>Grid Atlas</title>',f'<title>Test Code Atlas {GEN}</title>'))

write(DEST/'index.html',f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test Code · {GEN}</title>
<style>body{{margin:0 auto;padding:24px;max-width:900px;background:#080f14;color:#e9f4f4;font:17px/1.6 system-ui}}a{{color:#9eeaff}}h1{{font-size:32px}}.pair{{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:24px 0}}article{{border:1px solid #34515c;padding:20px;background:#101e26}}article a{{display:block;padding:12px 0;min-height:28px}}small{{color:#b4c4ca}}@media(max-width:600px){{.pair{{grid-template-columns:1fr}}}}</style>
<a href="/">GlobalGrid2050</a><h1>Test Code</h1><p>Comparison build <strong>{GEN}</strong> UTC</p>
<div class="pair"><article><h2>Pipeline News</h2><p>50 rows per page. Search and CSV still cover all 7,680 records. MAP stays reachable on small screens.</p><a href="pipeline/">Open Test Code Pipeline →</a><a href="/uk_renewables_pipeline/202609051156/">Compare Claude’s current Pipeline</a></article>
<article><h2>Grid Atlas</h2><p>Search stays visible. Print captures the map before laying out the page. Save uses the map’s render frame.</p><a href="atlas/">Open Test Code Atlas →</a><a href="https://ventusltd.github.io/gridatlas/atlas/">Compare Claude’s current Atlas</a></article></div>
<p><a href="results.html">Browser test results</a> · <a href="release.json">Build record</a> · <a href="https://github.com/Ventusltd/testcode/tree/main/sandbox/{GEN}">Source on GitHub</a></p>
<p><small>These are comparison candidates. iPhone testing is being performed by the owner. They do not replace the existing published versions.</small></p></html>''')
write(DEST/'results.html','<!doctype html><meta charset="utf-8"><title>Test Code results</title><h1>Browser results pending</h1><p>This candidate has not yet completed browser verification.</p>')
write(DEST/'release.json',json.dumps(provenance,indent=2)+'\n')
write(ROOT/'LATEST.txt',GEN+'\n')
print(json.dumps({'generation':GEN,'directory':str(DEST),'files':len(list(DEST.rglob('*')))}))
