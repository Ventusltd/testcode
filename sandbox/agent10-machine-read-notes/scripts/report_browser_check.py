"""Real local Chromium/WebKit test of the isolated report shell; never a served production proof.
No network fixtures, secrets or external links are followed.
"""
from __future__ import annotations
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from hashlib import sha256
import json
import argparse
import os
from playwright.sync_api import sync_playwright, Error as BrowserError

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'results'/'report-browser'
OUT.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--engine',choices=['chromium','webkit'],default='chromium')
engine=parser.parse_args().engine
class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),QuietHandler)
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/fullscreen-report/index.html'
files=('index.html','report-mode.css','report-mode.js','fixtures/projects.synthetic.json','fixtures/notes.synthetic.json')
receipt={'scope':'local browser composition; NOT product preview/real iPhone proof',
         'sha256':{p:sha256((ROOT/'fullscreen-report'/p).read_bytes()).hexdigest() for p in files},
         'engine':engine,'cases':[]}
def navigate(page, no_js=False):
    """Use real localhost where permitted; local no-socket composition is explicitly labelled."""
    try:
        if os.environ.get('ALLOW_OFFLINE_COMPOSE') == '1': raise BrowserError('explicit local no-network composition')
        page.goto(base,wait_until='domcontentloaded',timeout=3500)
        return 'localhost_http'
    except BrowserError:
        if os.environ.get('ALLOW_OFFLINE_COMPOSE') != '1':
            raise
        html=(ROOT/'fullscreen-report/index.html').read_text()
        html=html.replace('<link rel="stylesheet" href="report-mode.css">','').replace('<script src="report-mode.js" defer></script>','')
        page.set_content(html,wait_until='domcontentloaded')
        if no_js: return 'offline_static_no_js'
        page.add_style_tag(content=(ROOT/'fullscreen-report/report-mode.css').read_text())
        projects=json.loads((ROOT/'fullscreen-report/fixtures/projects.synthetic.json').read_text())
        notes=json.loads((ROOT/'fullscreen-report/fixtures/notes.synthetic.json').read_text())
        page.evaluate("""([projects,notes]) => {
            window.fetch = url => Promise.resolve({ok:true,json:()=>Promise.resolve(url.includes('projects.synthetic')?projects:notes)});
            history.pushState=(state,title,url)=>{window.__fakeReportUrl=url};
            history.replaceState=(state,title,url)=>{window.__fakeReportUrl=url};
            history.back=()=>{window.dispatchEvent(new PopStateEvent('popstate'))};
        }""", [projects,notes])
        page.evaluate((ROOT/'fullscreen-report/report-mode.js').read_text())
        page.evaluate("window.dispatchEvent(new Event('DOMContentLoaded'))")
        return 'offline_composed_no_real_history'

