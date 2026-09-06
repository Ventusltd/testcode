"""Audit the campaign's final homepage links and served entrypoint bytes.

This consumes committed acceptance evidence; it does not infer application
correctness from HTTP200 or mark an unaccepted candidate complete.
"""
import argparse
import concurrent.futures
import datetime
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import urllib.parse
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--ledger-repo', required=True)
parser.add_argument('--publication-repo', required=True)
parser.add_argument('--expected', required=True, type=int)
parser.add_argument('--out', required=True)
args = parser.parse_args()


def git(repo, *arguments):
    return subprocess.check_output(['git', *arguments], cwd=repo)


ledger_sha = git(args.ledger_repo, 'rev-parse', 'HEAD').decode().strip()
publication_sha = git(args.publication_repo, 'rev-parse', 'HEAD').decode().strip()
ledger_path = 'codex/build-plan/campaigns/20260906-next30.md'
ledger = git(args.ledger_repo, 'show', ledger_sha + ':' + ledger_path).decode('utf-8')
homepage = git(args.publication_repo, 'show', publication_sha + ':index.html')
homepage_request = urllib.request.Request('https://globalgrid2050.com/',
                                         headers={'User-Agent': 'GlobalGrid-delivery-verification/1.0'})
with urllib.request.urlopen(homepage_request, timeout=45) as response:
    live_homepage, homepage_status = response.read(), response.status
homepage_check = {'url': 'https://globalgrid2050.com/', 'status': homepage_status,
                  'expectedSha256': hashlib.sha256(homepage).hexdigest(),
                  'servedSha256': hashlib.sha256(live_homepage).hexdigest(),
                  'pass': homepage_status == 200 and live_homepage == homepage}


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attributes):
        if tag == 'a':
            href = dict(attributes).get('href')
            if href:
                self.hrefs.append(urllib.parse.urljoin('https://globalgrid2050.com/', href))


links = Links()
links.feed(live_homepage.decode('utf-8'))
accepted, excluded = [], []
for line in ledger.splitlines():
    match = re.fullmatch(r'\| ([^|]+) \| (20260906\d{4}) \| (.*) \|', line)
    if not match:
        continue
    row = dict(zip(['name', 'generation', 'acceptanceEvidence'], match.groups()))
    if row['acceptanceEvidence'].startswith('ACCEPTANCE REVOKED'):
        excluded.append(row)
    else:
        accepted.append(row)
assert len(accepted) == args.expected, (len(accepted), args.expected)
assert len({row['generation'] for row in accepted}) == len(accepted), 'Duplicate generation'


def audit(row):
    row = dict(row)
    try:
        prefix = '/testcode/' + row['generation'] + '/'
        candidates = [url for url in links.hrefs
                      if urllib.parse.urlsplit(url).netloc == 'globalgrid2050.com'
                      and urllib.parse.urlsplit(url).path.startswith(prefix)]
        assert candidates, 'Accepted version missing from homepage'
        url = next((url for url in candidates
                    if urllib.parse.urlsplit(url).path in
                    [prefix + suffix for suffix in ['atlas/', 'pipeline/', 'cable/']]), candidates[0])
        parts = urllib.parse.urlsplit(url)
        assert not parts.query and not parts.fragment, 'Use the direct immutable entrypoint'
        relative = parts.path.lstrip('/') + ('index.html' if parts.path.endswith('/') else '')
        expected = git(args.publication_repo, 'show', publication_sha + ':' + relative)
        request = urllib.request.Request(url, headers={'User-Agent': 'GlobalGrid-delivery-verification/1.0'})
        with urllib.request.urlopen(request, timeout=45) as response:
            served, status, final_url = response.read(), response.status, response.url
        row.update(url=url, status=status, finalUrl=final_url, bytes=len(served),
                   expectedSha256=hashlib.sha256(expected).hexdigest(),
                   servedSha256=hashlib.sha256(served).hexdigest())
        row['pass'] = status == 200 and served == expected and final_url == url
    except Exception as error:
        row.update(error=str(error), **{'pass': False})
    return row


with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    rows = list(pool.map(audit, accepted))
result = {'checkedUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'scope': 'Accepted campaign entries, homepage links and exact served entrypoint bytes; not a replacement for recorded CI/live interaction acceptance.',
          'ledgerCommit': ledger_sha, 'ledgerPath': ledger_path,
          'publicationCommit': publication_sha, 'acceptedCount': len(rows),
          'homepage': homepage_check, 'entries': rows, 'excluded': excluded,
          'pass': homepage_check['pass'] and all(row['pass'] for row in rows)}
output = Path(args.out)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'pass': result['pass'], 'acceptedCount': len(rows),
                  'verified': sum(row['pass'] for row in rows), 'output': str(output)}))
raise SystemExit(0 if result['pass'] else 1)
