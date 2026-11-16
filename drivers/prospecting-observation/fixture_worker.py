"""Compose synthetic observations through the actual archived product modules."""
from pathlib import Path
import hashlib
import json
import socket
import sys


def blocked(*args, **kwargs):
    raise RuntimeError("Network is forbidden in this offline proof")


socket.socket = blocked
socket.getaddrinfo = blocked
ROOT = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2]).resolve()
sys.path.insert(0, str(ROOT))
from automation.news import prospecting as producer
from automation.news.acquisition.evidence_store import EvidenceStore

AS_OF = "2026-11-16T12:00:00Z"
PUBLISHED = "2026-10-26T12:00:00Z"
FIRST = "2026-10-27T12:00:00Z"
LATEST = "2026-11-16T11:00:00Z"


def write(name, value):
    data = (json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8")
    (OUT / name).write_bytes(data)
    return hashlib.sha256(data).hexdigest()


def main():
    rows, ids, receipt = producer.official(ROOT)
    projects = [dict(row, id=row["repd_ref"]) for row, _ in rows if row["repd_ref"] in ids]
    # The highest static-priority seed lies just below this profile's genuine
    # top-1000 cutoff. A recent observation promotes it; an empty scan must not.
    candidates = [producer.official_candidate(row, source, {}, producer._moment(AS_OF))
                  for row, source in rows if row["repd_ref"] in ids]
    selected = sorted(candidates, key=lambda row: (-row["score"], row["id"]))[0]["id"]
    ref = selected.removeprefix("REPD-")
    url = "https://publisher.example/synthetic-observation"
    article = {"id": "synthetic-observation", "url": url, "title": "Synthetic observation fixture",
               "pub_date": PUBLISHED, "source_id": "synthetic", "publisher": "Synthetic fixture publisher"}
    match = {"project_id": ref, "article_url": url, "status": "PROVISIONAL", "match_method": "repd_id"}
    # These assertions are test-only receipts; they grant no publisher rights.
    source = {"id": "synthetic", "status": "ok", "url": "https://publisher.example/feed",
              "fetched_at": FIRST, "response_sha256": "a" * 64, "http_status": 200,
              "eligible_for_publication": True, "probe_only": False, "rights_status": "accepted",
              "rights_review_url": "https://publisher.example/synthetic-rights",
              "channel_access": {"state": "OPEN", "checked_at": FIRST,
                                 "review_url": "https://publisher.example/synthetic-access"},
              "article_access": {url: {"state": "OPEN", "checked_at": FIRST,
                                       "review_url": "https://publisher.example/synthetic-story-access"}}}
    later = json.loads(json.dumps(source))
    later["fetched_at"] = LATEST
    later["channel_access"]["checked_at"] = LATEST
    cases = []
    for observed_again in (False, True):
        name = "observed_again" if observed_again else "empty_later_scan"
        with EvidenceStore() as store:
            store.record_run(projects, [article], [match], FIRST, [source])
            store.record_run(projects, [article] if observed_again else [],
                             [match] if observed_again else [], LATEST, [later])
            snapshot = store.snapshot(timestamp=LATEST)
        snapshot_name = name + ".snapshot.json"
        snapshot_sha = write(snapshot_name, snapshot)
        artifact = producer.build(as_of=AS_OF, limit=1000, repo_root=ROOT,
                                  evidence=(OUT / snapshot_name, snapshot_sha))
        research, news_receipt = producer.evidence_input((OUT / snapshot_name, snapshot_sha),
                                                       ids, producer._moment(AS_OF))
        official, provenance = next(pair for pair in rows if pair[0]["repd_ref"] == ref)
        projected = producer.official_candidate(official, provenance, research[ref], producer._moment(AS_OF))
        projected_article = projected["evidence"][0]
        points = next(reason["points"] for reason in projected["reasons"] if reason["name"] == "research_follow_up")
        expected_observation = LATEST if observed_again else FIRST
        checks = {
            "backend_follow_up_points": points == (5 if observed_again else 0),
            "backend_observation_state": projected_article["retrieval_freshness"]["state"] == ("WITHIN_WINDOW" if observed_again else "STALE"),
            "backend_observed_at": projected_article["retrieval_freshness"]["timestamp"] == expected_observation,
            "backend_publication_preserved": projected_article["pub_date"] == PUBLISHED,
            "backend_first_seen_preserved": projected_article["first_seen"] == FIRST,
            "backend_last_seen_preserved": projected_article["last_seen"] == expected_observation,
            "source_health_separate": news_receipt["freshness"]["state"] == "WITHIN_WINDOW" and news_receipt["source_run_at"] == LATEST,
        }
        artifact_name, expected_name = name + ".json", name + ".expected.json"
        artifact_sha = write(artifact_name, artifact)
        expected = {"project_id": selected, "project_present": observed_again,
                    "follow_up_points": 5 if observed_again else 0,
                    "observation_state": "WITHIN_WINDOW" if observed_again else "STALE",
                    "observed_at": LATEST if observed_again else FIRST,
                    "published_at": PUBLISHED, "first_seen": FIRST, "source_fetched_at": LATEST}
        write(expected_name, expected)
        cases.append({"name": name, "artifact": artifact_name, "expected": expected_name,
                      "artifact_sha256": artifact_sha, "snapshot_sha256": snapshot_sha,
                      "backend_checks": [{"name": name, "pass": passed} for name, passed in checks.items()],
                      "project_score": projected["score"], "returned_cutoff_score": artifact["records"][-1]["score"]})
    print(json.dumps({"schema": "testcode.prospecting-fixture.v1", "synthetic_evidence": True,
                      "as_of": AS_OF, "selected_project": selected, "official_population": len(rows),
                      "solar1000_count": len(ids), "baseline_receipt": receipt, "cases": cases}))


if __name__ == "__main__":
    try:
        OUT.mkdir(parents=True, exist_ok=True)
        main()
    except Exception as exc:
        # Product exceptions can contain local paths: keep public proof output bounded.
        print(json.dumps({"pass": False, "error_kind": type(exc).__name__}), file=sys.stderr)
        raise SystemExit(2)
