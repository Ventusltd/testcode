"""Adapter from Agent11 V9.24 candidate ledger into Agent10 candidate-only v1.

Does NOT change the V9.23 product or its native MAP/CSV/render algorithms.
"""
from __future__ import annotations
from copy import deepcopy
from engine import EvidenceError

SCHEMA = "globalgrid2050.machine-read-notes-sidecar.v1"
KEY_PREFIX = "repd|DESNZ-REPD|2026q3|"

def to_agent10_sidecar(ledger):
    result = {}
    for entry in ledger:
        full_key = entry["asset_key"]
        if not full_key.startswith(KEY_PREFIX):
            raise EvidenceError("agent10_asset_key_contract_mismatch")
        ref = full_key.removeprefix(KEY_PREFIX)
        if not ref.isascii() or not ref.isdecimal() or ref != entry["repd_ref"]:
            raise EvidenceError("agent10_repd_id_mismatch")
        if full_key in result:
            raise EvidenceError("agent10_duplicate_sidecar_key")
        if entry.get("independently_verified") or entry.get("editorially_accepted"):
            # Accepted review has a separate owner-approval and proof path in the
            # future schema; v1 explicitly cannot represent it.
            raise EvidenceError("agent10_v1_cannot_claim_verified")
        candidate = entry["research_state"] == "candidate"
        sources = entry.get("remarks") or []
        if candidate and not sources:
            raise EvidenceError("candidate_without_source")
        result[full_key] = {
            "asset_key": {
                "vertical": "repd",
                "source_register": "DESNZ-REPD",
                "source_snapshot": "2026q3",
                "source_record_id": ref
            },
            "note_state": "candidate" if candidate else "insufficient_evidence",
            "rights_basis": "unknown",
            "brief": (entry["headline"] if candidate else
                      "INDEPENDENT EVIDENCE NOT ACCEPTED — " + entry["headline"]),
            "source_url": sources[0]["source_url"] if candidate else None
        }
    return {"schema": SCHEMA, "notes": result}
