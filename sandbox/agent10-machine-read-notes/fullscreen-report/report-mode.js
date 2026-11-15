/* Additive proof controller: works on supplied filtered source records, never changes MAP URLs. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const report = $('report');
  const catalogue = $('catalogue');
  const scroll = $('report-scroll');
  let rows = [];
  let filtered = [];
  let sidecar = {};
  let selected = null;
  let opener = null;
  let originalScroll = 0;
  let closingFromHistory = false;
  const invalid = value => !value || typeof value !== 'object';
  const safeLink = value => { try {const u = new URL(value);return u.protocol === 'https:' && !u.username && !u.password && u.port === '' ? u.href : null;}catch{return null;} };
  function addText(parent, tag, text, cls) {const x=document.createElement(tag);x.textContent=String(text??'Not recorded');if(cls)x.className=cls;parent.append(x);return x;}
  function item(dl, label, value) {addText(dl,'dt',label);addText(dl,'dd',value ?? 'Not recorded');}
  const assetKey = (row) => `repd|DESNZ-REPD|illustrative-october-2026-q3-not-an-official-extract|${row.repd_ref}`;
  const findNote = row => sidecar[assetKey(row)] ?? null;
  function catalogueRows() {
    const parent=$('rows');parent.replaceChildren();
    const search=$('search').value.trim().toLowerCase();const tech=$('technology').value;
    filtered=rows.filter(r=>(!tech||r.technology===tech)&&(!search||`${r.project_name} ${r.repd_ref}`.toLowerCase().includes(search)));
    for(const row of filtered){
      const tr=document.createElement('tr');itemCell(tr,row.project_name+` · REPD ${row.repd_ref}`);itemCell(tr,row.technology);itemCell(tr,`${row.official_status} (illustrative)`);itemCell(tr,findNote(row)?'Candidate — synthetic only':'Not available');
      const td=document.createElement('td');const button=addText(td,'button','REPORT','action');button.type='button';button.setAttribute('aria-label',`Open project report for ${row.project_name}`);button.dataset.asset=assetKey(row);button.addEventListener('click',()=>open(row.repd_ref,button));tr.append(td);parent.append(tr);
    }
    $('catalogue-status').textContent=`${filtered.length} synthetic project records; full source audit unverified.`;
  }
  function itemCell(tr,value){const x=document.createElement('td');x.textContent=value;tr.append(x);return x;}
  function active(){return filtered.find(r=>r.repd_ref===selected);}
  function render(){
    const row=active();if(!row){close(false);return;}
    $('report-title').textContent=`${row.project_name} · REPD ${row.repd_ref}`;
    const facts=$('facts-list');facts.replaceChildren();item(facts,'Project',row.project_name);item(facts,'REPD ID',row.repd_ref);item(facts,'Technology',row.technology);item(facts,'Frozen status',row.official_status);item(facts,'As of',row.official_as_of);item(facts,'Capacity MW',row.capacity_mw);item(facts,'County',row.county);
    $('news-content').textContent=row.news_signal||'No independently established source events.';
    const map=$('map-action');map.replaceChildren();
    // In a host integration only the original generated URL is passed in; never rebuild it here.
    const existing=row.map_href;
    if(existing && safeLink(existing) && new URL(existing).hostname==='ventusltd.github.io' && new URL(existing).pathname.startsWith('/gridatlas/atlas/')){const a=addText(map,'a','MAP ↗');a.href=existing;a.rel='noopener noreferrer';a.target='_blank';}
    else addText(map,'p','MAP unavailable: no verified existing link in this synthetic fixture.');
    const n=findNote(row), stamp=$('report-stamp');
    stamp.textContent=n?.note_state==='candidate'?'CANDIDATE — NOT INDEPENDENTLY VERIFIED':'INSUFFICIENT EVIDENCE';
    const text=n?.brief||'No Machine Read Note is available. The official source record remains unchanged.';
    $('brief-text').textContent=text;$('brief-duplicate').textContent=text;
    const prov=$('provenance');prov.replaceChildren();item(prov,'Source snapshot','Synthetic October 2026 illustration');item(prov,'Review','Not independently accepted');item(prov,'Rights',n?.rights_basis||'Unknown');item(prov,'Evidence clocks','No authenticated event/fetch/first-seen timestamps');
    if(n?.source_url){const url=safeLink(n.source_url);if(url){addText(prov,'dt','Illustrative link');const dd=document.createElement('dd');const a=addText(dd,'a','Synthetic placeholder — not an article');a.href=url;a.rel='noopener noreferrer';prov.append(dd);}}
    const i=filtered.findIndex(r=>r.repd_ref===row.repd_ref);
    $('report-position').textContent=`${i+1} / ${filtered.length}`;$('previous').disabled=i===0;$('next').disabled=i===filtered.length-1;
    report.classList.remove('enhanced');void report.offsetWidth;report.classList.add('enhanced');
  }
  function reportUrl(ref){const u=new URL(location.href);u.searchParams.set('report',`repd:${ref}`);return u.pathname+u.search+u.hash;}
  function clearReportUrl(){const u=new URL(location.href);u.searchParams.delete('report');return u.pathname+u.search+u.hash;}
  function open(ref,trigger,fromHistory=false){
    if(!filtered.some(r=>r.repd_ref===ref))return false;
    if(report.hidden){opener=trigger||document.activeElement;originalScroll=window.scrollY;catalogue.setAttribute('inert','');document.body.classList.add('report-locked');report.hidden=false;}
    selected=ref;render();scroll.scrollTop=0;
    if(!fromHistory)history.pushState({report:ref},'',reportUrl(ref));
    $('report-title').focus({preventScroll:true});return true;
  }
  function close(goBack=true){
    if(report.hidden)return;
    report.hidden=true;report.classList.remove('enhanced');catalogue.removeAttribute('inert');document.body.classList.remove('report-locked');selected=null;
    window.scrollTo({top:originalScroll,behavior:'instant'});
    if(opener?.isConnected){opener.focus({preventScroll:true});}else{$('search').focus({preventScroll:true});}
    if(goBack && new URL(location.href).searchParams.has('report'))history.back();
  }
  function move(step){const i=filtered.findIndex(r=>r.repd_ref===selected);const r=filtered[i+step];if(!r)return;selected=r.repd_ref;render();scroll.scrollTop=0;history.replaceState({report:selected},'',reportUrl(selected));$('report-title').focus({preventScroll:true});}
  function historyChange(){const param=new URL(location.href).searchParams.get('report');const match=/^repd:(\d+)$/.exec(param||'');if(match){if(!open(match[1],null,true))close(false);}else close(false);}
  function trap(e){if(report.hidden)return;if(e.key==='Escape'){e.preventDefault();close();return;}if(e.key!=='Tab')return;const a=[...report.querySelectorAll('button:not([disabled]):not([hidden]), a[href], [tabindex="0"]')].filter(x=>x.getClientRects().length);if(!a.length)return;const f=a[0],l=a[a.length-1];if(e.shiftKey&&document.activeElement===f){e.preventDefault();l.focus();}else if(!e.shiftKey&&document.activeElement===l){e.preventDefault();f.focus();}}
  async function init(){
    $('report-close').addEventListener('click',()=>close());$('previous').addEventListener('click',()=>move(-1));$('next').addEventListener('click',()=>move(1));document.addEventListener('keydown',trap);window.addEventListener('popstate',historyChange);
    for(const id of ['search','technology'])$(id).addEventListener('input',()=>{catalogueRows();if(selected&&!active())close();});
    if(document.fullscreenEnabled&&report.requestFullscreen){$('report-native').hidden=false;$('report-native').addEventListener('click',async()=>{try{await report.requestFullscreen();}catch{/* Full-window report remains usable */}});}
    try{
      const [a,b]=await Promise.all([fetch('./fixtures/projects.synthetic.json'),fetch('./fixtures/notes.synthetic.json')]);if(!a.ok||!b.ok)throw new Error('missing fixture');const source=await a.json(),side=await b.json();
      if(source.schema!=='globalgrid2050.report-mode-fixture.v1'||source.source_proof!=='SYNTHETIC DEMONSTRATION ONLY'||side.schema!=='globalgrid2050.machine-read-notes-sidecar.v1'||!Array.isArray(source.rows)||invalid(side.notes))throw new Error('invalid fixture contract');
      rows=source.rows;sidecar=side.notes;const ids=new Set();for(const row of rows){if(!/^\d+$/.test(row.repd_ref)||ids.has(row.repd_ref))throw new Error('duplicate or invalid source ref');ids.add(row.repd_ref);}
      const validKeys=new Set(rows.map(assetKey));for(const [key,note] of Object.entries(sidecar)){if(!validKeys.has(key)||!['candidate','insufficient_evidence'].includes(note.note_state)||note.rights_basis!=='unknown'||!note.brief)throw new Error('untrusted note sidecar');}
      catalogueRows();historyChange();
    }catch(error){$('catalogue-status').textContent='Offline static fallback preserved. Interactive sample unavailable.';}
  }
  window.addEventListener('DOMContentLoaded',init);
})();
