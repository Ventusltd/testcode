"""Offline integration observation of pinned ranking and existing renderer.

This intentionally proves known incompatibilities, not release readiness.
No source checkout, collector, data branch or release file is modified.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib
import json
from pathlib import Path
import socket
import subprocess
import sys

HERE = Path(__file__).resolve().parent
AS_OF = '2026-11-16T17:00:00Z'


def fixture():
    def item(title, link, source, date, category):
        return dict(title=title, link=link, source=source, date=date,
                    first_seen='2026-11-16T16:00:00Z', category=category,
                    technology='solar' if 'solar' in title else None, possible_match=None)
    return [
        item('UK solar policy consultation published', 'https://www.gov.uk/example/solar-policy', 'Government (synthetic)', '2026-11-14T12:00:00Z', 'policy'),
        item('UK solar farm approved', 'https://www.bbc.co.uk/news/example-solar', 'BBC (synthetic)', '2026-11-15T12:00:00Z', 'consent'),
        item('UK data centres funding announced', 'https://www.bloomberg.com/news/example-dc', 'Bloomberg (synthetic)', '2026-11-16T12:00:00Z', 'datacentre'),
        item('UK solar farm construction', 'https://example.org/undated-solar', 'Undated (synthetic)', None, 'construction'),
    ]


def checked_files(root, pins):
    output = {}
    for relative, expected in pins.items():
        raw = (root / relative).read_bytes()
        # Git worktrees may check text out as CRLF. Pin committed LF bytes.
        raw = raw.replace(b'\r\n', b'\n')
        if hashlib.sha256(raw).hexdigest() != expected:
            raise ValueError('source hash mismatch: ' + relative)
        output[relative] = raw
    return output


def render(script, doc, source='live'):
    payload = dict(script=script, doc=doc, source=source, now=1794848400000)
    result = subprocess.run(['node', str(HERE / 'observe-renderer.cjs')],
                            input=json.dumps(payload), text=True, capture_output=True,
                            timeout=10, check=True)
    return json.loads(result.stdout)


def observe(producer_root, consumer_root):
    pins = json.loads((HERE / 'pins.json').read_text(encoding='utf-8'))
    checked_files(producer_root, pins['producer']['files'])
    consumer = checked_files(consumer_root, pins['consumer']['files'])
    script = consumer[pins['consumer']['renderer']].decode('utf-8')
    schema = json.loads(consumer[pins['consumer']['schema']])
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(producer_root))
    def deny(*args, **kwargs):
        raise RuntimeError('network forbidden in offline observation')
    socket.socket.connect = deny
    socket.socket.connect_ex = deny
    socket.socket.sendto = deny
    socket.create_connection = deny
    ranking = importlib.import_module('automation.news.news_algorithm')
    incoming = fixture()
    untouched = copy.deepcopy(incoming)
    ranked = ranking.rank_headlines(incoming, as_of=AS_OF)
    first = render(script, ranked)
    # Deliberately demonstrate why simply wrapping ranked items is insufficient.
    doc = dict(schema='globalgrid2050.news.pipeline-headlines.v1', generated_at=AS_OF,
               status='ok', counts=dict(items=4, with_possible_match=0, feeds_ok=3, feeds_failed=0,
                                        by_category=dict(policy=1, consent=1, datacentre=1, construction=1)),
               limits=dict(max_items=200, max_age_days=120), scope='Synthetic integration fixture; no real source claims.',
               feeds=[], items=ranked['items'])
    live = render(script, doc)
    saved = render(script, doc, 'snapshot')
    failed_doc = dict(doc, status='failed')
    failed = render(script, failed_doc)
    undated = next(row for row in ranked['items'] if row['date'] is None)
    unsafe = copy.deepcopy(doc)
    unsafe['items'] = [dict(incoming[1], title='<img src=x onerror=alert(1)>', link='javascript:alert(1)')]
    escaped = render(script, unsafe)
    rows = []
    def check(name, condition):
        rows.append({'name': name, 'passed': bool(condition)})
    check('producer leaves input unmodified', incoming == untouched)
    check('producer retains all four credited items', len(ranked['items']) == 4)
    check('producer prioritises older official policy over newest publisher', ranked['items'][0]['link'] == incoming[0]['link'])
    check('raw ranking envelope rejected by existing consumer', first['accepted'] is False)
    check('existing schema forbids per-item editorial without explicit schema change',
          schema['properties']['items']['items']['additionalProperties'] is False and 'editorial' not in schema['properties']['items']['items']['properties'])
    check('wrapping alone loses official policy item', incoming[0]['title'] not in live['titles'])
    check('wrapping alone sorts an undated item first by collection time instead of rank', live['titles'][0] == incoming[3]['title'])
    check('unknown publisher date does not gain fresh publication status',
          undated['editorial']['freshness']['state'] == 'unknown' and undated['editorial']['freshness']['points'] == 0)
    check('saved snapshot remains labelled snapshot', saved['state'] == 'snapshot')
    check('failed collection remains labelled failed', failed['state'] == 'failed')
    check('unsafe link remains inactive and title remains text', escaped['links'] == [None] and escaped['titles'] == ['<img src=x onerror=alert(1)>'])
    check('machine ranks never grant verification', all(row['editorial']['verification_status'] == 'NOT_VERIFIED' for row in ranked['items']))
    return {'schema': 'testcode.news-ranking-observation.v1', 'fixture': 'synthetic_only',
            'producer_commit': pins['producer']['commit'], 'consumer_commit': pins['consumer']['commit'],
            'checks': rows, 'passed': sum(row['passed'] for row in rows), 'total': len(rows),
            'producer_order': [row['title'] for row in ranked['items']], 'existing_display_order': live['titles'],
            'release_compatible': False, 'network_requests': 0,
            'scope': 'Offline Node VM observation, not a browser, live source receipt or accepted product integration.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--producer-root', type=Path, required=True)
    parser.add_argument('--consumer-root', type=Path, required=True)
    args = parser.parse_args()
    try:
        report = observe(args.producer_root, args.consumer_root)
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        print(json.dumps({'status': 'FAIL', 'error_type': type(exc).__name__, 'checks_executed': 0}))
        return 1
    print(json.dumps(report, indent=2))
    return 0 if report['passed'] == report['total'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
