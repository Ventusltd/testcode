// Served-page proof for a GLOBALGRID2050 Spider universe generation on globalgrid2050.com/testcode/<generation>/.
// For each of the ten read-only versions, at phone (430) and desktop (1280) width, in Chromium:
//   1. the page reaches the live counts (10,811 function families) with no page error;
//   2. its own picture renders (a version-specific selector and minimum count, measured, printed);
//   3. the family journey: search "effectiveGap" -> open #2 -> numbered line 9 carries its code;
//   4. "contained in" opens that family's block without a page error, and the trail grows.
// A missing browser, page or data is a FAIL, never a skip. Usage: GENERATION=202609141350 node tools/spider-universe-served.mjs
import { chromium } from 'playwright';
const GEN = process.env.GENERATION;
if (!/^\d{12}$/.test(GEN || '')) { console.error('FAIL: GENERATION must be a 12-digit UTC stamp'); process.exit(1); }
const BASE = `https://globalgrid2050.com/testcode/${GEN}/`;
const PICTURE = {
  'v01-spider-drill': ['#left .card, #right .card', 12],
  'v02-radial-sunburst': ['#sun path.seg', 200],
  'v03-particle-universe': ['canvas#sky', 1],
  'v04-periodic-arrows': ['.tile', 207],
  'v05-chord-dependencies': ['path.chord', 50],
  'v06-treemap-lines': ['#map .cell', 12],
  'v07-flow-repos': ['path.band', 50],
  'v08-ring-journey': ['circle.b', 207],
  'v09-line-river': ['.mini button', 207],
  'v10-ide-search': ['#nav details', 12],
};
const results = []; const check = (v, w, name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} [${v} @${w}] ${name}${detail ? ' — ' + detail : ''}`); };
const browser = await chromium.launch();
for (const [v, [sel, min]] of Object.entries(PICTURE)) for (const width of [430, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
  page.on('popup', p => p.close());
  try {
    const t0 = Date.now();
    const resp = await page.goto(`${BASE}${v}/index.html`, { waitUntil: 'domcontentloaded' });
    check(v, width, 'page served', resp && resp.status() === 200, `HTTP ${resp && resp.status()}`);
    await page.waitForFunction(() => /10,811 function families/.test(document.body.innerText), null, { timeout: 45000 });
    check(v, width, 'live counts shown', true, `${Date.now() - t0} ms to counts`);
    await page.waitForTimeout(1200);
    const n = await page.locator(sel).count();
    check(v, width, `picture renders (${sel} >= ${min})`, n >= min, `${n}`);
    await page.fill('.u-search', 'effectiveGap');
    const hit = page.locator('.u-hits button', { hasText: '#2 effectiveGap' }).first();
    await hit.waitFor({ timeout: 10000 }); await hit.click();
    await page.waitForFunction(() => [...document.querySelectorAll('.u-line, .ln')].some(e => /(^|\s)9\s*│.*effectiveGap/.test(e.textContent)), null, { timeout: 30000 });
    check(v, width, 'search -> family #2 -> numbered line 9 carries its code', true);
    // relationship hop: #2 is used by #9 — follow that arrow, then check the new family's source link and step back
    const usedBy = page.locator('button', { hasText: /^#9\b/ }).first();
    const hadUsedBy = await usedBy.count();
    if (hadUsedBy) await usedBy.click();
    const hopped = hadUsedBy ? await page.waitForFunction(() => /#9 /.test(document.body.innerText) && [...document.querySelectorAll('#trail a')].some(a => /^#9 /.test(a.textContent)), null, { timeout: 30000 }).then(() => true, () => false) : false;
    check(v, width, 'used-by arrow #2 -> #9 opens that family and adds it to the trail', hopped, hadUsedBy ? '' : 'no #9 control');
    const src = await page.locator('a', { hasText: 'File at commit' }).last().getAttribute('href').catch(() => null);
    check(v, width, 'the hop target links to its file at the pinned commit with a line anchor', /^https:\/\/github\.com\/Ventusltd\/[^/]+\/blob\/[0-9a-f]{40}\/.+#L\d+-L\d+$/.test(src || ''), src || 'no link');
    const back = page.locator('#trail a', { hasText: /^#2 / }).first();
    const hadBack = await back.count();
    if (hadBack) { await back.click(); await page.waitForTimeout(1500); }
    const trailAfterBack = await page.locator('#trail a').allTextContents();
    check(v, width, 'the trail steps back to #2', hadBack > 0 && /^#2 /.test(trailAfterBack[trailAfterBack.length - 1] || ''), trailAfterBack.slice(-2).join(' › '));
    if (hadBack) { // re-open #2 so the containing-block step below starts from the family panel, whichever way the version handles "back"
      await page.fill('.u-search', 'effectiveGap'); await page.locator('.u-hits button', { hasText: '#2 effectiveGap' }).first().click();
      await page.waitForFunction(() => [...document.querySelectorAll('.u-line, .ln')].some(e => /(^|\s)9\s*│/.test(e.textContent)), null, { timeout: 30000 });
    }
    const trail0 = await page.locator('#trail a').count();
    const up = page.locator('button', { hasText: 'contained in' }).first();
    // count the control BEFORE clicking: versions that replace the panel when the block opens remove it
    const had = await up.count();
    if (had) { await up.click(); await page.waitForTimeout(1500); }
    const trail1 = await page.locator('#trail a').count();
    check(v, width, '"contained in" opens the block and the trail grows', had > 0 && trail1 > trail0, `control ${had ? 'present' : 'absent'}; trail ${trail0} -> ${trail1}`);
    check(v, width, 'no page errors', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check(v, width, 'journey ran to the end', false, String(e).split('\n')[0].slice(0, 200));
    if (errors.length) console.log(`   page errors: ${errors.join(' | ')}`);
  } finally { await page.close(); }
}
await browser.close();
const failed = results.filter(r => !r).length;
console.log(`${results.length - failed}/${results.length} checks passed for generation ${GEN}`);
process.exit(failed ? 1 : 0);
