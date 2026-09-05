from pathlib import Path
import json,hashlib
r=Path(__file__).resolve().parents[1]/'202609051214'
p=r/'atlas/cartridges/202609051214-uk-gazetteer-flyto.js';s=p.read_text(encoding='utf8');s=s.replace("document.body.dataset.gridatlasRepdDeepLink='identified-no-geometry';\n        return;", """document.body.dataset.gridatlasRepdDeepLink='identified-no-geometry';
        resultsEl.innerHTML = '<h3>' + escapeHtml(exact.name) + '</h3><p>REPD ' + escapeHtml(repdRef) + ' / ' + escapeHtml(String(exact.capacity_mw)) + ' MW</p><p>Location unavailable: this Pipeline REPD snapshot supplies no coordinates. No map pin or grid-distance calculation can be shown.</p>';
        Object.assign(resultsEl.style,{display:'block',position:'fixed',top:'128px',left:'12px',right:'12px',width:'auto',maxWidth:'420px',maxHeight:'60vh',overflow:'auto',zIndex:'6000',padding:'16px',background:'#08151c',color:'#e2f8ff',boxSizing:'border-box'});
        return;""");p.write_text(s,encoding='utf8',newline='\n')
p=r/'pipeline/scripts/plugins/projects-v9-5-1.js';s=p.read_text(encoding='utf8');a=s.index('  const link = `<a class="action-link atlaslink"');b=s.index('\n}\n\nfunction renderTable()',a);s=s[:a]+'''  const located = atlasCentresOnRepdPointV9_7(project);
  const link = `<a class="action-link atlaslink" target="_blank" rel="noopener" href="${escapeHtml(href)}">${located ? "MAP" : "DETAILS"} &#8599;</a>`;
  if (located) return link;
  return `${link}<div class="map-note">No coordinates in the REPD record. Project details are available; map placement is unavailable.</div>`;'''+s[b:];p.write_text(s,encoding='utf8',newline='\n')
p=r/'atlas/current.json';j=json.loads(p.read_text(encoding='utf8'))
for x in j['cartridges']:x['sha256']=hashlib.sha256((r/'atlas'/x['path']).read_bytes()).hexdigest()
p.write_text(json.dumps(j,indent=2)+'\n',encoding='utf8',newline='\n')
