from pathlib import Path
import json,shutil,hashlib,datetime
R=Path(__file__).resolve().parents[1]; OLD='202609051152'; G='202609051214'; D=R/G
assert not (D/'PUBLISHED.json').exists()
shutil.copytree(R/OLD,D,dirs_exist_ok=True,ignore=shutil.ignore_patterns('evidence*','PUBLISHED.json','*console.txt','live-*','verification.json'))
def read(p):return p.read_text(encoding='utf-8-sig')
def write(p,s):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf8',newline='\n')
def patch(s,a,b):assert a in s,a[:90];return s.replace(a,b)
def sha(b):return hashlib.sha256(b).hexdigest()
# Identity snapshots are taken from the same immutable partitions Pipeline reads.
source=Path('C:/Users/vikra/globalgrid-testcode-publication/uk_renewables_pipeline/v9.7/data/v9.1/projects');buckets={};inputs=[]
for p in source.glob('*.json'):
 raw=p.read_bytes();inputs.append({'path':p.name,'sha256':sha(raw)});data=json.loads(raw);rows=data if isinstance(data,list) else data['projects']
 for row in rows:
  ref=str(row['repd_ref']);b=buckets.setdefault(str(int(ref)//1000),{});b[ref]={k:row.get(k) for k in ['repd_ref','name','technology','status','capacity_mw','longitude','latitude','county','planning_authority','geometry_status']};b[ref].update(identity_source='PIPELINE_REPD_SNAPSHOT',address='',postcode='')
for bucket,rows in buckets.items():write(D/'atlas/data/repd-identities'/f'{bucket}.json',json.dumps(rows,separators=(',',':'),ensure_ascii=False)+'\n')
A=D/'atlas';current=json.loads(read(A/'current.json'))
for item in current['cartridges']:
 p=A/item['path'];s=read(p);s=s.replace(OLD,G)
 if item['id']=='uk-gazetteer-flyto':
  s=patch(s,'  async function receiveExactRepdDeepLink(','''  async function queryPipelineIdentity(ref) {
    if (!/^\\d+$/.test(ref)) return null;
    const url = new URL('./data/repd-identities/' + Math.floor(Number(ref)/1000) + '.json', window.location.href);
    const response = await fetch(url, {cache:'force-cache'});
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Pipeline identity snapshot HTTP ' + response.status);
    const records = await response.json();
    return Object.prototype.hasOwnProperty.call(records, ref) ? records[ref] : null;
  }

  async function receiveExactRepdDeepLink(''')
  s=patch(s,'const results = await queryOfficialRepd(repdRef, querySerial, stillOwned);','const snapshot = await queryPipelineIdentity(repdRef);\n      const results = snapshot ? [snapshot] : await queryOfficialRepd(repdRef, querySerial, stillOwned);')
  s=patch(s,'      renderResults(results, resultsEl);\n      await waitForCapturedMap();','''      renderResults(results, resultsEl);
      if (!hasSafeMapPoint(exact)) {
        state.deep_link = {...exact, owner_epoch:ownerEpoch, status:'IDENTIFIED_NO_GEOMETRY', resolved:true, mapped:false, official_active_register_match:false};
        document.body.dataset.gridatlasRepdRef=repdRef;
        document.body.dataset.gridatlasRepdDeepLink='identified-no-geometry';
        return;
      }
      await waitForCapturedMap();''')
  s=patch(s,"identity_source: 'OFFICIAL_ACTIVE_REGISTER',\n        official_active_register_match: true", "identity_source: exact.identity_source || 'OFFICIAL_ACTIVE_REGISTER',\n        official_active_register_match: !exact.identity_source")
 if item['id']=='sld-sandbox':
  s=patch(s,"|| dl.status === 'NOT_IN_ACTIVE_REGISTER'", "|| dl.status === 'NOT_IN_ACTIVE_REGISTER' || dl.status === 'IDENTIFIED_NO_GEOMETRY'")
  s=patch(s,"let name = q.get('project') || 'Deep-linked project';","let name = q.get('project') || (repdRef ? 'REPD ' + repdRef : 'Shared map point');")
  s=patch(s,"          } else if (owner?.status === 'NOT_IN_ACTIVE_REGISTER') {", """          } else if (owner?.status === 'IDENTIFIED_NO_GEOMETRY') {
            link.deep_link_identity = 'identified-no-geometry';
            link.identity_verification = {status:owner.status, repd_ref:repdRef, name:owner.name, identity_source:owner.identity_source};
            injectStatusStyle();
            showStatus(owner.name + ' (REPD ' + repdRef + ') - ' + owner.capacity_mw + ' MW. Location unavailable: this Pipeline REPD snapshot supplies no coordinates. No map pin or grid-distance calculation can be shown.', 'unavailable');
            return;
          } else if (owner?.status === 'NOT_IN_ACTIVE_REGISTER') {""")
  s=patch(s,'if (discrepancyKm <= 0.001) {','if (discrepancyKm <= 0.001 && resolved.name === currentArrival.name && resolved.technology === currentArrival.tech && Number(resolved.capacity_mw) === Number(currentArrival.stated)) {')
 # Every changed byte has a new cartridge and verified hash.
 if s!=read(p):
  target=f'cartridges/{G}-{item["id"]}.js';write(A/target,s);p.unlink();item.update(path='./'+target,sha256=sha(s.encode()),generation=G,version='testcode-'+G);item.pop('assembled_from',None)
current.update(generation=G,previous_generation=OLD,composition_id=G+'-testcode-atlas',live_route='/testcode/'+G+'/atlas/')
write(A/'current.json',json.dumps(current,indent=2)+'\n')
for p in [D/'index.html',D/'pipeline/index.html',A/'source/menu-bar.js']:
 write(p,read(p).replace(OLD,G))
# Present outgoing identity immediately; the receiver independently resolves its pinned snapshot.
p=D/'pipeline/scripts/plugins/projects-v9-5-1.js';s=read(p);s=patch(s,'  const href = canonicalHref ?', '  let href = canonicalHref ?');s=patch(s,'window.location.href).href : "";', 'window.location.href).href : "";\n  if (href) { const u = new URL(href); u.searchParams.set("project", project.name); u.searchParams.set("capacity_mw", project.capacity_mw); href=u.href; }');write(p,s)
write(D/'release.json',json.dumps({'generation':G,'built_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'predecessor':OLD,'identity_records':sum(len(x) for x in buckets.values()),'partition_inputs':inputs,'changes':['Exact Pipeline arrivals use pinned same-origin identity shards instead of DuckDB/Parquet.','Missing geometry is a named terminal result, without invented coordinates.','Reconciliation updates project name/capacity even when coordinates match.'],'limitations':['General Atlas search still uses the existing Parquet engine.','11613 has no coordinates in source data; no map placement is claimed.']},indent=2)+'\n')
write(R/'LATEST.txt',G+'\n');print(G)
