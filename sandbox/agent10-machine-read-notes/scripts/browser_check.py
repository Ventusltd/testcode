"""Local Chromium real browser interaction without external URL access.

Composes exact UI source bytes in a browser, not a served product/site receipt.
"""
import hashlib
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'results/browser'; OUT.mkdir(parents=True,exist_ok=True)
html=(ROOT/'ui/index.html').read_text(); css=(ROOT/'ui/machine-read-notes.css').read_text()
js=(ROOT/'ui/machine-read-notes.js').read_text(); bundle=json.loads((ROOT/'ui/fixture-data.json').read_text())
receipt={'source_sha256':{x:hashlib.sha256(s.encode()).hexdigest() for x,s in [('index.html',html),('machine-read-notes.css',css),('machine-read-notes.js',js)]},'tests':[],'scope':'browser composition of exact local source; NOT hosted source/served SHA evidence'}

with sync_playwright() as p:
    executable='/usr/bin/chromium' if Path('/usr/bin/chromium').is_file() else None
    browser=p.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox'] if executable else [])
    for width in [390,393,1440]:
        page=browser.new_page(viewport={'width':width,'height':852})
        page.on('console',lambda x: None)
        page.set_content(html,wait_until='domcontentloaded')
        page.add_style_tag(content=css)
        page.evaluate('window.fetch = () => Promise.resolve({ok:true, json:()=> Promise.resolve('+json.dumps(bundle)+')})')
        page.evaluate(js)
        page.evaluate("window.dispatchEvent(new Event('DOMContentLoaded'))")
        page.locator('button.note-action').first.wait_for(timeout=10000)
        assert page.locator('button.note-action').count()==3
        button=page.locator('button.note-action').first
        button.click()
        assert button.get_attribute('aria-expanded')=='true'
        panel=page.locator('#'+button.get_attribute('aria-controls'))
        assert panel.is_visible()
        assert panel.get_by_text('Machine-originated Pipeline Intelligence Brief').count()==1
        assert button.bounding_box()['height']>=44 and button.bounding_box()['width']>=44
        button.press('Enter')
        assert button.get_attribute('aria-expanded')=='false' and not panel.is_visible()
        button.click()
        page.screenshot(path=str(OUT/f'chromium-{width}.png'),full_page=True)
        receipt['tests'].append({'engine':'Chromium','width':width,'buttons':3,'first_click':True,'keyboard':True,'tap_target':True,'screenshot':f'chromium-{width}.png'})
        page.close()
    page=browser.new_page(viewport={'width':393,'height':852},reduced_motion='reduce')
    page.set_content(html);page.add_style_tag(content=css)
    page.evaluate('window.fetch = () => Promise.resolve({ok:true, json:()=> Promise.resolve('+json.dumps(bundle)+')})')
    page.evaluate(js);page.evaluate("window.dispatchEvent(new Event('DOMContentLoaded'))")
    page.locator('button.note-action').first.click()
    assert page.locator('.brief-row:visible').count()==1
    assert page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")
    receipt['tests'].append({'engine':'Chromium','width':393,'reduced_motion':True,'text_visible':True})
    page.close()
    page=browser.new_page(viewport={'width':390,'height':852},java_script_enabled=False)
    page.set_content(html);page.add_style_tag(content=css)
    assert page.locator('details').count()==3
    page.locator('summary').first.click()
    assert page.locator('details').first.get_attribute('open') is not None
    assert page.locator('h3').count()==3
    receipt['tests'].append({'engine':'Chromium','width':390,'no_js_fallback':True,'native_disclosure':True})
    page.close();browser.close()
(OUT/'browser-receipts.json').write_text(json.dumps(receipt,indent=2)+'\n')
print('BROWSER COMPOSITION PASS:',len(receipt['tests']),'scenarios, Chromium; hosted/physical Safari UNVERIFIED')
