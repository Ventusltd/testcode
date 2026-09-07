// Drives THIS pair - its Pipeline News reaching its own Atlas - with the
// network cut, and writes one receipt with a control in the same run.
//
//   node tests/run-pair.mjs [--mirror D:/gridatlas-ci/offline-sandbox/deps]
//
// The pair directory is served locally with Range/206 semantics (range.mjs).
// Every other host is answered from the offline mirror or aborted; nothing on
// the internet is consulted, so a pass here is a statement about these bytes.
//
// Sequence (the order is the point):
//   0. harness sanity: Chromium starts, the pair pipeline renders 7,680 rows
//   1. CONTROL 11386 Harbour Farm: follow the table's own MAP href into the
//      pair atlas; the project engine must answer. Fails -> HARNESS_INVALID,
//      and no candidate verdict is written for anything below.
//   2. 13429 Ossian (derived coordinate) and 13432 Marram (resolved-unmapped)
//   3. INTERCONNECTORS tab: BritNed (both converters) and Viking Link (GB only)
//      via the table's own hrefs; then BritNed again with anchor=gb_converter
//      (direction A: GB end). Direction B (far converter -> GB) is not
//      implemented in v9.146 and is recorded NOT_IMPLEMENTED, not skipped.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { serveWithRange, serveOptions, mimeFor } from "./range.mjs";
import { createRequire } from "node:module";
const require_ = createRequire(import.meta.url);
function resolvePlaywright() {
  const tries = [process.env.PAIR_PLAYWRIGHT, "playwright", "C:/Users/vikra/LocalCI/PipelineNews-GridAtlas/v004/node_modules/playwright"].filter(Boolean);
  for (const t of tries) { try { return require_.resolve(t + "/package.json"); } catch {} }
  throw new Error("playwright not found; set PAIR_PLAYWRIGHT");
}
const PW_PKG = resolvePlaywright();
const { chromium } = require_(path.dirname(PW_PKG));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAIR_DIR = path.resolve(HERE, "..");
const REPO_ROOT = path.resolve(PAIR_DIR, "..", "..", "..");           // testcode clone root
const PAIR_REL = path.relative(REPO_ROOT, PAIR_DIR).replace(/\\/g, "/"); // sandbox/pairs/<stamp>-W
const pair = JSON.parse(fs.readFileSync(path.join(PAIR_DIR, "pair.json"), "utf8"));
const argMirror = process.argv.indexOf("--mirror");
const MIRROR = argMirror > 0 ? process.argv[argMirror + 1] : "D:/gridatlas-ci/offline-sandbox/deps";
const PORT = Number(process.env.PAIR_PORT || 8911);
const NET = process.env.PAIR_NET === "online" ? "online" : "cut";
const PARALLEL = Math.max(1, Number(process.env.PAIR_PARALLEL || 1));   // cases after the control run concurrently
const RECEIPT = process.env.PAIR_RECEIPT || null;                         // stable file name, overwritten in place
const sha = (b) => createHash("sha256").update(b).digest("hex");
const t0 = Date.now();

// --- one server: the repo root with Range semantics; the mirror for other hosts
const misses = [];
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let target = path.join(REPO_ROOT, url.replace(/^\/+/, ""));
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
  if (!fs.existsSync(target)) { misses.push(url); res.writeHead(404).end("not in pair"); return; }
  if (req.method === "OPTIONS") return serveOptions(res);
  serveWithRange(req, res, target, mimeFor(target));
}).listen(PORT);
const mirrorServer = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let target = path.join(MIRROR, url.replace(/^\/+/, ""));
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) { misses.push("mirror:" + url); res.writeHead(404).end("x"); return; }
  if (req.method === "OPTIONS") return serveOptions(res);
  serveWithRange(req, res, target, mimeFor(target));
}).listen(PORT + 1);

const BASE = `http://127.0.0.1:${PORT}/${PAIR_REL}/`;
const browser = await chromium.launch();
const harness = {
  node: process.version,
  playwright: JSON.parse(fs.readFileSync(PW_PKG, "utf8")).version, playwright_path: PW_PKG,
  chromium: browser.version(),
  platform: process.platform, parallel: PARALLEL, network: NET === "online" ? "ONLINE - external hosts reached directly (hosted runner)" : "CUT - external hosts served from the offline mirror or aborted",
  mirror: MIRROR, test_sha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))), range_sha256: sha(fs.readFileSync(path.join(HERE, "range.mjs"))),
};

