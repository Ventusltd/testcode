#!/usr/bin/env python3
"""Agent 11: fail-closed REPD solar selection and candidate evidence sidecar.

No network, AI, article scraping or product publication. Python 3.11+ stdlib.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit, quote_plus

SCHEMA = "globalgrid2050.repd-solar-evidence.v1"
SNAPSHOT = "2026q3"
SOURCE = "desnz-repd"
REQUIRED = ("Ref ID", "Technology Type", "Site Name", "Planning Authority",
            "Planning Application Reference", "Development Status",
            "Development Status (short)")
CATEGORIES = {
    "planning_submitted": ("Planning application submitted", "planning"),
    "planning_committee_recommendation": ("Planning committee report recommended approval", "planning"),
    "consent_granted": ("Consent granted", "planning"),
    "consent_refused": ("Consent refused", "planning"),
    "construction_started": ("Construction started", "construction"),
    "operational": ("Reported operational", "construction"),
    "finance_secured": ("Finance announced", "finance"),
    "epc_awarded": ("EPC appointment announced", "procurement"),
    "grid_connection": ("Grid connection milestone reported", "grid"),
    "ownership_change": ("Ownership change reported", "developer"),
    "community_consultation": ("Community consultation announced", "stakeholder"),
}
STOP = {"solar", "farm", "site", "solar", "photovoltaics", "panels", "pv",
        "project", "array", "new", "land", "at", "the", "and", "of", "energy",
        "battery", "storage", "installation", "ground", "near", "park"}
URL_DENY = {"localhost", "127.0.0.1", "::1"}
REPD_NAME = "Solar Photovoltaics"

class EvidenceError(ValueError):
    pass

def canonical(obj):
    return (json.dumps(obj, ensure_ascii=False, sort_keys=True,
                       separators=(",", ":")) + "\n").encode("utf-8")

def tokens(text):
    return {t for t in re.findall(r"[a-z0-9]+", (text or "").casefold())
            if len(t) >= 3 and t not in STOP}

def valid_day(s, as_of, required=True):
    if s in (None, "") and not required:
        return None
    if not isinstance(s, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        raise EvidenceError("ambiguous_or_missing_date")
    try:
        d = date.fromisoformat(s)
    except ValueError as ex:
        raise EvidenceError("invalid_date") from ex
    if d > as_of:
        raise EvidenceError("future_dated_claim")
    return d

def safe_url(url):
    if not isinstance(url, str) or len(url) > 2048:
        raise EvidenceError("unsafe_url")
    p = urlsplit(url)
    host = (p.hostname or "").lower()
    if (p.scheme != "https" or not host or p.username or p.password
            or host in URL_DENY or host.endswith(".invalid")
            or host.endswith(".local") or "\\" in url
            or any(ord(x) < 32 for x in url)):
        raise EvidenceError("unsafe_url")
    return url

def select_solar(csv_path, limit=1000):
    """First N solar rows in official *file order*, NOT numerically sorted."""
    path = Path(csv_path)
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as ex:
        raise EvidenceError("invalid_csv_encoding") from ex
    reader = csv.DictReader(text.splitlines())
    if not reader.fieldnames or not set(REQUIRED) <= set(reader.fieldnames):
        raise EvidenceError("required_columns_missing")
    full = list(reader)
    if any(None in r for r in full):
        raise EvidenceError("malformed_csv_columns")
    rows = [r for r in full if r["Technology Type"].strip() == REPD_NAME]
    refs = [r["Ref ID"].strip() for r in rows]
    if any(not re.fullmatch(r"\d+", rid) for rid in refs):
        raise EvidenceError("invalid_repd_ref")
    if len(set(refs)) != len(refs):
        raise EvidenceError("duplicate_repd_ref")
    if len(rows) < limit:
        raise EvidenceError("insufficient_solar_rows")
    selected = rows[:limit]
    inversions = sum(int(rows[i]["Ref ID"]) < int(rows[i-1]["Ref ID"])
                     for i in range(1, len(rows)))
    status_counts = dict(sorted(Counter(x["Development Status"] for x in selected).items()))
    authority_counts = Counter(x["Planning Authority"] for x in selected)
    if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        raise EvidenceError("source_changed_during_run")
    return selected, {
        "sha256": digest, "all_csv_rows": len(full),
        "solar_rows": len(rows), "selected_rows": len(selected),
        "ordering": "official_csv_file_order", "source": str(path),
        "first_ref": refs[0], "last_selected_ref": selected[-1]["Ref ID"],
        "solar_ref_inversions": inversions,
        "selection_status_counts": status_counts,
        "selection_top_authorities": authority_counts.most_common(15),
        "selection_planning_refs_present": sum(
            bool(x["Planning Application Reference"].strip()) for x in selected)
    }

def asset_key(row):
    return f"repd|{SOURCE}|{SNAPSHOT}|{row['Ref ID'].strip()}"

def source_queries(row):
    name = row["Site Name"].strip()
    ref = row["Planning Application Reference"].strip()
    authority = row["Planning Authority"].strip()
    county = (row.get("County") or "").strip()
    applicant = (row.get("Operator (or Applicant)") or "").strip()
    strings = [
        f'"{ref}" "{authority}" solar' if ref else f'"{name}" "{authority}" planning',
        f'"{name}" "{county}" solar project',
        f'"{name}" "{applicant}" renewable' if applicant else f'"{name}" solar news'
    ]
    return [{"query": s, "search_url": "https://www.google.com/search?q=" + quote_plus(s)}
            for s in strings]

def match(row, evidence):
    """A supplied REPD ID is NOT a sufficient independent identity proof.

    A local-authority planning reference must include the authority and a
    distinctive project-name token. We do not assume planning refs are
    nationally unique; eg 23/02112/FUL occurs at unrelated authorities.
    """
    rid = str(row["Ref ID"]).strip()
    if str(evidence.get("repd_ref", "")).strip() != rid:
        return None, "wrong_repd_id"
    name = tokens(row["Site Name"])
    if not name:
        return None, "non_distinctive_project_name"
    source_name = tokens(str(evidence.get("site_name", "")))
    overlap = name & source_name
    if not overlap:
        return None, "project_name_conflict"
    authority = (row["Planning Authority"] or "").strip().casefold()
    ev_authority = str(evidence.get("planning_authority", "")).strip().casefold()
    ref = (row.get("Planning Application Reference") or "").strip().casefold()
    ev_ref = str(evidence.get("planning_reference", "")).strip().casefold()
    county = (row.get("County") or "").strip().casefold()
    ev_county = str(evidence.get("county", "")).strip().casefold()
    if ref and ev_ref and ref != ev_ref:
        return None, "planning_reference_conflict"
    if ev_authority and authority and ev_authority != authority:
        return None, "authority_conflict"
    if ev_county and county and ev_county != county:
        return None, "county_conflict"
    if ref and ev_ref == ref and ev_authority == authority and ev_authority:
        return "strong_identity_candidate", "planning_reference_authority_name"
    if ev_county == county and ev_county and len(overlap) >= 2:
        return "possible_identity_candidate", "name_county"
    return None, "insufficient_identity"

def relation_to_official(row, event_type, event_date):
    """Never promote derived events to the source-of-truth status field."""
    status = row["Development Status"].strip().casefold()
    equivalent = {
        "consent_granted": "planning permission granted",
        "consent_refused": "planning permission refused",
        "planning_submitted": "planning application submitted",
        "construction_started": "under construction",
        "operational": "operational",
    }
    if equivalent.get(event_type) == status:
        return "corroborates_existing_official_status"
    if event_type == "planning_committee_recommendation":
        return "historical_planning_context_not_decision"
    raw_update = (row.get("Record Last Updated (dd/mm/yyyy)") or "").strip()
    try:
        official_update = date(int(raw_update[6:10]), int(raw_update[3:5]),
                               int(raw_update[0:2])) if re.fullmatch(
                                   r"\d{2}/\d{2}/\d{4}", raw_update) else None
    except ValueError:
        official_update = None
    if official_update and event_date <= official_update:
        return "historical_or_conflicting_requires_review"
    if event_type in ("consent_granted", "consent_refused", "construction_started",
                      "operational", "finance_secured", "epc_awarded", "grid_connection"):
        return "possible_newer_milestone_unverified"
    return "supplementary_context_unverified"


def evidence_note(row, e, as_of):
    basis, reason = match(row, e)
    if not basis:
        return None, reason
    try:
        url = safe_url(e.get("source_url"))
        publisher = str(e.get("publisher", "")).strip()
        owner = str(e.get("publisher_owner", "")).strip()
        if not publisher or len(publisher) > 160:
            raise EvidenceError("missing_publisher")
        event_type = str(e.get("event_type", ""))
        if event_type not in CATEGORIES:
            raise EvidenceError("unapproved_event_type")
        event = valid_day(e.get("event_date"), as_of)
        published = valid_day(e.get("published_date"), as_of, required=False)
        fetched = valid_day(e.get("fetched_date"), as_of, required=False)
        first_seen = valid_day(e.get("first_seen_date"), as_of, required=False)
        if first_seen and fetched and first_seen > fetched:
            raise EvidenceError("first_seen_after_fetched")
        if published and fetched and published > fetched:
            raise EvidenceError("publication_after_fetch")
        if e.get("review_state") in ("verified", "approved", "independent"):
            raise EvidenceError("self_declared_verification")
        if e.get("rights_basis") not in (None, "", "unknown"):
            raise EvidenceError("self_declared_rights")
        if e.get("original_receipt_sha256"):
            raise EvidenceError("unverified_receipt_hash")
    except (EvidenceError, ValueError) as ex:
        return None, str(ex)
    label, category = CATEGORIES[event_type]
    # Closed vocabulary only. Never reproduce publisher summaries as articles.
    brief = f"CANDIDATE — {label} on {event.isoformat()}; source: {publisher}."
    if basis == "possible_identity_candidate":
        brief = "Possible project association: " + brief
    return {
        "asset_key": asset_key(row), "repd_ref": row["Ref ID"],
        "relation_to_official": relation_to_official(row, event_type, event),
        "basis": reason, "association": basis,
        "verification": "candidate_requires_independent_review",
        "rights_basis": "unknown", "publisher_owner": owner or None,
        "event_type": event_type, "category": category, "priority": (
            "high" if event_type in {"consent_refused", "construction_started",
                                     "finance_secured", "epc_awarded"} else "normal"),
        "event_date": event.isoformat(),
        "published_date": published.isoformat() if published else None,
        "fetched_date": fetched.isoformat() if fetched else None,
        "first_seen_date": first_seen.isoformat() if first_seen else None,
        "source_url": url, "publisher": publisher,
        "brief": brief,
        "original_receipt_sha256": None,
        "source_independence": "unverified"
    }, None

def load_evidence(path):
    if not path:
        return []
    out = []
    for n, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            try:
                x = json.loads(line)
            except json.JSONDecodeError as ex:
                raise EvidenceError(f"invalid_jsonl_line_{n}") from ex
            if not isinstance(x, dict):
                raise EvidenceError(f"non_object_line_{n}")
            out.append(x)
    return out

def research_priority(row):
    """Lower is searched earlier; never changes the official 1,000-row order."""
    status = row["Development Status"].strip().casefold()
    rank = {
        "under construction": 1,
        "planning permission granted": 2,
        "appeal granted": 2,
        "planning application submitted": 3,
        "operational": 5,
        "revised": 6,
        "planning permission expired": 7,
        "planning permission refused": 8,
        "appeal refused": 8,
        "planning application withdrawn": 8,
        "abandoned": 9,
    }.get(status, 7)
    try:
        mw = float((row.get("Installed Capacity (MWelec)") or "").strip())
    except ValueError:
        mw = 0.0
    return rank, -mw


def build(rows, evidence, as_of):
    by_id = defaultdict(list)
    for x in evidence:
        by_id[str(x.get("repd_ref", ""))].append(x)
    notes, exclusions, queries = [], Counter(), []
    for row in rows:
        matched = []
        seen = set()
        for e in by_id[row["Ref ID"]]:
            n, why = evidence_note(row, e, as_of)
            if not n:
                exclusions[why] += 1
                continue
            unique = (n["event_type"], n["event_date"], n["source_url"])
            if unique not in seen:
                matched.append(n)
                seen.add(unique)
        matched.sort(key=lambda n: (n["event_date"], n["source_url"]), reverse=True)
        if not matched:
            priority, minus_mw = research_priority(row)
            queries.append({"asset_key": asset_key(row), "repd_ref": row["Ref ID"],
                            "research_priority": priority,
                            "official_capacity_mw": -minus_mw,
                            "official_status": row["Development Status"],
                            "queries": source_queries(row)})
        notes.append({
            "asset_key": asset_key(row), "repd_ref": row["Ref ID"],
            "official_status": row["Development Status"],
            "official_status_short": row["Development Status (short)"],
            "machine_note_state": "candidate" if matched else "no_external_evidence",
            "headline": matched[0]["brief"] if matched else "No independent evidence found",
            "remarks": matched,
            "official_data_mutated": False,
        })
    queries.sort(key=lambda q: (q["research_priority"],
                                -q["official_capacity_mw"],
                                int(q["repd_ref"])))
    return notes, dict(sorted(exclusions.items())), queries

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--csv", required=True)
    p.add_argument("--evidence", help="JSONL externally captured source candidates")
    p.add_argument("--out", required=True)
    p.add_argument("--audit", required=True)
    p.add_argument("--queue", required=True)
    p.add_argument("--as-of", required=True)
    p.add_argument("--limit", type=int, default=1000)
    p.add_argument("--expect-solar-count", type=int, default=7649)
    a = p.parse_args()
    as_of = date.fromisoformat(a.as_of)
    rows, source = select_solar(a.csv, a.limit)
    if source["solar_rows"] != a.expect_solar_count:
        raise SystemExit("FAIL: unexpected official snapshot solar count")
    entries = load_evidence(a.evidence)
    notes, exclusions, queue = build(rows, entries, as_of)
    if len(notes) != a.limit or len({n["asset_key"] for n in notes}) != a.limit:
        raise SystemExit("FAIL: missing or duplicate sidecar assets")
    coverage = Counter(n["machine_note_state"] for n in notes)
    output = {"schema": SCHEMA, "snapshot": SNAPSHOT, "source": SOURCE,
              "as_of": a.as_of, "source_sha256": source["sha256"],
              "selection": "first_1000_solar_in_original_csv_order",
              "notes": notes}
    audit = {"source": source, "evidence_entries": len(entries),
             "candidate_rows": coverage["candidate"],
             "no_external_evidence_rows": coverage["no_external_evidence"],
             "independently_verified_rows": 0, "rejections": exclusions,
             "scope_rows": len(notes),
             "publication_allowed": False,
             "warning": "Candidate receipts are NOT independently validated publisher evidence."}
    for path, obj in [(a.out, output), (a.audit, audit), (a.queue, queue)]:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(canonical(obj))
    print(json.dumps(audit, sort_keys=True))

if __name__ == "__main__":
    main()
