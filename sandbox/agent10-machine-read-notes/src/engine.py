"""Offline, deterministic, fail-closed Machine Read Notes demonstration.

Receipt fields are untrusted. A synthetic receipt is not evidence of an actual event.
This engine cannot itself confer independent reviewer acceptance.
"""
from __future__ import annotations

import base64
import binascii
from collections import defaultdict
from datetime import date, datetime, timezone
from hashlib import sha256
import json
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

SCHEMA = "globalgrid2050.machine-read-note.v1"
RECEIPT_SCHEMA = "globalgrid2050.source-receipt.v1"
ASSOCIATIONS = {"planning_reference", "explicit_project_name", "project_name_plus_location", "project_name_plus_developer", "multi_project_explicit", "tie_break_only", "unknown"}
EVENT_TYPES = {"planning_application", "consent_granted", "consent_refused", "construction_started", "turbine_installation_started", "financial_close", "ownership_change", "other"}
TRACKERS = {"fbclid", "gclid", "mc_cid", "mc_eid"}
LABEL_CANDIDATE = "CANDIDATE — NOT INDEPENDENTLY VERIFIED"
LABEL_INSUFFICIENT = "INSUFFICIENT EVIDENCE"


class EvidenceError(ValueError):
    """Invalid, inconsistent, or unproven input; no silent skipping."""


def stable_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value):
    return sha256(stable_json(value).encode("utf-8")).hexdigest()


def require(cond, code):
    if not cond:
        raise EvidenceError(code)


def safe_text(value, field, max_length=240):
    require(isinstance(value, str) and 0 < len(value) <= max_length, f"{field}:missing_or_long")
    require(not re.search(r"[<>]|\b(?:javascript:|data:text/html|onerror\s*=|ignore\s+previous\s+instructions)\b", value, re.I), f"{field}:untrusted_markup")
    require(not any(ord(c) < 32 for c in value), f"{field}:control_char")
    return value.strip()


def canonical_url(url):
    require(isinstance(url, str) and len(url) < 2048, "url:invalid")
    u = urlsplit(url)
    require(u.scheme.lower() == "https" and bool(u.hostname) and u.username is None and u.password is None, "url:not_https")
    require(u.port in (None, 443), "url:unexpected_port")
    require(not u.hostname.endswith(".local"), "url:private_host")
    query = urlencode(sorted((k, v) for k, v in parse_qsl(u.query, keep_blank_values=True) if k.lower() not in TRACKERS and not k.lower().startswith("utm_")))
    return urlunsplit(("https", u.hostname.lower(), u.path or "/", query, ""))


def when(clock, name, collection_date, allow_null=False):
    if clock is None:
        require(allow_null, f"{name}:required")
        return None
    require(isinstance(clock, dict), f"{name}:not_object")
    value = clock.get("value")
    precision = clock.get("precision")
    require(precision in ("date_only", "instant"), f"{name}:precision")
    if precision == "date_only":
        require(clock.get("timezone_known") is False and isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value), f"{name}:date_precision")
        try:
            parsed = date.fromisoformat(value)
        except ValueError as exc:
            raise EvidenceError(f"{name}:invalid_date") from exc
        d = parsed
    else:
        require(clock.get("timezone_known") is True and isinstance(value, str), f"{name}:timezone_required")
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise EvidenceError(f"{name}:invalid_instant") from exc
        require(parsed.tzinfo is not None and parsed.utcoffset() is not None, f"{name}:naive")
        d = parsed.date()
    require(d <= collection_date, f"{name}:future")
    return clock


def clock_date(clock):
    return date.fromisoformat(clock["value"][:10]) if clock else None