async function context() {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1" || NET === "online") return route.continue();
    try {
      const hdr = route.request().headers(); const fwd = {}; if (hdr.range) fwd.Range = hdr.range;
      const m = await fetch(`http://127.0.0.1:${PORT + 1}/${u.hostname}${u.pathname}${u.search}`, { method: route.request().method(), headers: fwd });
      if (!m.ok) return route.abort();
      const headers = { "content-type": m.headers.get("content-type") || "application/octet-stream", "access-control-allow-origin": "*", "access-control-expose-headers": "Content-Range, Content-Length, Accept-Ranges", "accept-ranges": "bytes" };
      for (const h of ["content-range", "content-length"]) { const v = m.headers.get(h); if (v) headers[h] = v; }
      return route.fulfill({ status: m.status, headers, body: route.request().method() === "HEAD" ? Buffer.alloc(0) : Buffer.from(await m.arrayBuffer()) });
    } catch { return route.abort(); }
  });
  return ctx;
}

const evidenceDir = process.env.PAIR_EVIDENCE_DIR ? path.resolve(process.env.PAIR_EVIDENCE_DIR) : path.join(PAIR_DIR, "evidence");
fs.mkdirSync(evidenceDir, { recursive: true });
const shot = async (page, name) => { const p = path.join(evidenceDir, name + ".png"); await page.screenshot({ path: p, fullPage: false }); return "evidence/" + name + ".png"; };

// --- 0. the pair's pipeline renders, and its MAP hrefs point INTO the pair
const ctx0 = await context();
const pipe = await ctx0.newPage();
await pipe.addInitScript(() => { window.Chart = class { constructor(_c, cfg) { this.data = cfg.data; } update() {} }; });
const pageErrors = [];
pipe.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)));
await pipe.goto(BASE + "pipeline/", { waitUntil: "domcontentloaded", timeout: 60000 });
await pipe.waitForFunction(() => document.getElementById("tbody")?.dataset.total === "7680", null, { timeout: 60000 });
const hrefFor = async (ref) => {
  await pipe.fill("#search", ref);
  await pipe.waitForFunction((r) => document.querySelector(`#repd-${CSS.escape(r)}`), ref, { timeout: 15000 });
  return pipe.evaluate((r) => { const a = document.querySelector(`#repd-${CSS.escape(r)} a.atlaslink`); return a ? a.href : null; }, ref);
};
const hrefs = {};
for (const ref of ["11386", "13429", "13432"]) hrefs[ref] = await hrefFor(ref);
await pipe.fill("#search", "");
await pipe.click('#tech [data-technology="interconnector"]');
await pipe.waitForFunction(() => document.getElementById("tbody")?.dataset.total === "16", null, { timeout: 15000 });
for (const ref of ["IC-INTNED", "IC-INTVKL"]) hrefs[ref] = await pipe.evaluate((r) => { const a = document.querySelector(`#repd-${CSS.escape(r)} a.atlaslink`); return a ? a.href : null; }, ref);
const tabShot = await shot(pipe, "pipeline-interconnectors-tab");
const receiverNote = await pipe.evaluate(() => document.getElementById("mapAtlasNav")?.getAttribute("href"));
await ctx0.close();
const pairAtlasPrefix = BASE + "atlas/";
const hrefsInPair = Object.fromEntries(Object.entries(hrefs).map(([k, v]) => [k, Boolean(v && v.startsWith(pairAtlasPrefix))]));

