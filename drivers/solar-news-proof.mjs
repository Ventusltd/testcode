#!/usr/bin/env node
/**
 * Solar news independent proof v2 — offline, read-only.
 *
 * Evaluates *supplied local bytes*, not the generator's own "PASS" result.
 * This driver NEVER fetches, edits, publishes, approves or changes a pointer.
 * Independent policy evidence, legal source rights and browser acceptance are
 * separate gates. Use --previous to detect stale replay with a refreshed stamp.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function dateDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value
    ? Math.floor(d.valueOf() / 86400000) : null;
}

function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function isHttpsLink(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password;
  } catch { return false; }
}

const NEWS = new Set(['bbc', 'trade', 'national', 'regional']);

export function audit(top, candidate, previous = null, now = new Date()) {
  const errors = [], warnings = [], facts = {
    projects: 0, projects_with_news: 0, recent_confirmed_news: 0,
    recent_fetched_news: 0, historical_or_undated: 0,
    search_fallbacks: 0, verified_direct_planning: 0,
    cross_project_article_urls: 0, source_failures: 0,
    new_recent_fetched_links: 0
  };
  const fail = message => errors.push(message);
  const warn = message => warnings.push(message);
  const nowMs = now instanceof Date ? now.valueOf() : Number.NaN;
  if (!Number.isFinite(nowMs)) throw new TypeError('invalid independent audit clock');
  const today = Math.floor(nowMs / 86400000);

  if (!Array.isArray(top) || top.length !== 200) {
    fail('authoritative top-200 selection is not exactly 200 rows');
  }
  const expected = new Set((Array.isArray(top) ? top : []).map(r => String(r.repd_ref)));
  if (expected.size !== 200) fail('authoritative top-200 contains missing or duplicate REPD refs');
  if (!candidate || candidate.schema !== 'project-signals.v1' || !candidate.projects ||
      typeof candidate.projects !== 'object' || Array.isArray(candidate.projects)) {
    fail('invalid combined project-signals schema');
    return { status: 'FAIL', errors, warnings, facts };
  }
  const keys = Object.keys(candidate.projects);
  facts.projects = keys.length;
  if (keys.length !== 200 || keys.some(ref => !expected.has(ref))) {
    fail('candidate keys differ from canonical top-200 REPD references');
  }
  if (candidate.counts?.projects !== 200) fail('candidate project count is not 200');
  const generated = instant(candidate.generated_at);
  if (generated === null || generated > nowMs + 5 * 60000) {
    fail('invalid or future generated_at');
  }
  const priorStamp = previous ? instant(previous.generated_at) : null;
  if (previous && priorStamp === null) fail('invalid previous generated_at');
  const oldLinks = new Set();
  if (previous?.projects && typeof previous.projects === 'object') {
    for (const [ref, project] of Object.entries(previous.projects)) {
      for (const signal of (project?.signals || [])) {
        if (signal && typeof signal.link === 'string') oldLinks.add(ref + '\0' + signal.link);
      }
    }
  }
  const articleProjects = new Map();

  for (const [ref, project] of Object.entries(candidate.projects)) {
    if (typeof project !== 'object' || !project || String(project.repd_ref) !== ref) {
      fail('project REPD identity mismatch: ' + ref);
      continue;
    }
    const signals = project.signals;
    if (!Array.isArray(signals) || signals.length > 5) {
      fail('invalid or over-cap signal array: ' + ref);
      continue;
    }
    const seen = new Set();
    let hasNews = false;
    for (const signal of signals) {
      if (!signal || typeof signal !== 'object') { fail('invalid signal: ' + ref); continue; }
      if (String(signal.repd_ref) !== ref) fail('signal REPD identity mismatch: ' + ref);
      if (!isHttpsLink(signal.link)) fail('signal has non-HTTPS URL: ' + ref);
      if (typeof signal.title !== 'string' || !signal.title.trim()) fail('missing headline: ' + ref);
      if (seen.has(signal.link)) fail('same URL twice within project: ' + ref);
      seen.add(signal.link);
      if (!articleProjects.has(signal.link)) articleProjects.set(signal.link, new Set());
      articleProjects.get(signal.link).add(ref);
      const day = signal.date == null ? null : dateDay(signal.date);
      if (signal.date != null && day === null) fail('invalid article calendar date: ' + ref);
      if (day !== null && day > today) fail('future article date: ' + ref);
      const recent = day !== null && today - day >= 0 && today - day <= 14;
      const news = NEWS.has(signal.family);
      hasNews ||= news;
      if (!recent) facts.historical_or_undated++;
      if (recent && news && signal.confidence === 'confirmed') facts.recent_confirmed_news++;
      // An upstream "confirmed" flag is self-reported, NOT independent proof.
      const fetched = !String(signal.basis || '').startsWith('reviewed');
      if (recent && news && fetched) {
        facts.recent_fetched_news++;
        if (!oldLinks.has(ref + '\0' + signal.link)) facts.new_recent_fetched_links++;
      }
    }
    if (hasNews) facts.projects_with_news++;
    const planning = project.planning_file;
    if (!planning || !isHttpsLink(planning.url)) {
      fail('missing usable planning fallback URL: ' + ref);
    } else if (planning.kind === 'search_page') {
      facts.search_fallbacks++;
      if (planning.verified === true) fail('generic planning search marked verified: ' + ref);
    } else if (planning.verified === true) {
      facts.verified_direct_planning++;
    }
  }
  facts.cross_project_article_urls = [...articleProjects.values()].filter(refs => refs.size > 1).length;
  if (facts.cross_project_article_urls) warn('shared article links across projects require event-level attribution');

  const sources = candidate.sources;
  if (!Array.isArray(sources)) {
    fail('missing source-health ledger');
  } else {
    facts.source_failures = sources.filter(s => s?.status === 'failed').length;
    const usable = sources.some(s => s?.status === 'ok' || s?.status === 'partial');
    if (!usable) fail('no successful/partial source in ledger');
    if (facts.source_failures) warn('some sources failed; coverage is partial');
  }
  if (previous && generated !== null && priorStamp !== null &&
      generated > priorStamp && facts.new_recent_fetched_links === 0) {
    fail('refreshed generated_at without any new recent fetched news link');
  }
  if (facts.recent_fetched_news === 0) warn('zero recent fetched news: all other links may be archival');
  warn('publisher licences and per-link source receipts are NOT established by this structural audit');
  return { status: errors.length ? 'FAIL' : 'PASS', errors, warnings, facts };
}

function valueAfter(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

async function main() {
  const args = process.argv.slice(2);
  const topFile = valueAfter(args, '--top200');
  const candidateFile = valueAfter(args, '--candidate');
  const previousFile = valueAfter(args, '--previous');
  const output = valueAfter(args, '--out');
  if (!topFile || !candidateFile) {
    throw new Error('usage: node drivers/solar-news-proof.mjs --top200 top200_solar.json --candidate project_signals.json [--previous prior.json] [--out receipt.json]');
  }
  const files = { top200: topFile, candidate: candidateFile };
  if (previousFile) files.previous = previousFile;
  const bytes = {}, data = {}, hashes = {};
  for (const [role, file] of Object.entries(files)) {
    bytes[role] = await readFile(file);
    hashes[role] = createHash('sha256').update(bytes[role]).digest('hex');
    data[role] = JSON.parse(bytes[role].toString('utf8'));
  }
  const report = { schema: 'testcode.solar-news-proof.v2', checked_at: new Date().toISOString(),
    inputs_sha256: hashes,
    ...audit(data.top200, data.candidate, data.previous) };
  const result = JSON.stringify(report, null, 2) + '\n';
  if (output) await writeFile(output, result);
  process.stdout.write(result);
  if (report.status !== 'PASS') process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    process.stderr.write(String(error.stack || error) + '\n');
    process.exitCode = 2;
  });
}
