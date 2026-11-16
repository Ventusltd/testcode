'use strict';
// Execute pinned product functions and their actual SHOW MORE callbacks.
// This minimal DOM records model output; it is not a browser/layout proof.
const vm = require('node:vm');
const {createHash, webcrypto} = require('node:crypto');
const {readFileSync} = require('node:fs');
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.events = {}; this.parentNode = null; this._text = ''; }
  set textContent(value) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; this._text = String(value); }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  appendChild(child) { return this.insertBefore(child, null); }
  insertBefore(child, before) {
    if (child.parentNode) child.parentNode.removeChild(child);
    const index = before === null ? this.children.length : this.children.indexOf(before);
    if (index < 0) throw new Error('Invalid DOM insertion');
    this.children.splice(index, 0, child); child.parentNode = this; return child;
  }
  removeChild(child) { const i = this.children.indexOf(child); if (i < 0) throw new Error('Missing DOM child'); this.children.splice(i, 1); child.parentNode = null; return child; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  addEventListener(name, handler) { this.events[name] = handler; }
}

function harness(script) {
  const nodes = Object.fromEntries(['newsStatus', 'liveNews', 'newsArchive'].map(id => [id, new Element('div')]));
  const counters = {network: 0, timers: 0};
  const window = {dispatchEvent() {}};
  const document = {readyState: 'loading', addEventListener() {}, createElement: tag => new Element(tag), getElementById: id => nodes[id]};
  const context = vm.createContext({window, document, Date, URL, TextDecoder, Uint8Array, crypto: webcrypto,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    fetch() { counters.network++; throw new Error('Offline fetch blocked'); },
    setTimeout() { counters.timers++; throw new Error('Offline timers blocked'); }, clearTimeout() {}});
  vm.runInContext(script, context, {timeout: 1500, filename: 'committed-live-news.js'});
  const api = window.pipelineHeadlines;
  if (!api || typeof api.render !== 'function' || typeof api.valid !== 'function') throw new Error('Renderer contract missing');
  return {api, nodes, counters};
}

function drawAll(h, doc, source, now) {
  const before = JSON.stringify(doc);
  h.api.render(doc, source, now);
  const list = h.nodes.liveNews;
  const sizes = [list.children.filter(n => n.className === 'ln-item').length];
  for (let clicks = 0; ; clicks++) {
    const more = list.children.find(n => n.className === 'ln-more');
    if (!more) break;
    if (clicks >= 20 || typeof more.events.click !== 'function') throw new Error('Pagination did not terminate');
    more.events.click();
    sizes.push(list.children.filter(n => n.className === 'ln-item').length);
  }
  const rows = list.children.filter(n => n.className === 'ln-item').map(node => {
    const title = node.children.find(n => n.className === 'ln-title');
    const meta = node.children.find(n => n.className === 'ln-meta');
    return {title: title?.textContent, link: title?.href, credit: meta?.textContent,
      safe: title?.target === '_blank' && title?.rel === 'noopener noreferrer' && title.children.length === 0};
  });
  return {rows, sizes, order: h.nodes.newsStatus.attrs['data-order'], state: h.nodes.newsStatus.attrs['data-state'],
    status: h.nodes.newsStatus.textContent, input_unchanged: before === JSON.stringify(doc)};
}