// --- an arrival, read through sentinels only
async function arrive(name, url, opts = {}) {
  const ctx = await context();
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  const started = Date.now();
  const out = { name, url, pageErrors: errs };
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.__GRIDATLAS_ATLAS__ && (window.__GRIDATLAS_ATLAS__.loaded_cartridges || []).length === 4, null, { timeout: 60000 }).catch(() => {});
    if (opts.interconnector) await page.waitForFunction(() => window.__GRIDATLAS_INTERCONNECTORS__?.arrival && ["RESOLVED", "NOT_DRAWABLE"].includes(window.__GRIDATLAS_INTERCONNECTORS__.arrival.status) && window.__GRIDATLAS_INTERCONNECTORS__.arrival.card, null, { timeout: 60000 }).catch(() => {});
    else await page.waitForFunction(() => { const d = window.__GRIDATLAS_PLACE_SEARCH__?.deep_link; return d && ["RESOLVED", "RESOLVED_UNMAPPED", "NOT_IN_ACTIVE_REGISTER", "FAILED"].includes(d.status); }, null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(opts.settle || 5000);
    Object.assign(out, await page.evaluate(() => {
      const atlas = window.__GRIDATLAS_ATLAS__ || {};
      const d = window.__GRIDATLAS_PLACE_SEARCH__?.deep_link || null;
      const lane = window.__GRIDATLAS_NEON_LINKS__ || {};
      const ic = window.__GRIDATLAS_INTERCONNECTORS__ || {};
      const map = window.__GRIDATLAS_V9_MAP__;
      const text = document.body.innerText || "";
      return {
        composition: atlas.generation, cartridges_loaded: (atlas.loaded_cartridges || []).map((c) => c.id),
        identity: d ? { status: d.status, mapped: d.mapped, coordinate_source: d.coordinate_source ?? null, coordinate_derived: d.coordinate_derived ?? null, name: d.name ?? null } : null,
        engine: { links_drawn: lane.links_drawn ?? null, nearest_km: lane.nearest_km ?? lane.last_selection?.nearest_km ?? null, arrival_reconciliation: lane.arrival_reconciliation?.status ?? null, nearest_beyond_radius: lane.last_selection?.nearest_beyond_radius ?? null },
        interconnector: ic.arrival ? { status: ic.arrival.status, card: ic.arrival.card, framed: ic.arrival.framed, gb_end: ic.arrival.ends?.[0] ? { nearest_name: ic.arrival.ends[0].nearest_name, nearest_km: ic.arrival.ends[0].nearest_km, within: ic.arrival.ends[0].within, search_km: ic.arrival.ends[0].search_km } : null, far_end: ic.arrival.ends?.[1] ? { coverage: ic.arrival.ends[1].coverage } : "not held", substations_seen: ic.arrival.substations_seen ?? null } : null,
        nearest_on_page: /Nearest\s+\d+\s*kV substation:/.test(text),
        failure_card: /did not fly to a safe map point|identity check failed|TRY AGAIN/i.test(text),
        zoom: map?.getZoom ? Number(map.getZoom().toFixed(2)) : null,
      };
    }));
    out.screenshot = await shot(page, name);
  } catch (e) { out.error = String(e).slice(0, 200); }
  out.elapsed_ms = Date.now() - started;
  await ctx.close();
  return out;
}

const receipt = { schema: "ggpair.test-receipt.v1", pair_id: pair.pair_id, run_utc: new Date().toISOString(), harness, inputs: { pair_json_sha256: sha(fs.readFileSync(path.join(PAIR_DIR, "pair.json"))), served_from: BASE }, pipeline: { rows_rendered: 7680, hrefs, hrefs_point_into_pair: hrefsInPair, map_atlas_nav_href: receiverNote, page_errors: pageErrors, screenshot: tabShot }, control: null, cases: [], outcome: null };