def association(row, receipt):
    basis = receipt.get("association_basis")
    require(basis in ASSOCIATIONS, "binding:unknown_basis")
    refs = receipt.get("project_refs")
    require(isinstance(refs, list) and refs and len(set(refs)) == len(refs), "binding:bad_ref_list")
    require(row["repd_ref"] in refs, "binding:wrong_repd")
    if len(refs) > 1:
        require(basis == "multi_project_explicit", "binding:multiple_projects_without_explicit_basis")
    if basis == "planning_reference":
        require(row.get("planning_reference") and receipt.get("planning_reference") == row["planning_reference"], "binding:planning_ref_mismatch")
    elif basis in {"explicit_project_name", "project_name_plus_location", "project_name_plus_developer"}:
        require(receipt.get("project_name", "").casefold() == row["project_name"].casefold(), "binding:project_name_mismatch")
        if basis == "project_name_plus_location":
            require(row.get("location") and receipt.get("location", "").casefold() == row["location"].casefold(), "binding:location_mismatch")
        if basis == "project_name_plus_developer":
            require(row.get("developer") and receipt.get("developer", "").casefold() == row["developer"].casefold(), "binding:developer_mismatch")
    elif basis == "multi_project_explicit":
        require(len(refs) > 1 and set(refs) == set(receipt.get("named_project_refs", [])), "binding:multi_project_unproven")
    elif basis in ("tie_break_only", "unknown"):
        return "weak"
    return "supported"


def receipt_checks(receipt, collection_date):
    require(receipt.get("schema") == RECEIPT_SCHEMA, "receipt:schema_version")
    require(receipt.get("source_proof") == "SYNTHETIC FIXTURE — NOT AN ACTUAL ARTICLE" or receipt.get("source_proof") == "COLLECTED — AUTHENTICITY NOT INDEPENDENTLY VERIFIED", "receipt:source_proof")
    source_synthetic = receipt["source_proof"].startswith("SYNTHETIC")
    url = canonical_url(receipt.get("url"))
    require(receipt.get("canonical_url") in (None, url), "receipt:canonical_url_mismatch")
    safe_text(receipt.get("publisher_name"), "publisher_name")
    if receipt.get("title") is not None:
        safe_text(receipt["title"], "title")
    require(receipt.get("event_type") in EVENT_TYPES, "event:invalid_type")
    require(receipt.get("rights_basis") in ("unknown", "permission_verified", "public_domain_verified"), "rights:unknown_basis")
    require(receipt.get("rights_basis") == "unknown" or bool(receipt.get("rights_proof_sha256")), "rights:missing_proof")
    # No claim of reuse permission from a hash, URL or self-reported metadata alone.
    require(receipt.get("rights_basis") == "unknown", "rights:untrusted_permission")
    require(receipt.get("review_state", "machine_only") in ("machine_only", "human_review_pending", "human_reviewed"), "review:untrusted_acceptance")
    require(receipt.get("binding_state", "candidate") == "candidate", "binding:untrusted_upgrade")
    published = when(receipt.get("published_at"), "published_at", collection_date)
    event_date = when(receipt.get("event_date"), "event_date", collection_date, allow_null=True)
    fetched = when(receipt.get("fetched_at"), "fetched_at", collection_date, allow_null=source_synthetic)
    first_seen = when(receipt.get("first_seen_at"), "first_seen_at", collection_date, allow_null=source_synthetic)
    if fetched and first_seen:
        require(clock_date(first_seen) <= clock_date(fetched), "clock:first_seen_after_fetch")
        require(clock_date(published) <= clock_date(fetched), "clock:published_after_fetch")
    if not source_synthetic:
        require(receipt.get("http_status") == 200 and receipt.get("content_type") is not None and receipt.get("retrieval_log") is not None, "receipt:transport_missing")
    raw = receipt.get("capture_bytes_base64")
    if raw is not None:
        try:
            decoded = base64.b64decode(raw, validate=True)
        except (ValueError, binascii.Error) as exc:
            raise EvidenceError("receipt:invalid_base64") from exc
        require(receipt.get("raw_bytes_sha256") == sha256(decoded).hexdigest(), "receipt:raw_digest_mismatch")
    else:
        require(receipt.get("raw_bytes_sha256") is None, "receipt:unverified_hash")
    require(not receipt.get("redirect_chain") or all(canonical_url(x) == url for x in receipt["redirect_chain"]), "receipt:redirect_mismatch")
    require(receipt.get("owner_verified") is not True or receipt.get("publisher_owner_id") is not None, "owner:unverified_id")
    if receipt.get("publisher_owner_id") is not None:
        safe_text(receipt["publisher_owner_id"], "owner_id", 100)
    return {"canonical_url": url, "synthetic": source_synthetic, "published_at": published, "event_date": event_date, "fetched_at": fetched, "first_seen_at": first_seen}


