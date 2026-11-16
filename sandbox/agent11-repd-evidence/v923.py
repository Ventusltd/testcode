#!/usr/bin/env python3
"""Agent 11 V9.24: deterministic V9.23 Solar-1000 identity spine and pilot ledger.

Offline only. Authoritative source: 16 immutable V9.23 JSON partition files.
Do not mutate any release, claim independent evidence or dispatch outreach.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from engine import canonical, evidence_note, source_queries, research_priority, EvidenceError

RELEASE = "202611160020"
RELEASE_COMMIT = "1559f40e73a4e454c39b23d5172cf4c5e96ef3ea"
ASSET_SOURCE = "DESNZ-REPD"
SNAPSHOT = "2026q3"
COUNTS = (7775, 3604, 1000)
PLANNING = ("Planning Permission", "Application Refused", "Appeal", "Awaiting Construction",
            "Under Construction", "Application Withdrawn")

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def load_pinned(parts: Path):
    """Keep exact source dicts and per-record hash; numeric order after filtering."""
    rows, hashes, fingerprints = [], {}, []
    for n in range(1, 17):
        path = parts / f"part-{n:03d}.json"
        if not path.is_file():
            raise EvidenceError(f"missing partition {n}")
        raw = path.read_bytes()
        doc = json.loads(raw)
        if doc.get("partition") != n or doc.get("record_count") != len(doc.get("projects", [])):
            raise EvidenceError(f"part {n} index/count mismatch")
        expected = 500 if n < 16 else 275
        if len(doc["projects"]) != expected:
            raise EvidenceError(f"part {n} unexpected size")
        fingerprints.append({"name": path.name, "sha256": digest(raw), "rows": expected})
        for row in doc["projects"]:
            ref = str(row.get("repd_ref", "")).strip()
            if not ref.isascii() or not ref.isdecimal() or ref in hashes:
                raise EvidenceError("invalid or duplicate REPD project identity")
            hashes[ref] = digest(canonical(row))
            rows.append(row)
    if len(rows) != COUNTS[0]:
        raise EvidenceError("7775 identity count contract failed")
    solar = [r for r in rows if r.get("repd_technology") == "Solar Photovoltaics"]
    if len(solar) != COUNTS[1]:
        raise EvidenceError("3604 solar count contract failed")
    solar.sort(key=lambda r: int(r["repd_ref"]))
    selected = solar[:1000]
    ids = [int(r["repd_ref"]) for r in selected]
    if len(ids) != COUNTS[2] or len(ids) != len(set(ids)) or ids != sorted(ids):
        raise EvidenceError("selection ordering/uniqueness failed")
    if ids[0] != 1018 or ids[-1] != 2325:
        raise EvidenceError("pinned V9.23 sample membership changed")
    fingerprint = digest(canonical(fingerprints))
    return selected, hashes, fingerprints, fingerprint

def adapt(row):
    return {
        "Ref ID": str(row["repd_ref"]), "Site Name": row["name"],
        "Planning Application Reference": row.get("planning_application_reference") or "",
        "Planning Authority": row.get("planning_authority") or "",
        "County": row.get("county") or "",
        "Operator (or Applicant)": row.get("operator") or "",
        "Development Status": row.get("status") or "",
        "Development Status (short)": row.get("status") or "",
        "Record Last Updated (dd/mm/yyyy)": (
            date.fromisoformat(row["repd_record_updated"]).strftime("%d/%m/%Y")
            if row.get("repd_record_updated") else ""),
        "Installed Capacity (MWelec)": str(row.get("capacity_mw") or ""),
        "Technology Type": "Solar Photovoltaics",
    }

def key(row):
    return f"repd|{ASSET_SOURCE}|{SNAPSHOT}|{row['repd_ref']}"

def score(row):
    """Explainable sorting hint only, not a substantiated live procurement lead."""
    stage, neg_mw = research_priority(adapt(row))
    capacity = float(row.get("capacity_mw") or 0)
    mw_score = min(30, round(capacity / 5))
    stage_score = max(0, 40 - stage * 4)
    grid_work = 10 if capacity >= 20 and row["status"] in (
        "Under Construction", "Awaiting Construction") else 0
    return {"score": mw_score + stage_score + grid_work,
            "stage_points": stage_score, "capacity_points": mw_score,
            "possible_electrical_work_points": grid_work,
            "recency_points": 0,
            "method": "heuristic_v1_unverified_not_an_event",
            "method_note": "No evidence of a tender, EPC appointment or visit opportunity implied."}

def select_pilot(rows, n=25):
    """Deterministic stratification, one row each from rare states then broad sample."""
    rare = ("Under Construction", "Awaiting Construction", "Application Refused",
            "Appeal Refused", "Application Withdrawn", "Planning Permission Expired",
            "Abandoned", "Revised", "Operational")
    picks, taken = [], set()
    # Include the first three numeric source records as fixed historical
    # identity controls; source selection and the complete 1,000 remain unchanged.
    for r in rows:
        if r["repd_ref"] in ("1018", "1019", "1020"):
            picks.append(r)
            taken.add(r["repd_ref"])
    by_status = {k: sorted([r for r in rows if r["status"] == k],
                            key=lambda r: (-float(r.get("capacity_mw") or 0), int(r["repd_ref"])))
                 for k in rare}
    for status in rare:
        for r in by_status[status][:2]:
            if r["repd_ref"] not in taken:
                picks.append(r); taken.add(r["repd_ref"])
    # Prefer planning-authority diversity, mixed stages and capacity; no invented sites.
    used_authorities = {r.get("planning_authority") for r in picks}
    others = sorted((r for r in rows if r["repd_ref"] not in taken),
                    key=lambda r: (r.get("planning_authority") in used_authorities,
                                   -float(r.get("capacity_mw") or 0), int(r["repd_ref"])))
    for r in others:
        if len(picks) >= n:
            break
        picks.append(r)
        used_authorities.add(r.get("planning_authority"))
    if len(picks) != n:
        raise EvidenceError("pilot size mismatch")
    return sorted(picks, key=lambda r: int(r["repd_ref"]))

def load_feed(path):
    if not path:
        return {"status": "unavailable", "native_possible_matches": []}
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    if doc.get("schema") != "globalgrid2050.news.pipeline-headlines.v1":
        raise EvidenceError("unknown V9.23 feed contract")
    return {"status": doc.get("status"),
            "generated_at": doc.get("generated_at"),
            "total_headlines": len(doc.get("items", [])),
            "native_possible_matches": [
                str(it["possible_match"]["repd_ref"])
                for it in doc.get("items", [])
                if isinstance(it.get("possible_match"), dict)
                and str(it["possible_match"].get("repd_ref", "")).isdecimal()
            ]}

def load_attempts(path, known):
    if not path:
        return {}
    ret = {}
    for i, s in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        if not s.strip():
            continue
        rec = json.loads(s)
        ref = str(rec.get("repd_ref", ""))
        state = rec.get("state")
        if ref not in known or state not in ("attempted_no_source", "blocked", "candidate_review"):
            raise EvidenceError(f"invalid attempt ledger line {i}")
        if ref in ret or not isinstance(rec.get("attempted_at"), str):
            raise EvidenceError(f"duplicate or undated attempt at line {i}")
        ret[ref] = rec
    return ret

def make_ledger(rows, hashes, evidence=None, attempts=None, as_of=None):
    evidence = evidence or []
    attempts = attempts or {}
    as_of = as_of or date(2026, 11, 16)
    indexed = defaultdict(list)
    for e in evidence:
        indexed[str(e.get("repd_ref", ""))].append(e)
    result, queue, reject = [], [], Counter()
    for r in rows:
        adapted = adapt(r)
        ref = r["repd_ref"]
        candidates = []
        for e in indexed.get(ref, []):
            note, why = evidence_note(adapted, e, as_of)
            if note:
                note["asset_key"] = key(r)  # Agent10 v1 registry casing
                candidates.append(note)
            else:
                reject[why] += 1
        if candidates:
            state = "candidate"
            headline = candidates[0]["brief"]
        elif ref in attempts and attempts[ref]["state"] == "blocked":
            state = "blocked"
            headline = "Source research blocked; independent evidence not established."
        elif ref in attempts and attempts[ref]["state"] == "attempted_no_source":
            state = "researched_no_source"
            headline = "No independent evidence found; research attempted."
        elif ref in attempts and attempts[ref]["state"] == "candidate_review":
            state = "search_candidate"
            headline = "Potential external sources located; project identity and event are not verified."
        else:
            state = "not_researched"
            headline = "Independent research not yet attempted."
        result.append({
            "asset_key": key(r),
            "repd_ref": ref,
            "official_row_sha256": hashes[ref],
            "official_project_name": r["name"],
            "official_status": r.get("status"),
            "official_capacity_mw": r.get("capacity_mw"),
            "official_planning_reference": r.get("planning_application_reference"),
            "official_record_unchanged": True,
            "research_state": state,
            "headline": headline,
            "remarks": sorted(candidates, key=lambda x: (x["event_date"], x["source_url"]),
                              reverse=True),
            "independent_sources": 0,
            "independently_verified": False,
            "editorially_accepted": False,
            "actionable": False,
            "rank": score(r),
            "research_queries": source_queries(adapted) if state in ("not_researched", "researched_no_source", "blocked") else [],
        })
        if state in ("not_researched", "researched_no_source", "blocked", "search_candidate"):
            queue.append({"asset_key": key(r), "ref": ref, "name": r["name"],
                          "status": r["status"], "rank": score(r),
                          "queries": source_queries(adapted)})
    queue.sort(key=lambda z: (-z["rank"]["score"], int(z["ref"])))
    return result, queue, dict(sorted(reject.items()))

def build_output(selected, hashes, fingerprints, source_hash, feed, attempts=None, evidence=None, as_of=None):
    as_of = as_of or date(2026, 11, 16)
    ledger, queue, rejected = make_ledger(selected, hashes, evidence, attempts, as_of)
    ids = [r["repd_ref"] for r in selected]
    selected_set = set(ids)
    matched = [x for x in feed.get("native_possible_matches", []) if x in selected_set]
    metrics = Counter(x["research_state"] for x in ledger)
    manifest = {
        "schema": "globalgrid2050.agent11.solar1000.manifest.v2",
        "source": "V9.23/202611160020/data/v9.1/projects/part-001..016.json",
        "source_commit": RELEASE_COMMIT,
        "source_combined_digest": source_hash,
        "partitions": fingerprints,
        "full_release_rows": 7775, "solar_rows": 3604,
        "selection_order": "numeric_repd_ref_ascending",
        "selection_size": len(ids), "snapshot": SNAPSHOT,
        "asset_ref_ids": ids,
        "row_sha256": {str(r["repd_ref"]): hashes[r["repd_ref"]] for r in selected}
    }
    audit = {
        "schema": "globalgrid2050.agent11.solar1000.audit.v2",
        "as_of": as_of.isoformat(), "total": len(ledger),
        "native_v923_headline_feed_status": feed.get("status"),
        "native_v923_possible_matches_total": len(feed.get("native_possible_matches", [])),
        "native_v923_possible_matches_in_sample": len(matched),
        "native_v923_independent_matches_in_sample": 0,
        "evidence_claimed_independent": 0, "independently_sourced": 0,
        "verified": 0, "accepted": 0, "actionable": 0,
        "researched": sum(metrics[x] for x in ("candidate", "blocked", "researched_no_source", "search_candidate")),
        "candidate": metrics["candidate"], "search_candidate": metrics["search_candidate"],
        "no_source": metrics["researched_no_source"],
        "blocked": metrics["blocked"], "not_researched": metrics["not_researched"],
        "attribution_precision": None, "cost": None,
        "manual_research_minutes": None,
        "denominator": len(ledger),
        "independent_coverage_pct": 0.0,
        "decision_ready_coverage_pct": 0.0,
        "display_rows_with_honest_state_pct": 100.0,
        "rejections": rejected,
        "publication_authorised": False
    }
    if audit["total"] != 1000 or len(set(ids)) != 1000:
        raise EvidenceError("complete and unique ledger required")
    return manifest, ledger, queue, audit

def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--parts-dir", required=True)
    p.add_argument("--headlines")
    p.add_argument("--attempts", help="Externally verified audit log of actual attempted research, JSONL")
    p.add_argument("--evidence", help="Externally sourced candidate JSONL, never auto-accepted")
    p.add_argument("--out-dir", required=True)
    p.add_argument("--as-of", default="2026-11-16")
    a = p.parse_args(argv)
    rows, hashes, fingerprints, source_hash = load_pinned(Path(a.parts_dir))
    feed = load_feed(a.headlines)
    attempts = load_attempts(a.attempts, {r["repd_ref"] for r in rows})
    evidence = []
    if a.evidence:
        for line in Path(a.evidence).read_text(encoding="utf-8").splitlines():
            if line.strip():
                evidence.append(json.loads(line))
    manifest, ledger, queue, audit = build_output(rows, hashes, fingerprints,
                                                  source_hash, feed, attempts, evidence,
                                                  date.fromisoformat(a.as_of))
    out = Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    pilots = select_pilot(rows, 25)
    named = {r["repd_ref"]: r for r in ledger}
    for file, value in {
        "manifest.v2.json": manifest,
        "notes-sidecar.v2.json": {"schema": "globalgrid2050.agent11.solar1000.sidecar.v2",
                                  "release": "V9.24 NON-LIVE", "notes": ledger},
        "research-queue.json": queue,
        "pilot-25.json": {"schema": "agent11.pilot.v1",
                          "selection": "stratified_source_records",
                          "records": [named[r["repd_ref"]] for r in pilots]},
        "audit.v2.json": audit
    }.items():
        (out / file).write_bytes(canonical(value))
    print(json.dumps(audit, sort_keys=True))

if __name__ == "__main__":
    main()