try:
 with sync_playwright() as p:
    browser_type=getattr(p,engine)
    executable='/usr/bin/chromium' if engine=='chromium' and Path('/usr/bin/chromium').exists() else None
    browser=browser_type.launch(headless=True,executable_path=executable,args=['--no-sandbox'] if executable else [])
    for width,height in ((390,844),(393,852),(844,390),(852,393),(768,1024),(1440,900)):
        page=browser.new_page(viewport={'width':width,'height':height})
        if width==390:page.context.tracing.start(screenshots=True,snapshots=True,sources=True)
        method=navigate(page)
        page.wait_for_function('document.querySelectorAll("#rows button[data-asset]").length===3')
        assert page.locator('#rows tr').count()==3,'source fixture not loaded'
        page.get_by_role('button',name='Open project report for Botley West').click()
        assert page.locator('#report').is_visible()
        assert 'Botley West' in page.locator('#report-title').inner_text()
        assert page.locator('#report-stamp').inner_text()=='CANDIDATE — NOT INDEPENDENTLY VERIFIED'
        assert 'Illustrative synthetic scenario' in page.locator('#brief-text').inner_text()
        assert page.locator('#report-title').evaluate('(x)=>document.activeElement===x'),'focus not moved'
        assert page.locator('#map-action').get_by_text('MAP unavailable').count()==1
        assert page.locator('#brief-duplicate').get_attribute('aria-hidden')=='true'
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'document clipped'
        assert page.evaluate('document.querySelector("#report").scrollWidth <= innerWidth+1'), 'shell clipped'
        assert page.locator('#report-close').bounding_box()['height']>=44
        assert page.locator('#next').bounding_box()['height']>=44
        page.locator('#next').click()
        assert 'Green Hill' in page.locator('#report-title').inner_text()
        page.locator('#previous').click()
        assert 'Botley West' in page.locator('#report-title').inner_text()
        if width==390:
            page.set_viewport_size({'width':844,'height':390})
            assert 'Botley West' in page.locator('#report-title').inner_text(),'orientation lost identity'
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'orientation overflow'
            page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(OUT/f'{engine}-{width}x{height}.png'))
        page.keyboard.press('Escape')
        assert page.locator('#report').is_hidden(),'Escape did not close'
        assert page.locator('#search').get_attribute('id')=='search'
        page.get_by_role('button',name='Open project report for Botley West').click()
        if method=='localhost_http': page.go_back(wait_until='domcontentloaded')
        else: page.evaluate("window.dispatchEvent(new PopStateEvent('popstate'))")
        page.wait_for_function('document.getElementById("report").hidden')
        receipt['cases'].append({'viewport':[width,height],'opened':True,'candidate':True,'navigation':True,'orientation':width==390,'escape':True,'back':method=='localhost_http','navigation_test_mode':method,'no_overflow':True,'screenshot':f'{engine}-{width}x{height}.png'})
        if width==390:
            page.context.tracing.stop(path=str(OUT/f'{engine}-390-trace.zip'))
        page.close()
    page=browser.new_page(viewport={'width':393,'height':852},reduced_motion='reduce')
    navigate(page)
    page.wait_for_function('document.querySelectorAll("#rows button[data-asset]").length===3')
    page.get_by_role('button',name='Open project report for Botley West').click()
    assert page.locator('#brief-duplicate').evaluate('(x)=>getComputedStyle(x).display')=='none'
    assert page.locator('#brief-text').is_visible()
    receipt['cases'].append({'reduced_motion':True,'screenreader_copy_present':True})
    page.close()
    page=browser.new_page(viewport={'width':390,'height':844},java_script_enabled=False)
    navigate(page, no_js=True)
    assert page.locator('#static-reference details').count()==3
    page.locator('#static-12588 summary').click()
    assert page.locator('#static-12588').get_attribute('open') is not None
    receipt['cases'].append({'no_js_native_fallback':True})
    page.close()
    page=browser.new_page(viewport={'width':393,'height':852})
    navigate(page)
    page.wait_for_function('document.querySelectorAll("#rows button[data-asset]").length===3')
    page.locator('#search').fill('hill')
    assert page.locator('#rows tr').count()==1
    page.get_by_role('button',name='Open project report for Green Hill').click()
    assert page.locator('#previous').is_disabled() and page.locator('#next').is_disabled()
    assert page.locator('#report-position').inner_text()=='1 / 1'
    page.locator('#report-close').click()
    assert page.locator('#search').input_value()=='hill'
    receipt['cases'].append({'filtered_context_retained':True,'previous_next_filtered':True})
    page.close()
    # Deliberate hostile and long-note presentation controls (DOM after source binding).
    page=browser.new_page(viewport={'width':390,'height':844})
    navigate(page)
    page.wait_for_function('document.querySelectorAll("#rows button[data-asset]").length===3')
    page.get_by_role('button',name='Open project report for Botley West').click()
    stress='<img src=x onerror=alert(1)>'+' X'*1500+' https://example.invalid/'+('z'*600)
    page.locator('#brief-text').evaluate('(node, value) => { node.textContent=value; }',stress)
    page.locator('#brief-duplicate').evaluate('(node, value) => { node.textContent=value; }',stress)
    assert len(page.locator('#brief-text').inner_text())>2000
    assert page.locator('#brief-text img').count()==0,'source string executed as markup'
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'long note document overflow'
    assert page.evaluate('document.querySelector("#report").scrollWidth<=innerWidth+1'),'long note report overflow'
    receipt['cases'].append({'long_note_over_2000':True,'very_long_url':True,'markup_inert':True,'no_horizontal_overflow':True})
    page.emulate_media(media='print')
    assert page.locator('#report').evaluate('(x)=>getComputedStyle(x).position')=='static'
    assert page.locator('#brief-text').is_visible()
    assert page.locator('#brief-duplicate').evaluate('(x)=>getComputedStyle(x).display')=='none'
    receipt['cases'].append({'print_full_text':True,'print_no_animation':True,'print_static_layout':True})
    page.close();browser.close()
finally:server.shutdown()
(OUT/f'{engine}-report-browser-receipts.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(f'PASS {engine}: {len(receipt["cases"])} real browser cases, 6 viewports, synthetic only; source/served product & physical iPhone UNVERIFIED')
