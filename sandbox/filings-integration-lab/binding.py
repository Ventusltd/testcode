"""Experimental offline issuer/document binding gate; never publication approval.

Consumes normalized WEST/ASIA metadata, a FIGURES claim, exact document bytes,
and a separately supplied successful document receipt. This verifies internal
identity and byte consistency, not receipt authenticity, source truth, numerical
extraction, publisher rights or what a document actually says. Source metadata
must have come from the pinned normalizer; it is not independently authenticated.

ASIA's canonical document identity is normalized record['id'] (namespaced), not
its raw record['document_id']. WEST requires an explicit selected filing_id.
Only issuer scope is supported. No project/group linkage, sum or release action
is performed. These functions are TestCode experiments, not a production API.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime
import hashlib
import re

from lab_support import load_component


MAX_DOCUMENT_BYTES = 4_000_000
RECEIPT_KEYS = {"requested_url", "final_url", "http_status", "sha256", "retrieved_at"}


class BindingError(ValueError):
    """The supplied metadata, claim, bytes and receipt cannot be bound."""


def _instant(value):
    if not isinstance(value, str) or not re.fullmatch(
            r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?(?:Z|[+-][0-9]{2}:[0-9]{2})", value):
        raise BindingError("Receipt timestamp requires seconds and timezone")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise BindingError("Invalid receipt timestamp") from exc


def _digest(value):
    if not isinstance(value, str) or not re.fullmatch(r"[a-f0-9]{64}", value):
        raise BindingError("Expected SHA256")
    return value


def _receipt(value):
    if not isinstance(value, dict) or set(value) != RECEIPT_KEYS:
        raise BindingError("Explicit complete source document receipt required")
    if type(value["http_status"]) is not int or value["http_status"] != 200:
        raise BindingError("Document receipt must describe HTTP200")
    _digest(value["sha256"])
    _instant(value["retrieved_at"])
    if any(not isinstance(value[key], str) or not value[key]
           for key in ("requested_url", "final_url")):
        raise BindingError("Document receipt URLs required")
    return value


def bind_claim(metadata, claim, *, document_bytes, document_receipt, source_kind, filing_id=None):
    """Return a detached PROVISIONAL/publishable-false consistency receipt.

    document_receipt has exactly requested_url/final_url/http_status/sha256/
    retrieved_at. WEST needs a separate HTTP200 receipt for the actual filing,
    never its submissions JSON. ASIA checks against its existing document receipt.
    Equivalent timezone representations of the same instant are accepted.
    """
    if not isinstance(metadata, dict) or metadata.get("status") != "PROVISIONAL":
        raise BindingError("Expected provisional normalized metadata")
    if not isinstance(document_bytes, bytes) or not 0 < len(document_bytes) <= MAX_DOCUMENT_BYTES:
        raise BindingError("Document bytes missing or exceed bound")
    receipt = _receipt(document_receipt)
    digest = hashlib.sha256(document_bytes).hexdigest()
    if receipt["sha256"] != digest:
        raise BindingError("Document receipt does not match supplied bytes")
    try:
        figure = load_component("figures").validate_claim(claim)
    except ValueError as exc:
        raise BindingError("FIGURES claim validation failed") from exc

    allowed_consolidation_ids = {None}
    if source_kind == "west":
        if (metadata.get("schema") != "globalgrid2050.filing-metadata.sec.v1"
                or metadata.get("source_id") != "us-sec-edgar"
                or metadata.get("eligible_for_publication") is not False
                or metadata.get("automatic_collection_enabled") is not False):
            raise BindingError("Invalid or publication-enabled WEST metadata")
        rows = metadata.get("filings")
        if not isinstance(rows, list) or not isinstance(filing_id, str) or not filing_id:
            raise BindingError("Explicit WEST filing selection required")
        matches = [row for row in rows if isinstance(row, dict) and row.get("filing_id") == filing_id]
        if len(matches) != 1:
            raise BindingError("WEST filing selection missing or ambiguous")
        row = matches[0]
        if row.get("status") != "PROVISIONAL":
            raise BindingError("Expected provisional WEST filing")
        issuer = row.get("issuer_id")
        if not isinstance(metadata.get("issuer"), dict) or issuer != metadata["issuer"].get("id"):
            raise BindingError("WEST outer and filing issuer mismatch")
        source_receipt = metadata.get("receipt")
        if not isinstance(source_receipt, dict):
            raise BindingError("Missing WEST submissions receipt")
        if digest == _digest(source_receipt.get("payload_sha256")):
            raise BindingError("Submissions bytes cannot substitute for filing document bytes")
        document_id, document_url = row["filing_id"], row.get("document_url")
        if receipt["requested_url"] != document_url:
            raise BindingError("WEST receipt must request the selected document URL")
        if _instant(receipt["retrieved_at"]) < _instant(row.get("accepted_at")):
            raise BindingError("Document receipt predates filing acceptance")
    elif source_kind == "asia":
        if (metadata.get("schema") != "globalgrid2050.asia-filing-metadata.v1"
                or metadata.get("publishable") is not False
                or metadata.get("collection_enabled") is not False
                or metadata.get("independently_verified") is not False
                or metadata.get("document_bytes_checked") is not True
                or type(metadata.get("document_byte_count")) is not int
                or metadata["document_byte_count"] != len(document_bytes)):
            raise BindingError("Invalid or publication-enabled ASIA metadata")
        if filing_id is not None:
            raise BindingError("ASIA uses its canonical normalized record id")
        original_receipt = _receipt(metadata.get("receipt"))
        for key in RECEIPT_KEYS - {"retrieved_at"}:
            if original_receipt[key] != receipt[key]:
                raise BindingError("ASIA metadata and document receipt mismatch")
        if _instant(original_receipt["retrieved_at"]) != _instant(receipt["retrieved_at"]):
            raise BindingError("ASIA retrieval instant mismatch")
        issuer, document_id = metadata.get("issuer_id"), metadata.get("id")
        document_url = metadata.get("document_url")
        if isinstance(metadata.get("listed_parent_id"), str):
            allowed_consolidation_ids.add(metadata["listed_parent_id"])
    else:
        raise BindingError("Unsupported source kind")

    provenance = figure["provenance"]
    if (figure["entity"]["scope"] != "issuer" or figure["entity"]["id"] != issuer
            or figure["entity"]["consolidation_group_id"] not in allowed_consolidation_ids
            or provenance["document_id"] != document_id
            or provenance["document_url"] != document_url
            or receipt["final_url"] != document_url
            or provenance["sha256"] != digest):
        raise BindingError("Exact issuer/document/byte association failed")
    if _instant(provenance["retrieved_at"]) != _instant(receipt["retrieved_at"]):
        raise BindingError("Claim and document receipt retrieval instants differ")
    # Only an existing ASIA consolidation label can be preserved; WEST supplies
    # no such relationship. Neither becomes a verified group/project association.
    return {
        "schema": "testcode.filing-figure-binding.v1", "status": "PROVISIONAL",
        "source_kind": source_kind, "source_id": metadata.get("source_id"),
        "issuer_id": issuer, "document_id": document_id, "document_url": document_url,
        "document_sha256": digest, "document_byte_count": len(document_bytes),
        "document_receipt": deepcopy(receipt), "claim": figure,
        "publishable": False, "independently_verified": False,
        "hold_reasons": ["receipt_authentication_not_performed", "claim_semantics_not_verified",
                         "rights_not_accepted_by_binding", "independent_review_required"],
        "group_or_project_associations": [],
    }
