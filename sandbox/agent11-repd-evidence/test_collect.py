"""Search collector mock tests — NO network, no charge, no publisher claims."""
import io
import json
import tempfile
import unittest
from pathlib import Path
from urllib.error import URLError

from collect import api_search, read_cache, run, query_for, read_queue

ITEMS=[{"ref":"1018","research_queries":[{"query":"Fen Farm solar N/036/01536/10"}]},
       {"ref":"1019","research_queries":[{"query":"Manor Farm PA11/00670"}]}]

class Reply:
    def __init__(self, o): self.raw=json.dumps(o).encode("utf8")
    def __enter__(self): return self
    def __exit__(self, *_): return False
    def read(self, size): return self.raw[:size]

class SearchTests(unittest.TestCase):
    def test_dry_run_has_no_network_and_no_fake_attempt(self):
        def panic(*a,**k): raise AssertionError("network should not start")
        cache,calls=run(ITEMS, {}, live=False, searcher=panic)
        self.assertEqual(cache,{})
        self.assertEqual(calls,0)

    def test_dry_run_malformed_queue_must_not_create_1000_fake_attempts(self):
        malformed=[{"ref":str(x),"queries":[]} for x in range(1000,2000)]
        cache,calls=run(malformed,{},live=False)
        self.assertEqual((cache,calls),({},0))

    def test_requires_explicit_api_key(self):
        with self.assertRaises(ValueError):
            run(ITEMS,{},live=True,api_key=None,searcher=lambda *_:[])

    def test_bounded_request_budget(self):
        seen=[]
        def fake(q,token):
            seen.append(q)
            return []
        c,n=run(ITEMS,{},live=True,api_key="TEST_ONLY",max_requests=1,sleeper=lambda _:None,searcher=fake)
        self.assertEqual(n,1)
        self.assertEqual(len(c),1)
        self.assertEqual(list(c.values())[0]["state"],"attempted_no_source")
        self.assertEqual(len(seen),1)

    def test_idempotent_cache_skips_rebilling(self):
        def fake(*a):
            return [{"url":"https://example.org/x"}]
        a,n=run(ITEMS,{},live=True,api_key="TEST_ONLY",sleeper=lambda _:None,searcher=fake)
        b,m=run(ITEMS,a,live=True,api_key="TEST_ONLY",sleeper=lambda _:None,searcher=fake)
        self.assertEqual(n,2)
        self.assertEqual(m,0)
        self.assertEqual(a,b)
        self.assertTrue(all(x["state"]=="candidate_review" for x in b.values()))
        self.assertEqual(sum(x["independently_evidenced_remarks"] for x in b.values()),0)

    def test_network_error_affects_only_own_record(self):
        def fake(q,token):
            if "Fen Farm" in q: raise URLError("blocked")
            return []
        a,n=run(ITEMS,{},live=True,api_key="TEST_ONLY",sleeper=lambda _:None,searcher=fake)
        self.assertEqual(a["1018"]["state"],"blocked")
        self.assertEqual(a["1019"]["state"],"attempted_no_source")
        self.assertEqual(n,2)

    def test_malicious_result_urls_discarded(self):
        def mock(req,timeout):
            return Reply({"web":{"results":[
                {"url":"javascript:alert(1)","title":"bad"},
                {"url":"https://localhost/private","title":"bad"},
                {"url":"https://example.org/site","title":"Safe title","description":"Snippet"}
            ]}})
        out=api_search("safe term","TEST_ONLY",transport=mock)
        self.assertEqual(len(out),1)
        self.assertFalse(out[0]["event_verified"])
        self.assertFalse(out[0]["publisher_verified"])
        self.assertEqual(out[0]["url"],"https://example.org/site")

    def test_query_required_and_request_limit(self):
        with self.assertRaises(ValueError):
            run(ITEMS,{},live=True,api_key="TEST_ONLY",max_requests=101)
        self.assertIsNone(query_for({"research_queries":[]}))

    def test_duplicate_cache_fails(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"bad.jsonl"
            rec={"repd_ref":"1018","state":"candidate_review","attempted_at":"2026-11-16"}
            p.write_text(json.dumps(rec)+"\n"+json.dumps(rec)+"\n")
            with self.assertRaises(ValueError):
                read_cache(p)

if __name__ == "__main__":
    unittest.main()