async function observe(payload) {
  const base = payload.inputs.cases.find(c => c.name === 'current');
  const original = JSON.parse(base.body), now = Date.parse(original.generated_at) + 60000;
  const checks = [], results = [];
  const check = (name, pass) => checks.push({name, pass: pass === true});
  const identities = new Map(original.items.map(item => [new URL(item.link).href, item]));
  const expectedPriority = base.sidecar.entries.map(entry => new URL(entry.link).href);
  const cases = [
    {name: 'missing_sidecar', input: base, accepted: null, order: 'date', state: 'live'},
    {name: 'current', input: base, accepted: true, order: 'priority', state: 'live'},
    {name: 'byte_mismatch', input: base, accepted: false, order: 'date', state: 'live', extraBytes: '\n'},
    {name: 'different_collection', input: base, accepted: false, order: 'date', state: 'live', sidecar: payload.inputs.other_collection_sidecar},
    {name: 'stale', input: base, accepted: true, order: 'date', state: 'overdue', now: now + 37 * 3600000},
    {name: 'snapshot', input: base, accepted: true, order: 'date', state: 'snapshot', source: 'snapshot'},
    ...payload.inputs.cases.filter(c => c.name !== 'current').map(c => ({name: c.name, input: c, accepted: true, order: c.name === 'partial' ? 'priority' : 'date', state: c.name})),
  ];
  let dateOrder;
  for (const scenario of cases) {
    const h = harness(payload.script), doc = JSON.parse(scenario.input.body);
    if (typeof h.api.validatePriority !== 'function') throw new Error('Priority API missing');
    const bytes = new TextEncoder().encode(scenario.input.body + (scenario.extraBytes || ''));
    const accepted = scenario.name === 'missing_sidecar' ? null : await h.api.validatePriority(doc, bytes, scenario.sidecar || scenario.input.sidecar);
    const first = drawAll(h, doc, scenario.source || 'live', scenario.now || now);
    const again = drawAll(h, doc, scenario.source || 'live', scenario.now || now);
    const links = first.rows.map(row => row.link);
    if (scenario.name === 'missing_sidecar') dateOrder = links;
    check(scenario.name + ':validation', accepted === scenario.accepted);
    check(scenario.name + ':label', first.order === scenario.order && first.state === scenario.state);
    check(scenario.name + ':full_inventory', first.rows.length === original.items.length && new Set(links).size === identities.size && links.every(link => identities.has(link)));
    check(scenario.name + ':credits_and_titles', first.rows.every(row => row.title === identities.get(row.link)?.title && row.credit.endsWith(' · ' + identities.get(row.link)?.source) && row.safe));
    check(scenario.name + ':exact_order', JSON.stringify(links) === JSON.stringify(scenario.order === 'priority' ? expectedPriority : dateOrder));
    check(scenario.name + ':pagination', JSON.stringify(first.sizes) === JSON.stringify([12, 24, 36, 48, 60, 69]));
    check(scenario.name + ':repeat_and_clocks', first.input_unchanged && again.input_unchanged && JSON.stringify(first.rows) === JSON.stringify(again.rows));
    check(scenario.name + ':offline', h.counters.network === 0 && h.counters.timers === 0);
    results.push({case: scenario.name, sidecar_accepted: accepted, order: first.order, state: first.state,
      visible_count: first.rows.length, page_sizes: first.sizes, order_sha256: sha(links)});
  }
  // A rejected validation must clear an earlier successful binding of this same object.
  const cached = harness(payload.script), cachedDoc = JSON.parse(base.body);
  const valid = await cached.api.validatePriority(cachedDoc, new TextEncoder().encode(base.body), base.sidecar);
  const rejected = await cached.api.validatePriority(cachedDoc, new TextEncoder().encode(base.body + '\n'), base.sidecar);
  const fallback = drawAll(cached, cachedDoc, 'live', now);
  check('cached_priority_cleared_after_rejection', valid === true && rejected === false && fallback.order === 'date' && sha(fallback.rows.map(r => r.link)) === sha(dateOrder));
  const old = harness(payload.historical_script), oldDoc = JSON.parse(base.body);
  const oldValid = old.api.valid(oldDoc), oldResult = drawAll(old, oldDoc, 'live', now);
  const oldLinks = new Set(oldResult.rows.map(row => row.link));
  const policies = original.items.filter(item => item.category === 'policy');
  const lost = policies.filter(item => !oldLinks.has(new URL(item.link).href)).length;
  const detected = oldValid === true && oldResult.rows.length > 0 && lost > 0 && oldResult.rows.length < original.items.length;
  check('historical_counterexample_is_real_policy_loss', detected);
  check('historical_counterexample_is_not_priority_order', sha(oldResult.rows.map(r => r.link)) !== sha(expectedPriority));
  return {schema: 'testcode.news-renderer-replay.v1', pass: checks.every(c => c.pass), checks, cases: results,
    negative_control: {expected_failure_detected: detected, input_count: original.items.length,
      rendered_count: oldResult.rows.length, missing_policy_count: lost, rendered_order_sha256: sha([...oldLinks])},
    node_version: process.version};
}

if (require.main === module) {
  (async () => {
    try {
      const payload = JSON.parse(readFileSync(0, 'utf8'));
      const result = await observe(payload);
      process.stdout.write(JSON.stringify(result)); process.exitCode = result.pass ? 0 : 1;
    } catch (_) {
      process.stdout.write(JSON.stringify({schema: 'testcode.news-renderer-replay.v1', pass: false, error_kind: 'REPLAY_FAILED', checks: []}));
      process.exitCode = 2;
    }
  })();
}
module.exports = {observe};
