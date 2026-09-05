from pathlib import Path
import json,shutil,hashlib,datetime
R=Path(__file__).resolve().parents[1];OLD='202609051214';G='202609051300';D=R/G
assert not (D/'PUBLISHED.json').exists()
shutil.copytree(R/OLD,D,dirs_exist_ok=True,ignore=shutil.ignore_patterns('evidence*','*console.txt','PUBLISHED.json','live-*'))
def read(p):return p.read_text(encoding='utf-8-sig')
def write(p,s):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf8',newline='\n')
def change(s,a,b):assert a in s,a[:80];return s.replace(a,b)
A=D/'atlas';j=json.loads(read(A/'current.json'))
for x in j['cartridges']:
 p=A/x['path'];s=read(p).replace(OLD,G)
 if x['id']=='substation-intelligence':s+='\n'+read(R/'tools/arrival-layout.js')
 if x['id']=='sld-sandbox':
  s=change(s,'    addCardBar(content);','''    addCardBar(content);
    content.querySelector('.testcode-location-source')?.remove();
    const provenance=window.__GRIDATLAS_PLACE_SEARCH__?.deep_link?.location_provenance;
    if(provenance && content.textContent.includes(window.__GRIDATLAS_PLACE_SEARCH__.deep_link.name)){
      const note=document.createElement('p');note.className='testcode-location-source';note.style.cssText='color:#ffd18a;padding:8px;border:1px solid #97783f';note.textContent=provenance.notice+' ';
      const a=document.createElement('a');a.href=provenance.source_item;a.target='_blank';a.rel='noopener';a.textContent='Source';note.append(a);content.insertBefore(note,content.children[1]||null);
    }''')
  s=change(s,'  function boundCardToMap() {','  function boundCardToMap() {\n    if (document.documentElement.classList.contains("testcode-arrival")) return;')
  s=change(s,"    function reflect() {", "    if (new URLSearchParams(location.search).has('repd_ref')) collapsed = true;\n\n    function reflect() {")
  s=change(s,'        function honourRequestedZoom(map) {','        function honourRequestedZoom(map) {\n          if (repdRef) return; // Frame the project and connection endpoints after selection.')
  s=change(s,'          if (technologyKnown) enableTechnologyLayer(currentArrival.tech);',"          link.technology_layer.reason = 'Other projects are available in Layers; arrival shows the selected project and connections.';")
  s=change(s,'    lastSelection = { origin, name, tech, direction, links, statedMw: statedMw || null };','''    lastSelection = { origin, name, tech, direction, links, statedMw: statedMw || null };
    if (new URLSearchParams(location.search).has('repd_ref')) {
      if (!map.__testcodeUserMovementBound) {
        map.__testcodeUserMovementBound=true;
        for (const event of ['dragstart','zoomstart','rotatestart']) map.on(event,e=>{if(e.originalEvent)map.__testcodeUserMoved=true;});
      }
      const frame = (force=false) => {
        if (!lastSelection || (!force && map.__testcodeUserMoved)) return;
        const points=[lastSelection.origin,...lastSelection.links.map(l=>l.at),currentNearest400?.at,currentDeclared?.at].filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite));
        if (!points.length) return;
        map.resize();
        const narrow=innerWidth<=700, h=map.getContainer().clientHeight;
        const padding=narrow?{left:28,right:28,top:125,bottom:Math.min(h*.5,innerHeight*.4+90)}:{left:380,right:70,top:85,bottom:70};
        map.fitBounds([[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]],{padding,maxZoom:lastSelection.tech==='wind_offshore'?8.5:13,duration:700});
        link.context_frame={points:points.length,coordinates:points.map(p=>p.slice()),padding,project:lastSelection.name};
      };
      requestAnimationFrame(()=>frame());
      let button=document.getElementById('testcode-fit');
      if(!button){button=document.createElement('button');button.id='testcode-fit';button.type='button';button.textContent='Fit connections';map.getContainer().parentElement.append(button);}
      button.onclick=()=>frame(true);
    }''')
  s=change(s,'            window.enterFullscreen?.();','            // Full-viewport arrival CSS keeps controls visible without automatic element fullscreen.')
  s=change(s,'            link.arrival_fullscreen = true;','            link.arrival_fullscreen = false;')
  s=change(s,"            showStatus(owner.name + ' (REPD ' + repdRef + ') - ' + owner.capacity_mw + ' MW. Location unavailable: this Pipeline REPD snapshot supplies no coordinates. No map pin or grid-distance calculation can be shown.', 'unavailable');", "            // The identity owner displays the named missing-location details once.")
 if s!=read(p):
  dest=f'cartridges/{G}-{x["id"]}.js';write(A/dest,s);p.unlink();x.update(path='./'+dest,sha256=hashlib.sha256(s.encode()).hexdigest(),generation=G,version='testcode-'+G)
j.update(generation=G,previous_generation=OLD,composition_id=G+'-testcode-atlas',live_route='/testcode/'+G+'/atlas/');write(A/'current.json',json.dumps(j,indent=2)+'\n')
for p in [D/'index.html',D/'pipeline/index.html',A/'source/menu-bar.js']:write(p,read(p).replace(OLD,G))
write(D/'release.json',json.dumps({'generation':G,'predecessor':OLD,'built_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'changes':['Separate search and project card positions.','Full-height arrival map with a collapsible layers drawer.','Fit project and connection endpoints in remaining map area; preserve user pans.','Retain pinned Pipeline identity and explicit missing-coordinate details.']},indent=2)+'\n');write(R/'LATEST.txt',G+'\n')
print(G)