def event_key(repd_ref, receipt, canonical):
    # Missing independent event reference/date: keep per-original URL distinct.
    anchor = receipt.get("event_reference") or (receipt.get("event_date") or {}).get("value") or "url:" + canonical
    return digest([repd_ref, receipt["event_type"], anchor])[:24]


def relation(row, receipt, clocks):
    event = receipt["event_type"]
    as_of = date.fromisoformat(row["official_as_of"])
    published = clock_date(clocks["published_at"])
    event_date = clock_date(clocks["event_date"])
    if event == "turbine_installation_started":
        return "newer_event" if event_date and event_date > as_of else "insufficient_evidence"
    if event in ("consent_refused", "consent_granted"):
        if published > as_of and (not event_date or event_date > as_of):
            return "possible_status_conflict"
        return "consistent_with_record" if event_date and event_date <= as_of else "insufficient_evidence"
    return "newer_event" if event_date and event_date > as_of else "insufficient_evidence"


def render_text(row, receipt, clocks, binding, relation_code):
    if binding == "weak":
        return "The machine cannot establish an exact project association from the available material. The frozen record remains unchanged."
    kind = receipt["event_type"].replace("_", " ")
    if receipt["source_proof"].startswith("SYNTHETIC"):
        prefix = "Illustrative synthetic scenario only; no original article or real-world event has been verified."
    else:
        prefix = "A publication reports a possible event; independent verification remains outstanding."
    return f"{prefix} The reported event category is {kind}. The frozen government status is {row['official_status']} as of {row['official_as_of']}. The association basis is {receipt['association_basis'].replace('_', ' ')}. The assessment is {relation_code.replace('_', ' ')}."


def validate_render(note, row, receipt, clocks, binding, relation_code):
    require(note["repd_ref"] == row["repd_ref"], "render:wrong_row")
    require(note["official_record"]["official_status"] == row["official_status"], "render:mutated_official_status")
    require(note["article_url"] == canonical_url(receipt["url"]), "render:unsupported_url")
    require(note["event_date"] == clocks["event_date"], "render:unsupported_date")
    require(note["label"] in (LABEL_CANDIDATE, LABEL_INSUFFICIENT), "render:unsupported_verification")
    require(note["claim_text"] == render_text(row, receipt, clocks, binding, relation_code), "render:unsupported_or_unattributed_claim")
    require(note["rights_basis"] == "unknown", "render:rights_upgrade")
    return True


