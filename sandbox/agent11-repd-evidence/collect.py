#!/usr/bin/env python3
"""Opt-in search discovery for Agent11. No scraping, publisher reuse or auto-verification.

Requires BRAVE_SEARCH_API_KEY in the caller's environment. Search outputs are
leads to investigate, NOT primary publisher receipts or accepted evidence.
Default dry-run never sends requests or charges money.
"""
import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

from engine import canonical, safe_url

ENDPOINT = "https://api.search.brave.com/res/v1/web/search"
PROVIDER = "Brave Search"
DEFAULT_MAX = 25

def query_for(item):
    plans = item.get("research_queries") or item.get("queries") or []
    if not plans:
        return None
    raw = plans[0].get("query", "")
    return " ".join(str(raw).split())[:550] if raw else None

def api_search(query, token, timeout=12, transport=None):
    """Search only. No publisher-page fetch, no claim of source independence."""
    params = urllib.parse.urlencode({"q": query, "country": "GB",
                                      "search_lang": "en", "count": 5})
    url = ENDPOINT + "?" + params
    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "X-Subscription-Token": token,
        "User-Agent": "GlobalGrid2050-Agent11-Research/0.1"
    })
    transport = transport or urllib.request.urlopen
    with transport(req, timeout=timeout) as reply:
        raw = reply.read(300_000 + 1)
    if len(raw) > 300_000:
        raise ValueError("oversized_api_response")
    doc = json.loads(raw)
    out = []
    for h in (doc.get("web") or {}).get("results", [])[:5]:
        uri = h.get("url")
        try:
            safe_url(uri)
        except (ValueError, TypeError):
            continue
        out.append({
            "url": uri, "title": str(h.get("title", ""))[:180],
            "search_description": str(h.get("description", ""))[:280],
            "source_role": "SEARCH_INDEX_CANDIDATE_NOT_ORIGINAL_PUBLISHER",
            "publisher_verified": False, "project_verified": False,
            "event_verified": False, "rights_verified": False,
        })
    return out

def read_queue(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("queue_not_list")
    return data

def read_cache(path):
    if not path.exists():
        return {}
    result = {}
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            item = json.loads(line)
            ref = str(item["repd_ref"])
            if ref in result:
                raise ValueError(f"duplicate_cache_record_{n}")
            result[ref] = item
    return result

def run(items, cache, max_requests=DEFAULT_MAX, live=False, api_key=None,
        as_of="2026-11-16", delay=1.2, sleeper=time.sleep, searcher=api_search):
    date.fromisoformat(as_of)
    if live and not api_key:
        raise ValueError("API key missing; network NOT attempted")
    if max_requests < 0 or max_requests > 100:
        raise ValueError("per_run_budget_limit_0_to_100")
    changed, calls = dict(cache), 0
    for item in items:
        ref = str(item["ref"])
        if ref in changed:
            continue  # idempotent: never re-bill or re-label an already attempted ref
        if not live:
            continue  # A dry-run NEVER records research or changes the cache.
        q = query_for(item)
        if not q:
            changed[ref] = {"repd_ref": ref, "state": "blocked",
                            "attempted_at": as_of, "reason": "missing_search_query",
                            "source_candidates": []}
            continue
        if calls >= max_requests:
            break
        calls += 1
        try:
            found = searcher(q, api_key)
            state = "candidate_review" if found else "attempted_no_source"
            reason = "search_candidates_not_verified" if found else "zero_index_hits"
            changed[ref] = {
                "repd_ref": ref, "state": state, "attempted_at": as_of,
                "provider": PROVIDER, "query": q,
                "query_sha256": hashlib.sha256(q.encode("utf-8")).hexdigest(),
                "reason": reason, "source_candidates": found,
                "publisher_receipts_verified": 0,
                "independently_evidenced_remarks": 0
            }
        except (urllib.error.URLError, ValueError, KeyError, TimeoutError, OSError,
                json.JSONDecodeError) as exc:
            changed[ref] = {
                "repd_ref": ref, "state": "blocked", "attempted_at": as_of,
                "provider": PROVIDER, "query": q,
                "reason": "network_or_provider_failure",
                "error_type": type(exc).__name__,
                "source_candidates": []
            }
        if calls < max_requests:
            sleeper(delay)
    return changed, calls

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--queue", required=True)
    p.add_argument("--cache", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--as-of", default="2026-11-16")
    p.add_argument("--max-requests", type=int, default=25)
    p.add_argument("--live", action="store_true",
                   help="Paying search provider, explicit opt-in only")
    args = p.parse_args()
    items = read_queue(args.queue)
    cache = read_cache(Path(args.cache))
    if args.live:
        token = os.getenv("BRAVE_SEARCH_API_KEY", "")
        if not token:
            raise SystemExit("NO NETWORK: BRAVE_SEARCH_API_KEY not configured")
    else:
        token = None
    data, calls = run(items, cache, args.max_requests, args.live, token,
                      args.as_of)
    target = Path(args.out)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(b"".join(canonical(data[ref]) for ref in sorted(data, key=int)))
    print(json.dumps({"live": args.live, "search_requests": calls,
                      "cached_attempts": len(data),
                      "verified_source_remarks": 0, "provider": PROVIDER},
                      sort_keys=True))

if __name__ == "__main__":
    main()
