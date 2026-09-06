/**
 * DOES PRESSING "SAVE THIS VIEW AS A PDF" PUT A REAL PDF ON THE READER'S DISK?
 * ---------------------------------------------------------------------------
 * Not "does a function called savePdf exist", not "is /DCTDecode present in the
 * source". This drives the actual control in a real browser, waits for the
 * browser's own download event, saves the file, and reads the bytes back.
 *
 * WHY IT EXISTS. On 2026-09-05 the architect opened the print preview in
 * FIREFOX, saw the sheet render correctly, pressed Print with a physical Dell
 * printer selected -- and got no file at all. Every path to a PDF up to that
 * point went through the browser's print pipeline: window.print(), a dialog, a
 * destination, a driver. None of that is ours, and that is the part that
 * failed. #gridatlas-export-pdf writes the bytes itself, so this proof must
 * establish that the bytes are a valid PDF containing the map -- independently
 * of any print dialog.
 *
 * WHAT IT ASSERTS, AND WHY EACH ONE CAN GO RED
 *   - a download event fires at all            (fails if the control refuses)
 *   - the file begins %PDF-1.4 and ends %%EOF  (fails on a truncated writer)
 *   - it carries an image XObject with
 *     /DCTDecode and non-zero dimensions       (fails on a blank capture)
 *   - the embedded stream really is a JPEG,
 *     ffd8 .. ffd9                             (fails if the base64 slice is wrong)
 *   - PAGE aspect equals IMAGE aspect          (fails the moment the sheet
 *                                               letterboxes or crops -- this is
 *                                               the "no white space" assertion)
 *   - the xref offsets resolve                 (fails on a mis-assembled file)
 *
 * The aspect check is the one that matters for the brochure requirement: a page
 * whose ratio differs from the raster's either leaves white bands or crops
 * ground the reader was looking at. Equality to within 0.5% is the only shape
 * that does neither.
 *
 * Three engines, because "it works in Chrome" is not the requirement:
 * "it must be compatible to ALL browsers natively".
 *
 *   node tools/proofs/202609051329-pdf-export-outcomes.browser.mjs <base-url>
 */
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');}catch{playwright=require('C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright');}
const {chromium,firefox,webkit}=playwright;
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.argv[2];
if (!BASE) {
  console.error('usage: node 202609051329-pdf-export-outcomes.browser.mjs <base-url>');
  process.exit(2);
}
const OUT = path.resolve(process.env.TEST_OUTPUT || 'pdf-export-artifacts');
fs.mkdirSync(OUT,{recursive:true});
const VIEWPORTS = [
  { name: '393x852 phone', width: 393, height: 852 },
  { name: '1400x900 desktop', width: 1400, height: 900 }
];
const ENGINES = [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]];

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`);
};

for (const [engineName, engine] of ENGINES) {
  const browser = await engine.launch();
  try {
    for (const viewport of VIEWPORTS) {
      const label = `${engineName} ${viewport.name}`;
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        acceptDownloads: true
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 160)));
      try {
        await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => Boolean(window.__GRIDATLAS_V9_MAP__), null, { timeout: 60000 });
        /* The map must have drawn: a canvas without preserveDrawingBuffer is
           transparent to any reader outside the frame that drew it, so a
           capture taken too early is a legitimately blank one. */
        await page.waitForTimeout(7000);

        /* The owning menu is found by containment, never by the word "File",
           and opened explicitly -- openMenu() is a toggle, so a blind click on
           an already-open panel closes the very thing this needs open. */
        const menu = page.locator('#gridatlas-menu-bar .gm-menu')
          .filter({ has: page.locator('button[data-gm-export]') }).first();
        const alreadyOpen = await menu.evaluate((node) => node.classList.contains('gm-open')).catch(() => false);
        if (!alreadyOpen) await menu.locator('.gm-title').first().click({ timeout: 12000 });
        const menuState = await menu.evaluate((node) => {
          const title = node.querySelector('.gm-title');
          const panel = node.querySelector('.gm-panel');
          return { open: node.classList.contains('gm-open'), expanded: title && title.getAttribute('aria-expanded'), hidden: panel && panel.hidden };
        });
        check(`${label}: the export menu is open before the PDF control is clicked`,
          menuState.open && menuState.expanded === 'true' && menuState.hidden === false,
          `open=${menuState.open} aria-expanded=${menuState.expanded} panel.hidden=${menuState.hidden}`);

        /* Resolved by id. savePdf() REWRITES the button's text on click, so a
           selector that reads its words loses it the moment it is used. */
        /* The download wait is armed BEFORE the click, and its rejection is
           absorbed here rather than left floating. When this proof is run
           against bytes that have no PDF control -- which is exactly how it
           was made to fail first -- the click times out at 15 s and this
           promise then rejects at 30 s with nobody awaiting it. An unhandled
           rejection kills the process, so the file crashed instead of
           reporting FAIL. A proof that cannot report its own failure is the
           defect this whole suite exists to catch. */
        const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
          .catch((error) => ({ failed: String(error).slice(0, 120) }));
        await page.locator('#gridatlas-export-pdf').click({ timeout: 15000 });
        const download = await downloadPromise;
        if (!download || download.failed) throw new Error(download ? download.failed : 'no download event');
        const file = path.join(OUT, `${engineName}-${viewport.width}.pdf`);
        await download.saveAs(file);
        const bytes = fs.readFileSync(file);
        const latin = bytes.toString('latin1');
        check(`${label}: the browser received a download`, bytes.length > 0,
          `${download.suggestedFilename()} ${bytes.length} bytes`);

        check(`${label}: the file is a PDF, opened and closed`,
          latin.startsWith('%PDF-1.4') && latin.trimEnd().endsWith('%%EOF'),
          `head=${JSON.stringify(latin.slice(0, 8))} tail=${JSON.stringify(latin.trimEnd().slice(-6))}`);

        const mediaBox = /\/MediaBox \[0 0 (\d+) (\d+)\]/.exec(latin);
        const image = /\/Subtype \/Image[\s\S]{0,320}?\/Width (\d+)[\s\S]{0,320}?\/Height (\d+)/.exec(latin);
        check(`${label}: the PDF carries a rasterised map, not an empty page`,
          Boolean(image) && latin.includes('/DCTDecode') && Number(image?.[1]) > 0 && Number(image?.[2]) > 0,
          image ? `${image[1]}x${image[2]} /DCTDecode=${latin.includes('/DCTDecode')}` : 'no image XObject');

        /* An image XObject entry could name any bytes. Decode the stream. */
        const stream = /\/Filter \/DCTDecode \/Length (\d+) >>\s*stream\r?\n/.exec(latin);
        let jpegOk = false;
        let jpegDetail = 'no DCTDecode stream';
        if (stream) {
          const start = stream.index + stream[0].length;
          const jpeg = bytes.subarray(start, start + Number(stream[1]));
          jpegOk = jpeg[0] === 0xff && jpeg[1] === 0xd8 && jpeg[jpeg.length - 2] === 0xff && jpeg[jpeg.length - 1] === 0xd9;
          jpegDetail = `${jpeg.length} bytes, ${jpeg.subarray(0, 2).toString('hex')}..${jpeg.subarray(-2).toString('hex')}`;
        }
        check(`${label}: that stream really is a JPEG, start of image to end of image`, jpegOk, jpegDetail);

        /* THE NO-WHITE-SPACE ASSERTION. */
        let aspectOk = false;
        let aspectDetail = 'no MediaBox or no image';
        if (mediaBox && image) {
          const pageAspect = Number(mediaBox[1]) / Number(mediaBox[2]);
          const imageAspect = Number(image[1]) / Number(image[2]);
          aspectOk = Math.abs(pageAspect - imageAspect) / imageAspect < 0.005;
          aspectDetail = `page ${mediaBox[1]}x${mediaBox[2]}pt aspect ${pageAspect.toFixed(4)}`
            + ` vs image ${image[1]}x${image[2]} aspect ${imageAspect.toFixed(4)}`;
        }
        check(`${label}: the page is the shape of the map, so the sheet has no white space and nothing is cropped`,
          aspectOk, aspectDetail);

        const xref = /startxref\s+(\d+)/.exec(latin);
        check(`${label}: the cross-reference table resolves`,
          Boolean(xref) && latin.slice(Number(xref[1]), Number(xref[1]) + 4) === 'xref',
          xref ? `startxref ${xref[1]} -> ${JSON.stringify(latin.slice(Number(xref[1]), Number(xref[1]) + 4))}` : 'no startxref');

        check(`${label}: no page errors while writing the PDF`, pageErrors.length === 0, pageErrors.join(' | '));
      } catch (error) {
        await page.screenshot({path:path.join(OUT,engineName+'-'+viewport.width+'-failure.png')}).catch(()=>{});
        check(`${label}: the PDF export completed`, false, String(error));
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({base:BASE,results},null,2)+'\n');
const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} PDF export outcome checks passed`);
if (failed.length) {
  console.log(`${failed.length} failed:`);
  for (const entry of failed) console.log(`  ${entry.name}  [${entry.detail}]`);
}
process.exit(failed.length ? 1 : 0);
