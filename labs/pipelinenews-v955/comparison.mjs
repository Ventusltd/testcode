import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const editions = [
  ['homepage', '202611180633', '9.46'],
  ['accepted-mobile', '202611190138', '9.51'],
  ['pre-hud', '202611191154', '9.54'],
  ['previous-hud', '202611191305', '9.54'],
  ['candidate', '202611191418', '9.56'],
];
const source = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
const root = 'uk_renewables_pipeline';
const require = createRequire(resolve(source, root, editions.at(-1)[1], 'package.json'));
const { chromium, webkit } = require('playwright');
const report = [];
await mkdir(output, { recursive: true });

for (const [engine, launcher] of Object.entries({ chromium, webkit })) {
  const browser = await launcher.launch();
  try {
    for (const [label, id, expectedTitle] of editions) {
      const live = label !== 'candidate';
      const path = `${root}/${id}/`;
      const url = (live ? 'https://globalgrid2050.com/' : 'http://127.0.0.1:8765/') + path;
      for (const viewport of [{width: 393, height: 852}, {width: 1440, height: 900}]) {
        const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
        const name = `${engine}-${label}-${viewport.width}`;
        const entry = { name, url, viewport, requests: [] };
        report.push(entry);
        page.on('request', request => entry.requests.push(request.url()));
        try {
          const response = await page.goto(`${url}?technology=solar`, {waitUntil: 'domcontentloaded'});
          assert.equal(response.status(), 200);
          assert.ok((await response.body()).equals(await readFile(resolve(source, path, 'index.html'))),
            'Served HTML differs from the pinned source');
          await page.waitForFunction(() => document.querySelector('#v2')?.textContent.trim() === '3,604',
            null, {timeout: 45000});
          entry.title = await page.title();
          assert.ok(entry.title.includes(`V${expectedTitle}`), entry.title);
          entry.dashboard = await page.evaluate(() => {
            const gauges = [...document.querySelectorAll('#g1,#g2,#g3')];
            const ticker = document.querySelector('#headlineTicker');
            return {
              gaugeCount: gauges.filter(canvas => globalThis.Chart?.getChart(canvas)).length,
              gaugeBottom: Math.max(...gauges.map(canvas => canvas.getBoundingClientRect().bottom)),
              tickerBottom: ticker?.getBoundingClientRect().bottom,
              rows: document.querySelectorAll('#tbody tr[id^="repd-"]').length,
              pageWidth: document.documentElement.scrollWidth,
              viewportWidth: document.documentElement.clientWidth,
            };
          });
          assert.ok(entry.dashboard.rows > 0, 'Register has no project rows');
          if (!live) {
            assert.equal(entry.dashboard.gaugeCount, 3);
            assert.ok(entry.dashboard.gaugeBottom <= viewport.height, 'Candidate dashboard below fold');
            assert.ok(entry.dashboard.tickerBottom < entry.dashboard.gaugeBottom, 'Ticker below gauges');
            assert.ok(entry.dashboard.pageWidth <= entry.dashboard.viewportWidth + 2, 'Page overflows');
          }
        } catch (error) {
          entry.error = String(error);
        } finally {
          await page.screenshot({path: resolve(output, name + '.png')}).catch(() => {});
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}
await writeFile(resolve(output, 'comparison.json'), JSON.stringify(report, null, 2));
const failures = report.filter(entry => entry.error).map(({name, error}) => ({name, error}));
console.log(JSON.stringify({ tested: report.length, failures }, null, 2));
assert.deepEqual(failures, []);