def make_note(row, receipt, snapshot_id, frozen_digest, collection_date):
    info = receipt_checks(receipt, collection_date)
    binding = association(row, receipt)
    relate = relation(row, receipt, info)
    url = info["canonical_url"]
    event_id = event_key(row["repd_ref"], receipt, url)
    label = LABEL_INSUFFICIENT if binding == "weak" else LABEL_CANDIDATE
    note = {
        "schema": SCHEMA,
        "note_id": digest([snapshot_id, row["repd_ref"], event_id, url])[:32],
        "repd_ref": row["repd_ref"], "project_name": row["project_name"], "source_snapshot_id": snapshot_id,
        "official_record": {"official_status": row["official_status"], "official_as_of": row["official_as_of"], "snapshot_sha256": frozen_digest},
        "association": {"basis": receipt["association_basis"], "binding_state": "candidate", "evidence_state": binding, "project_refs": receipt["project_refs"]},
        "event": {"event_type": receipt["event_type"], "event_key": event_id, "event_reference": receipt.get("event_reference"), "identity_ambiguous": not bool(receipt.get("event_reference") or receipt.get("event_date")), "relation_to_snapshot": relate},
        "event_date": info["event_date"], "published_at": info["published_at"], "fetched_at": info["fetched_at"], "first_seen_at": info["first_seen_at"],
        "article_url": url, "publisher_name": receipt["publisher_name"], "publisher_owner_id": receipt.get("publisher_owner_id") if receipt.get("owner_verified") else None,
        "rights_basis": "unknown", "review_state": receipt.get("review_state", "machine_only"), "independent_owner_count": 0,
        "source_proof": receipt["source_proof"], "evidence_receipt_sha256": sha256(base64.b64decode(receipt["capture_bytes_base64"])).hexdigest() if receipt.get("capture_bytes_base64") else None,
        "label": label, "claim_text": render_text(row, receipt, info, binding, relate), "reason_codes": ["SYNTHETIC_NO_ORIGINAL_RECEIPT" if info["synthetic"] else "REAL_SOURCE_NOT_INDEPENDENTLY_ATTESTED", "NO_ACCEPTED_REVIEW", "UNKNOWN_REUSE_RIGHTS"] + (["WEAK_REPD_BINDING"] if binding == "weak" else [])
    }
    validate_render(note, row, receipt, info, binding, relate)
    return note


def build(snapshot, receipts, collection_date):
    require(snapshot.get("schema") == "globalgrid2050.repd-snapshot-fixture.v1", "snapshot:schema")
    require(snapshot.get("source_proof") == "SYNTHETIC DEMONSTRATION ONLY", "snapshot:untrusted_official_status")
    rows = snapshot.get("rows")
    require(isinstance(rows, list) and rows and snapshot.get("expected_records") == len(rows), "snapshot:missing_or_incomplete")
    ids = [r.get("repd_ref") for r in rows]
    require(all(isinstance(ref, str) and ref.isdigit() for ref in ids) and len(set(ids)) == len(ids), "snapshot:duplicate_or_invalid_repd")
    for r in rows:
        safe_text(r.get("project_name"), "project_name")
        safe_text(r.get("official_status"), "official_status")
        date.fromisoformat(r["official_as_of"])
    require(isinstance(receipts, list) and receipts, "receipt:missing")
    by_ref = {r["repd_ref"]: r for r in rows}
    frozen = digest(rows)
    seen_ids = set()
    url_event = {}
    event_dates = {}
    notes = []
    for r in receipts:
        identifier = safe_text(r.get("receipt_id"), "receipt_id")
        require(identifier not in seen_ids, "receipt:duplicate_id")
        seen_ids.add(identifier)
        # Prevalidate once, including canonical URLs and four clocks.
        checked = receipt_checks(r, collection_date)
        event_marker = (r["event_type"], r.get("event_reference"), (r.get("event_date") or {}).get("value"))
        old = url_event.setdefault(checked["canonical_url"], event_marker)
        require(old == event_marker, "event:canonical_url_collision")
        for ref in r.get("project_refs", []):
            require(ref in by_ref, "binding:ref_missing_from_snapshot")
            n = make_note(by_ref[ref], r, snapshot["snapshot_id"], frozen, collection_date)
            key = (ref, r["event_type"], r.get("event_reference"))
            if r.get("event_reference"):
                prev = event_dates.setdefault(key, (r.get("event_date") or {}).get("value"))
                require(prev == (r.get("event_date") or {}).get("value"), "event:conflicting_dates_same_reference")
            notes.append(n)
    # Preserve receipts as separate events when lacking independently established event identity.
    notes.sort(key=lambda n: (int(n["repd_ref"]), n["event"]["event_key"], n["article_url"]))
    data = {"schema": "globalgrid2050.machine-read-notes-bundle.v1", "source_snapshot_id": snapshot["snapshot_id"], "source_proof": snapshot["source_proof"], "source_row_count": len(rows), "full_7775_identity_audit": "UNVERIFIED — SYNTHETIC SUBSET ONLY", "source_rows_sha256": frozen, "collection_as_of": collection_date.isoformat(), "notes": notes}
    data["bundle_sha256"] = digest(data)
    return data
