// Local HTTP fixtures only. Run offline source/model checks before this harness.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.env.FILINGS_UI_ARTIFACTS) throw new Error('FILINGS_UI_ARTIFACTS must name an explicit artifact directory');
const output = resolve(process.env.FILINGS_UI_ARTIFACTS);
const browserKind = process.env.FILINGS_BROWSER || 'chrome';
if (!['chrome', 'chromium'].includes(browserKind)) throw new Error('FILINGS_BROWSER must be chrome or chromium');
const modulePath = process.env.PLAYWRIGHT_MODULE;
const {chromium} = await import(modulePath ? pathToFileURL(resolve(modulePath)).href : 'playwright');
const require = createRequire(import.meta.url);
const playwrightPackage = modulePath ? resolve(dirname(resolve(modulePath)), 'package.json') : require.resolve('playwright/package.json');
const playwrightVersion = JSON.parse(await readFile(playwrightPackage, 'utf8')).version;
const fixtureBytes = await readFile(resolve(root, 'fixtures.json'), 'utf8');
const fixtures = JSON.parse(fixtureBytes);
assert.equal(fixtures.schema, 'testcode.figures-ui.fixtures.v1');
const allowed = new Set(['demo.html', 'demo.mjs', 'render.mjs', 'model.mjs', 'figures.css', 'fixtures.json']);
const mime = {'.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8'};
const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) throw new Error('method');
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const name = pathname === '/' ? 'demo.html' : pathname.slice(1);
    if (!allowed.has(name)) throw new Error('path');
    const bytes = await readFile(resolve(root, name));
    response.writeHead(200, {'Content-Type': mime[extname(name)], 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch {
    response.writeHead(404, {'Content-Type': 'text/plain'});
    response.end('Not found');
  }
});
await new Promise((done, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', done);});
const origin = `http://127.0.0.1:${server.address().port}`;
const widths = [375, 390, 768, 1440];
const results = [];
let browser;
try {
  await mkdir(output, {recursive: true});
  browser = await chromium.launch({headless: true, ...(browserKind === 'chrome' ? {channel: 'chrome'} : {})});
  for (const width of widths) {
    const context = await browser.newContext({viewport: {width, height: 900}, serviceWorkers: 'block'});
    const external = [];
    const pageErrors = [];
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      external.push(route.request().url());
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    const checks = [];
    const pass = name => checks.push(name);
    const assertExactRows = async claims => {
      assert.equal(await page.locator('[data-figure-claim]').count(), claims.length);
      assert.equal(await page.locator('#figure-slot [data-figure-link]').count(), claims.length);
      for (const claim of claims) {
        const row = page.locator(`[data-figure-claim=${JSON.stringify(claim.claim_id)}]`);
        assert.equal(await row.count(), 1);
        const expectedAmount = claim.value + (claim.scale === '1' ? '' : ` × ${claim.scale}`) + ` ${claim.currency || claim.unit}`;
        assert.equal(await row.locator('[data-figure-value]').innerText(), expectedAmount);
        assert.equal(await row.locator('.ff-original-unit').innerText(), `Original unit: ${claim.original_unit}`);
        assert.match(await row.locator('[data-figure-status]').innerText(), /provisional/i);
        const link = row.locator('[data-figure-link]');
        assert.equal(await link.count(), 1);
        assert.equal(await link.getAttribute('href'), new URL(claim.provenance.document_url).href);
        assert.equal(await link.getAttribute('target'), '_blank');
        assert.match(await link.getAttribute('rel') || '', /noopener/);
        assert.match(await link.getAttribute('rel') || '', /noreferrer/);
      }
    };
    let sentinelClicks = 0;
    const assertInlineHost = async () => {
      assert.equal(await page.evaluate(() =>
        window.__filingsHostSentinel.node === document.querySelector('#same-container-host') &&
        window.__filingsHostSentinel.node.parentElement === document.querySelector('#figure-slot')), true);
      await page.locator('#same-container-host').click();
      sentinelClicks += 1;
      assert.equal(await page.evaluate(() => window.__filingsHostSentinel.clicks), sentinelClicks);
    };
    const openFigures = async () => {
      const details = page.locator('[data-filings-figures-root] details').first();
      const rootDetails = page.locator('details[data-filings-figures-root]').first();
      const target = await rootDetails.count() ? rootDetails : details;
      if (await target.count() && !(await target.evaluate(el => el.open))) await target.locator('summary').first().click();
    };
    await page.goto(`${origin}/demo.html`);
    await page.waitForFunction(() => window.filingsDemo || window.filingsDemoFailure);
    assert.equal(await page.evaluate(() => Boolean(window.filingsDemoFailure)), false);
    assert.match(await page.locator('.fixture-note').innerText(), /Synthetic TestCode fixture/);
    pass('explicit_synthetic_demo');

    const summary = page.locator('[data-filings-figures-root] summary').first();
    await summary.focus();
    await page.keyboard.press('Enter');
    assert.equal(await summary.evaluate(el => el.parentElement.open), true);
    pass('keyboard_details_open');
    await assertExactRows(fixtures.cases.finance.claims);
    pass('exact_decimal_source_units_and_provisional');
    await page.evaluate(() => {
      const node = document.createElement('button');
      node.id = 'same-container-host';
      node.type = 'button';
      node.textContent = 'Synthetic same-container host action';
      const sentinel = {node, clicks: 0};
      node.addEventListener('click', () => {sentinel.clicks += 1;});
      document.querySelector('#figure-slot').prepend(node);
      window.__filingsHostSentinel = sentinel;
    });
    const hostBefore = await page.locator('.host-actions').evaluate(el => el.outerHTML);
    await page.evaluate(() => {window.filingsDemo.showCase('finance'); window.filingsDemo.showCase('finance');});
    assert.equal(await page.locator('[data-filings-figures-root]').count(), 1);
    assert.equal(await page.locator('[data-figure-claim]').count(), fixtures.cases.finance.claims.length);
    assert.equal(await page.locator('.host-actions').evaluate(el => el.outerHTML), hostBefore);
    await page.locator('#host-map').click();
    await page.locator('#host-csv').click();
    assert.deepEqual(await page.evaluate(() => window.filingsDemo.hostClicks), {map: 1, csv: 1});
    await assertInlineHost();
    pass('idempotent_inline_replacement_preserves_host_actions');

    await page.selectOption('#fixture-case', 'unknown');
    await openFigures();
    assert.equal(await page.locator('[data-figure-claim]').count(), 0);
    assert.match(await page.locator('#figure-slot').innerText(), /unknown/i);
    pass('unknown_has_no_invented_zero');
    await page.selectOption('#fixture-case', 'unavailable');
    await openFigures();
    assert.equal(await page.locator('[data-figure-claim]').count(), 0);
    assert.match(await page.locator('#figure-slot').innerText(), /unavailable/i);
    pass('unavailable_clears_previous_figures');

    await page.selectOption('#fixture-case', 'energy');
    await openFigures();
    await assertExactRows(fixtures.cases.energy.claims);
    pass('physical_claim_units_preserved');

    await page.selectOption('#fixture-case', 'hostile_text');
    await openFigures();
    assert.equal(await page.locator('#figure-slot img, #figure-slot svg, #figure-slot script, #figure-slot iframe').count(), 0);
    assert.equal(await page.evaluate(() => window.__figureXss), undefined);
    for (const claim of fixtures.cases.hostile_text.claims) {
      assert.ok((await page.locator('#figure-slot').innerText()).includes(claim.metric));
    }
    pass('untrusted_text_is_literal');
    await assertExactRows(fixtures.cases.hostile_text.claims);
    pass('source_links_retain_safe_attributes');

    await page.evaluate(() => {
      window.filingsDemo.showCase('finance');
      const input = structuredClone(window.filingsDemo.fixtures.cases.finance);
      input.claims[0].provenance.document_url = 'javascript:window.__figureXss=1';
      window.filingsDemo.apply(input);
    });
    assert.equal(await page.locator('[data-figure-claim]').count(), 0);
    assert.equal(await page.locator('#figure-slot a[href^="javascript:"]').count(), 0);
    assert.match(await page.locator('#figure-slot').innerText(), /unavailable|invalid/i);
    await assertInlineHost();
    pass('unsafe_url_rejected_and_stale_rows_cleared');

    await page.evaluate(() => {
      window.filingsDemo.showCase('finance');
      const input = structuredClone(window.filingsDemo.fixtures.cases.finance);
      input.entityId = 'fixture:different:entity';
      window.filingsDemo.apply(input);
    });
    assert.equal(await page.locator('[data-figure-claim]').count(), 0);
    await assertInlineHost();
    pass('wrong_entity_clears_previous_claims');
    await page.evaluate(() => {window.filingsDemo.showCase('finance'); window.filingsDemo.apply({claims: 'invalid'});});
    assert.equal(await page.locator('[data-figure-claim]').count(), 0);
    assert.match(await page.locator('#figure-slot').innerText(), /unavailable|invalid/i);
    await assertInlineHost();
    pass('invalid_input_clears_previous_claims');

    await page.evaluate(() => window.filingsDemo.showCase('finance'));
    assert.equal(await page.locator('#fixture-case').inputValue(), 'finance');
    await openFigures();
    await assertExactRows(fixtures.cases.finance.claims);
    await assertInlineHost();
    pass('same_container_host_node_and_listener_preserved');
    // Remove only the harness sentinel before capturing the intended demo UI.
    await page.evaluate(() => window.__filingsHostSentinel.node.remove());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    pass('no_document_overflow');
    await page.screenshot({path: resolve(output, `figures-${width}.png`), fullPage: true});
    assert.deepEqual(external, []);
    assert.deepEqual(pageErrors, []);
    pass('no_external_requests_or_page_exceptions');
    results.push({width, checks});
    await context.close();
  }
  const report = {schema: 'testcode.figures-ui.browser.v1', browser: browserKind === 'chrome' ? 'installed Google Chrome' : 'Playwright Chromium',
    browser_version: browser.version(), playwright_version: playwrightVersion, widths,
    fixture_kind: 'synthetic only; not live financial evidence', android_device: false,
    network: 'loopback fixture HTTP only; external requests blocked', results};
  await writeFile(resolve(output, 'browser-receipt.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
