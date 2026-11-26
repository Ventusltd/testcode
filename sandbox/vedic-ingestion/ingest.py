"""Read-only incremental catalogue from two pinned Modular Star snapshots.
Never allocates Stars or VEDIC IDs, executes source, or publishes a dashboard.
"""
import argparse
from contextlib import closing
import hashlib
import json
import sqlite3
import struct
from pathlib import Path

SCHEMA = 'vedic.incremental-candidates.v1'
# Owner-priority navigation hints, NOT classifications or runtime proof.
PRIORITY = ('See Through', 'Kuiper', 'Solar Design Studio', 'LiDAR',
            'Ventus Grid Engine', 'Vicinity', 'Substation locations',
            'GridAtlas', 'GIS SLD Financial Sandbox')
IDENTITIES = {
    'line': ('sha', 'text'), 'tablet': ('git_blob', 'lang', 'lines', 'issue'),
    'family': ('sha', 'lang'),
    'element': ('sha', 'family', 'kind', 'needs', 'standalone'),
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def application_hints(repo, path):
    r, p = repo.casefold(), path.casefold()
    tags = set()
    if r == 'ventusltd/kuiper-belt':
        tags.add('Kuiper')
        if p.startswith('see-through/'):
            tags.add('See Through')
    if r == 'ventusltd/globalgrid2050' and p.startswith(('kuiper/', 'kuiper-editions/')):
        tags.add('Kuiper')
    if r == 'ventusltd/energy-transition-simulator' or (r == 'ventusltd/globalgrid2050' and p.startswith(('energy-transition-simulator/', 'solar-design-studio/'))):
        tags.add('Solar Design Studio')
    if r in ('ventusltd/lidar', 'ventusltd/world-lidar'):
        tags.add('LiDAR')
    if r == 'ventusltd/ventus-grid-engine':
        tags.add('Ventus Grid Engine')
    if r == 'ventusltd/gridatlas':
        tags.add('GridAtlas')
        if 'vicinity' in p:
            tags.add('Vicinity')
    if r in ('ventusltd/gridatlas', 'ventusltd/ventus-grid-engine', 'ventusltd/data-grid-gb') and any(s in p for s in ('substation', 'nearest-search', 'geodesy')):
        tags.add('Substation locations')
    if r == 'ventusltd/gis-sld-sandbox' or (r == 'ventusltd/globalgrid2050' and 'gis-sld' in p):
        tags.add('GIS SLD Financial Sandbox')
    return [x for x in PRIORITY if x in tags]


def packed_ids(blob):
    require(isinstance(blob, bytes) and len(blob) % 4 == 0, 'malformed uint32 LE tablet')
    ids = [x[0] for x in struct.iter_unpack('<I', blob)]
    require(all(ids), 'invalid zero line ID')
    return ids


def connect_ro(path):
    return sqlite3.connect(path.resolve().as_uri() + '?mode=ro&immutable=1', uri=True)


def delta(before, after, before_sha, after_sha):
    before, after = Path(before), Path(after)
    require(digest(before) == before_sha and digest(after) == after_sha, 'snapshot digest mismatch')
    for path in (before, after):
        require(not any(Path(str(path) + ext).exists() for ext in ('-wal', '-journal')), 'snapshot has SQLite sidecar; checkpoint first')
    with closing(connect_ro(after)) as db:
        db.row_factory = sqlite3.Row
        db.execute('ATTACH DATABASE ? AS prior', (before.resolve().as_uri() + '?mode=ro&immutable=1',))
        db.execute('PRAGMA query_only=ON')
        for schema in ('main', 'prior'):
            require([r[0] for r in db.execute(f'PRAGMA {schema}.quick_check')] == ['ok'], 'SQLite integrity failure')
            require(db.execute(f'SELECT count(*) FROM {schema}.line').fetchone()[0] > 0, 'empty line inventory')
            require(db.execute(f'SELECT count(*) FROM {schema}.scan').fetchone()[0] > 0, 'empty scan inventory')
        for table, columns in IDENTITIES.items():
            different = ' OR '.join(f'n.{c} IS NOT o.{c}' for c in columns)
            bad = db.execute(f'SELECT o.n FROM prior.{table} o LEFT JOIN main.{table} n ON n.n=o.n WHERE n.n IS NULL OR {different} LIMIT 1').fetchone()
            require(bad is None, f'permanent identity changed or missing: {table}')
            reused = db.execute(f'SELECT n.n FROM main.{table} n LEFT JOIN prior.{table} o ON o.n=n.n WHERE o.n IS NULL AND n.n <= (SELECT max(n) FROM prior.{table}) LIMIT 1').fetchone()
            require(reused is None, f'permanent ID gap reused: {table}')
        # Membership and occurrence provenance are append-only; scan is mutable.
        for table, keys, cols in (
            ('tablet_element', ('tablet','element','first'), ('last','col0','col1','name')),
            ('occurrence', ('repo','commit_sha','path'), ('tablet','seen_utc')),
        ):
            join = ' AND '.join(f'n.{k}=o.{k}' for k in keys)
            different = ' OR '.join(f'n.{c} IS NOT o.{c}' for c in cols)
            bad = db.execute(f'SELECT 1 FROM prior.{table} o LEFT JOIN main.{table} n ON {join} WHERE n.{keys[0]} IS NULL OR {different} LIMIT 1').fetchone()
            require(bad is None, f'historical provenance changed: {table}')
        new_lines = {}
        for row in db.execute('SELECT n.n,n.sha,n.text FROM main.line n LEFT JOIN prior.line o ON o.n=n.n WHERE o.n IS NULL ORDER BY n.n'):
            require(row['n'] > 0 and hashlib.sha256(row['text']).digest() == row['sha'], 'new line digest invalid')
            new_lines[row['n']] = {'line_id': row['n'], 'sha256': row['sha'].hex(), 'application_hints': []}
        new_families = [dict(r) for r in db.execute('SELECT n.n AS family_id,lower(hex(n.sha)) AS sha256,n.lang FROM main.family n LEFT JOIN prior.family o ON o.n=n.n WHERE o.n IS NULL ORDER BY n.n')]
        # A current scan is an indexed commit, not evidence that the product is live.
        sql = """WITH active AS (SELECT o.* FROM main.occurrence o JOIN main.scan s ON s.repo=o.repo AND s.commit_sha=o.commit_sha WHERE s.issue IS NULL),
        old_active AS (SELECT o.* FROM prior.occurrence o JOIN prior.scan s ON s.repo=o.repo AND s.commit_sha=o.commit_sha WHERE s.issue IS NULL),
        changed AS (SELECT a.repo,a.commit_sha,a.path,a.tablet,'CURRENT_SCAN' AS scope FROM active a LEFT JOIN old_active b ON b.repo=a.repo AND b.path=a.path WHERE b.tablet IS NULL OR a.tablet != b.tablet),
        history AS (SELECT o.repo,min(o.commit_sha) AS commit_sha,o.path,o.tablet,'NEW_HISTORICAL_TABLET' AS scope FROM main.occurrence o LEFT JOIN prior.tablet p ON p.n=o.tablet WHERE p.n IS NULL AND NOT EXISTS (SELECT 1 FROM active a WHERE a.repo=o.repo AND a.path=o.path AND a.tablet=o.tablet) GROUP BY o.repo,o.path,o.tablet)
        SELECT * FROM changed UNION ALL SELECT * FROM history ORDER BY repo,path,commit_sha"""
        files = []
        cached = {}
        for row in db.execute(sql):
            repo, commit, path, tablet, scope = tuple(row)
            require(bool(repo and path) and len(commit) == 40 and all(c in "0123456789abcdef" for c in commit), "invalid source occurrence")
            if tablet not in cached:
                t = db.execute('SELECT git_blob,lines,issue FROM tablet WHERE n=?', (tablet,)).fetchone()
                require(t is not None, 'missing tablet')
                ids = packed_ids(t['lines'])
                # Reconstruct byte-exact Git blob using the producer line order.
                source = bytearray()
                for i in ids:
                    line = db.execute('SELECT text FROM line WHERE n=?', (i,)).fetchone()
                    require(line is not None, 'missing permanent line ID')
                    source.extend(line[0])
                git_blob = hashlib.sha1(f'blob {len(source)}\0'.encode() + source).hexdigest()
                require(git_blob == t['git_blob'], 'tablet reconstruction mismatch')
                spans = []
                for e in db.execute('''SELECT te.element AS element_id,e.family AS family_id,te.first,te.last,te.col0,te.col1,te.name,e.kind,e.standalone,f.n AS resolved_family FROM tablet_element te LEFT JOIN element e ON e.n=te.element LEFT JOIN family f ON f.n=e.family WHERE te.tablet=? ORDER BY te.first,te.last,te.element''', (tablet,)):
                    require(e['resolved_family'] is not None and 1 <= e['first'] <= e['last'] <= len(ids), 'invalid element membership')
                    d = dict(e); d.pop('resolved_family')
                    d['unique_line_ids'] = sorted(set(ids[e['first']-1:e['last']]))
                    spans.append(d)
                cached[tablet] = (git_blob, ids, spans, t['issue'])
            git_blob, ids, spans, issue = cached[tablet]
            hints = application_hints(repo, path)
            fresh = sorted(set(ids) & new_lines.keys())
            for i in fresh:
                new_lines[i]['application_hints'] = sorted(set(new_lines[i]['application_hints']) | set(hints), key=PRIORITY.index)
            files.append({'repo':repo,'commit_sha':commit,'path':path,'tablet_id':tablet,'git_blob':git_blob,
                          'application_hints':hints,'priority':0 if hints else 1,'new_line_ids':fresh,
                          'elements':spans,'parse_issue':issue,'vedic_id':None,'meaning':None,
                          'state':'SOURCE_INDEXED_CANDIDATE','occurrence_scope':scope,'runtime_verified':False})
        files.sort(key=lambda f:(f['priority'], f['repo'], f['path'], f['commit_sha']))
        lines = sorted(new_lines.values(), key=lambda x:(not bool(x['application_hints']), x['line_id']))
        scan_issues = [dict(r) for r in db.execute('SELECT repo,issue FROM scan WHERE issue IS NOT NULL OR commit_sha IS NULL ORDER BY repo')]
        removed = [dict(r) for r in db.execute('''SELECT o.repo,o.path,o.commit_sha AS prior_commit_sha FROM prior.occurrence o JOIN prior.scan s ON s.repo=o.repo AND s.commit_sha=o.commit_sha AND s.issue IS NULL JOIN main.scan n ON n.repo=o.repo AND n.issue IS NULL AND n.commit_sha IS NOT NULL LEFT JOIN main.occurrence a ON a.repo=o.repo AND a.commit_sha=n.commit_sha AND a.path=o.path WHERE a.path IS NULL ORDER BY o.repo,o.path''')]
    require(digest(before) == before_sha and digest(after) == after_sha, 'snapshot changed during read')
    return {'schema':SCHEMA,'before_sha256':before_sha,'after_sha256':after_sha,
            'new_unique_lines':len(lines),'new_lines':lines,'new_families':new_families,
            'changed_active_files':[f for f in files if f['occurrence_scope']=='CURRENT_SCAN'],
            'historical_candidates':[f for f in files if f['occurrence_scope']=='NEW_HISTORICAL_TABLET'],
            'unmapped_new_line_ids':sorted(set(new_lines)-{i for f in files for i in f['new_line_ids']}),
            'removed_from_successful_scans':removed,'scan_issues':scan_issues,
            'translated_unique_lines':None,'scope':'Producer-indexed delta, not semantic translation or live application proof. Unchanged content is not re-catalogued; historical candidates retain one exact occurrence per repo/path/new tablet. Unmapped lines remain explicit.'}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--before',type=Path,required=True); p.add_argument('--after',type=Path,required=True)
    p.add_argument('--before-sha',required=True); p.add_argument('--after-sha',required=True)
    p.add_argument('--output',type=Path,required=True)
    a = p.parse_args()
    report = delta(a.before,a.after,a.before_sha,a.after_sha)
    with a.output.open('x',encoding='utf-8') as f:
        json.dump(report,f,sort_keys=True,indent=2); f.write('\n')
    print(f"{report['new_unique_lines']} new producer line IDs; {len(report['changed_active_files'])} changed active files")


if __name__ == '__main__':
    main()
