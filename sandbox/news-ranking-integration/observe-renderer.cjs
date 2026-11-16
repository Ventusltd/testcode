'use strict';
// Executes the supplied existing renderer, not a reimplementation of its sort.
const vm = require('node:vm');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', part => { input += part; });
process.stdin.on('end', () => {
  const payload = JSON.parse(input);
  class Node {
    constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this._text = ''; this.parentNode = null; }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(node => node.textContent).join(''); }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    insertBefore(child, before) { child.parentNode = this; const i = this.children.indexOf(before); if (i < 0) this.children.push(child); else this.children.splice(i, 0, child); return child; }
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    addEventListener() {}
  }
  const nodes = Object.fromEntries(['newsStatus', 'liveNews', 'newsArchive'].map(id => [id, new Node('div')]));
  const window = {dispatchEvent() {}};
  const document = {readyState: 'loading', addEventListener() {}, createElement: tag => new Node(tag), getElementById: id => nodes[id]};
  const context = vm.createContext({window, document, Date, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    fetch() { throw new Error('network forbidden in offline observation'); }, setTimeout() { throw new Error('timer forbidden in offline observation'); }, clearTimeout() {}});
  vm.runInContext(payload.script, context, {timeout: 1500, filename: 'pinned-live-news.js'});
  const api = window.pipelineHeadlines;
  if (!api || typeof api.render !== 'function') throw new Error('pipelineHeadlines renderer contract missing');
  const accepted = api.valid(payload.doc);
  api.render(payload.doc, payload.source, payload.now);
  const titles = [];
  const links = [];
  function visit(node) {
    if (node.className === 'ln-title') { titles.push(node.textContent); links.push(node.href || null); }
    node.children.forEach(visit);
  }
  visit(nodes.liveNews);
  process.stdout.write(JSON.stringify({accepted, titles, links, state: nodes.newsStatus.attrs['data-state'], status: nodes.newsStatus.textContent}));
});
