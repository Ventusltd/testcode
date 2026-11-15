/* Progressive enhancement only. The full static reference view remains available without JS. */
'use strict';
const SCHEMA = 'globalgrid2050.machine-read-notes-bundle.v1';
const CANDIDATE = 'CANDIDATE — NOT INDEPENDENTLY VERIFIED';
const INSUFFICIENT = 'INSUFFICIENT EVIDENCE';
const el = (tag, cls, content) => { const node = document.createElement(tag); if (cls) node.className = cls; if (content !== undefined) node.textContent = String(content); return node; };
const append = (parent, tag, cls, content) => { const n = el(tag, cls, content); parent.append(n); return n; };
const safeUrl = s => { try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password && u.hostname !== '' ? u.href : null; } catch { return null; } };
const formatClock = v => v?.value ? `${v.value} (${v.precision === 'date_only' ? 'date only; timezone unknown' : 'time with offset'})` : 'Not evidenced';
function buildBrief(note) {
  const section = el('section', 'brief');
  section.setAttribute('aria-label', `Machine-originated Pipeline Intelligence Brief for REPD ${note.repd_ref}`);
  append(section,'div','eyebrow','MACHINE DISPATCH / NOT HUMAN EDITORIAL COPY');
  append(section,'h3',null,'Machine-originated Pipeline Intelligence Brief');
  append(section,'p','stamp',note.label);
  append(section,'p','claim',note.claim_text);
  const dl = append(section,'dl');
  const fields = [['REPD reference',note.repd_ref],['Official frozen status',note.official_record.official_status],['Frozen as of',note.official_record.official_as_of],['Event class',note.event.event_type.replaceAll('_',' ')],['Reported event date',formatClock(note.event_date)],['Published',formatClock(note.published_at)],['Fetched',formatClock(note.fetched_at)],['First seen',formatClock(note.first_seen_at)],['Match basis',note.association.basis],['Review',note.review_state],['Rights',note.rights_basis],['Source evidence',note.source_proof],['Source snapshot',note.source_snapshot_id]];
  for (const [key,value] of fields) { append(dl,'dt',null,key);append(dl,'dd',null,value); }
  const source = safeUrl(note.article_url);
  if (source) { const p = append(section,'p'); const a=append(p,'a',null,'Source link (synthetic placeholder)');a.href=source;a.rel='noopener noreferrer';a.target='_blank'; }
  append(section,'p','meta','No live original article was collected for this prototype. No reproduction rights asserted.');
  append(section,'div','ornament');
  return section;
}
function buildRows(notes) {
  const rows = [];
  notes.forEach((note,i) => {
    if (!/^\d+$/.test(note.repd_ref) || ![CANDIDATE,INSUFFICIENT].includes(note.label) || note.source_proof !== 'SYNTHETIC FIXTURE — NOT AN ACTUAL ARTICLE') throw new Error('Unverified note schema/state');
    const row=el('tr'); const th=append(row,'th',null,note.repd_ref);th.scope='row'; append(row,'td',null,note.project_name);append(row,'td',null,note.official_record.official_status);
    const actionTd=append(row,'td');const btn=append(actionTd,'button','note-action','Read note');btn.type='button';btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls',`note-panel-${note.repd_ref}-${i}`);btn.setAttribute('aria-label',`Read Machine Read Note for ${note.project_name}, REPD ${note.repd_ref}`);
    const detailRow=el('tr','brief-row'); const contentTd=append(detailRow,'td');contentTd.colSpan=4;
    const panel=append(contentTd,'div');panel.id=`note-panel-${note.repd_ref}-${i}`;panel.append(buildBrief(note));detailRow.hidden=true;
    btn.addEventListener('click', () => {const show=detailRow.hidden;detailRow.hidden=!show;btn.setAttribute('aria-expanded',String(show));btn.textContent=show?'Close note':'Read note';});
    rows.push(row,detailRow);
  });
  return rows;
}
async function init() {
  const body=document.querySelector('#notes-body');const state=document.querySelector('#load-state');
  try {
    const response=await fetch('./fixture-data.json',{cache:'no-store'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const bundle=await response.json();
    if(bundle.schema!==SCHEMA || bundle.source_proof!=='SYNTHETIC DEMONSTRATION ONLY' || bundle.notes?.length!==3 || bundle.full_7775_identity_audit?.startsWith('UNVERIFIED')!==true) throw new Error('Unverified bundle');
    const rows=buildRows(bundle.notes);
    body.replaceChildren(...rows);
    state.textContent='Offline-generated synthetic notes loaded. Full 7,775 identity audit remains UNVERIFIED.';
  } catch (error) {
    state.textContent='Static reference view retained; dynamic notes unavailable.';
  }
}
if(typeof window!=='undefined') window.addEventListener('DOMContentLoaded',init);