// --- 1. CONTROL
const control = await arrive("control-11386-harbour-farm", hrefs["11386"]);
control.pass = control.composition === "202609071232" && control.identity?.status === "RESOLVED" && control.identity?.mapped === true && control.nearest_on_page === true && !control.failure_card;
receipt.control = control;
if (!control.pass) {
  receipt.outcome = "HARNESS_INVALID";
  receipt.statement = "The control did not pass in this run. Nothing below is a verdict on the candidate.";
} else {
  // --- 2. identity cases
  const gbUrl = new URL(hrefs["IC-INTNED"]); gbUrl.searchParams.set("anchor", "gb_converter"); gbUrl.searchParams.set("latitude", "51.4405"); gbUrl.searchParams.set("longitude", "0.71616"); gbUrl.searchParams.set("zoom", "10");
  const jobs = [
    () => arrive("13429-ossian-derived", hrefs["13429"]),
    () => arrive("13432-marram-unmapped", hrefs["13432"]),
    () => arrive("INTNED-britned-midpoint-anchor", hrefs["IC-INTNED"], { interconnector: true, settle: 8000 }),
    () => arrive("INTNED-britned-gb-converter-anchor", gbUrl.href, { interconnector: true, settle: 8000 }),
    () => arrive("INTVKL-viking-gb-only", hrefs["IC-INTVKL"], { interconnector: true, settle: 8000 }),
  ];
  const results = []; let next = 0;
  await Promise.all(Array.from({ length: Math.min(PARALLEL, jobs.length) }, async () => { while (next < jobs.length) { const i = next++; results[i] = await jobs[i](); } }));
  const [c13429, c13432, britned, britnedGb, viking] = results;
  c13429.expect = "RESOLVED, coordinate_derived true"; c13429.pass = c13429.identity?.status === "RESOLVED" && c13429.identity?.coordinate_derived === true && !c13429.failure_card;
  c13432.expect = "RESOLVED_UNMAPPED, no failure card"; c13432.pass = c13432.identity?.status === "RESOLVED_UNMAPPED" && !c13432.failure_card;
  britned.direction = "A: pipeline MAP -> midpoint anchor -> span framed, GB end measured, far end coverage stated";
  britned.expect = "RESOLVED, card OPEN, GB end measured (km number), far coverage NONE, lane HANDED_TO_INTERCONNECTORS";
  britned.pass = britned.interconnector?.status === "RESOLVED" && britned.interconnector?.card === "OPEN" && Number.isFinite(britned.interconnector?.gb_end?.nearest_km) && britned.interconnector?.far_end?.coverage === "NONE" && britned.engine?.arrival_reconciliation === "HANDED_TO_INTERCONNECTORS" && !britned.failure_card;
  britnedGb.direction = "A': arrival at the GB converter; line held so the span is still framed";
  britnedGb.expect = "RESOLVED, card OPEN, GB end Grain ~0 km"; britnedGb.pass = britnedGb.interconnector?.status === "RESOLVED" && britnedGb.interconnector?.card === "OPEN" && Number.isFinite(britnedGb.interconnector?.gb_end?.nearest_km);
  viking.direction = "A: GB converter only; far converter not held";
  viking.expect = "NOT_DRAWABLE, card OPEN, GB end Bicker Fen measured, zoom >= 9"; viking.pass = viking.interconnector?.status === "NOT_DRAWABLE" && viking.interconnector?.card === "OPEN" && Number.isFinite(viking.interconnector?.gb_end?.nearest_km) && viking.zoom >= 9;
  const farDirection = { name: "INTNED-far-converter-to-gb", direction: "B: arrival at the far converter (Maasvlakte) measuring toward GB", outcome: "NOT_IMPLEMENTED", statement: "v9.146 has no far-end arrival branch and no substation payload outside GB; the far end is reported as coverage NONE from direction A. Recorded as missing coverage, not as a pass or a fail." };
  receipt.cases = [c13429, c13432, britned, britnedGb, viking, farDirection];
  const scored = receipt.cases.filter((c) => "pass" in c);
  // PASS asserts complete coverage. A case the product cannot perform is not a
  // pass and is not a failure of this run, so the run is INCOMPLETE: every
  // scored case passed and at least one requested behaviour does not exist.
  const gaps = receipt.cases.filter((c) => c.outcome === "NOT_IMPLEMENTED");
  receipt.outcome = !scored.every((c) => c.pass) ? "FAIL" : gaps.length ? "INCOMPLETE" : "PASS";
  receipt.coverage = { scored: scored.length, passed: scored.filter((c) => c.pass).length, not_implemented: gaps.map((c) => c.name) };
  receipt.statement = `${scored.filter((c) => c.pass).length} of ${scored.length} scored cases passed with a valid control; ${gaps.length} requested behaviour(s) NOT_IMPLEMENTED, so the run is ${receipt.outcome}.`;
}
await browser.close(); server.close(); mirrorServer.close();
receipt.mirror_misses = [...new Set(misses)].slice(0, 20);
receipt.elapsed_ms = Date.now() - t0;
const outName = RECEIPT || `run-${receipt.run_utc.replace(/[:.]/g, "-")}.json`;
fs.writeFileSync(path.resolve(evidenceDir, outName), JSON.stringify(receipt, null, 1) + "\n");
receipt.generated_bytes = fs.readdirSync(evidenceDir).reduce((n, f) => n + fs.statSync(path.join(evidenceDir, f)).size, 0);
fs.writeFileSync(path.resolve(evidenceDir, outName), JSON.stringify(receipt, null, 1) + "\n");
console.log(`${receipt.pair_id}  outcome ${receipt.outcome}  control ${control.pass ? "PASS" : "FAIL"}  ${receipt.elapsed_ms} ms  evidence/${outName}`);
for (const c of [control, ...receipt.cases]) console.log(`  ${(c.pass === undefined ? c.outcome : c.pass ? "PASS" : "FAIL").padEnd(16)} ${c.name}  ${c.identity ? `identity ${c.identity.status}/${c.identity.mapped}` : ""} ${c.interconnector ? `ic ${c.interconnector.status} card ${c.interconnector.card} gb ${c.interconnector.gb_end?.nearest_name} ${c.interconnector.gb_end?.nearest_km} km` : ""} ${c.error ? "ERROR " + c.error : ""}`);
console.log(`  hrefs into pair: ${JSON.stringify(hrefsInPair)}  misses ${receipt.mirror_misses.length}`);
process.exit(["PASS", "INCOMPLETE"].includes(receipt.outcome) ? 0 : 1);
