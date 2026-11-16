"""Generate labelled synthetic UI fixtures through the pinned FIGURES contract.

Source provisioning is explicit. This script is offline and rejects any source
file whose Git-blob bytes differ from the independently pinned digest.
"""
import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import types

CONTRACT = {
    "repository": "Ventusltd/globalgrid2050",
    "commit": "e0deabac45d35240f6c38f4303b8d50c90412e06",
    "path": "automation/news/filings/contracts.py",
    "sha256": "7db9f5334529bd51e3d1dc64abbd7ec0180b69e832c196d37cc93caf09e133c2",
}
HERE = Path(__file__).resolve().parent


def build(contract_file):
    source = Path(contract_file).read_bytes()
    if hashlib.sha256(source).hexdigest() != CONTRACT["sha256"]:
        raise ValueError("FIGURES source bytes do not match the immutable pin")
    module = types.ModuleType("pinned_figures")
    exec(compile(source, CONTRACT["path"], "exec"), module.__dict__)
    # All source bytes/identities/URLs below are invented test data. No network.
    synthetic_source = b"SYNTHETIC ONLY. No real issuer, document, project or reported fact.\n"
    claim = {
        "schema": module.SCHEMA, "claim_id": "fixture:finance:original",
        "status": "machine-provisional", "quantity_kind": "finance",
        "metric": "Synthetic capital allocation", "value": "9007199254740993.1200",
        "scale": "1", "unit": "currency", "original_unit": "USD", "currency": "USD",
        "finance_stage": "announced",
        "entity": {"scope": "consolidated_group", "id": "group:synthetic",
                   "consolidation_group_id": "group:synthetic",
                   "identity_evidence_url": "https://example.org/synthetic/identity"},
        "reporting_period": {"start": "2027", "end": "2027"},
        "as_of": "2026-11-16", "basis": "forecast", "assurance": "unknown",
        "provenance": {"document_id": "fixture:document:1",
                       "document_url": "https://example.org/synthetic/document",
                       "sha256": hashlib.sha256(synthetic_source).hexdigest(),
                       "page": "1", "section": "Synthetic capital allocation",
                       "published_date": "2026-11-16", "retrieved_at": "2026-11-16T12:00:00Z"},
        "revision": {"id": "original", "supersedes_claim_id": None, "restated": False},
    }
    finance = module.validate_claim(claim)
    committed = deepcopy(claim)
    committed.update(claim_id="fixture:finance:committed", value="1.20", scale="1e9",
                     original_unit="billion USD", finance_stage="committed")
    module.validate_claim(committed)
    energy = deepcopy(claim)
    energy.update(claim_id="fixture:energy:demand", quantity_kind="project_demand",
                  metric="Synthetic proposed demand; not a secured connection", value="480.00",
                  scale="1", unit="MW", original_unit="MW", currency=None, finance_stage=None)
    energy["entity"] = {"scope": "site", "id": "site:synthetic", "consolidation_group_id": None,
                        "identity_evidence_url": "https://example.org/synthetic/site"}
    module.validate_claim(energy)
    storage = deepcopy(energy)
    storage.update(claim_id="fixture:energy:storage", quantity_kind="storage_energy",
                   metric="Synthetic storage energy", value="10.50", unit="MWh", original_unit="MWh")
    module.validate_claim(storage)
    hostile = deepcopy(claim)
    hostile["claim_id"] = "fixture:text:literal"
    hostile["metric"] = '<img src=x onerror="window.fixtureXss=1"> SYNTHETIC literal text'
    module.validate_claim(hostile)
    return {
        "schema": "testcode.figures-ui.fixtures.v1",
        "notice": "SYNTHETIC TEST FIXTURES ONLY: no real figures, issuers, documents or project facts.",
        "contract": CONTRACT,
        "cases": {
            "finance": {"entityId": "group:synthetic", "claims": [finance, committed], "state": "available"},
            "energy": {"entityId": "site:synthetic", "claims": [energy, storage], "state": "available"},
            "hostile_text": {"entityId": "group:synthetic", "claims": [hostile], "state": "available"},
            "unknown": {"entityId": "site:synthetic", "claims": [], "state": "unknown"},
            "unavailable": {"entityId": "site:synthetic", "claims": [], "state": "unavailable"},
        },
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract-file", required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = json.dumps(build(args.contract_file), indent=2, ensure_ascii=False) + "\n"
    path = HERE / "fixtures.json"
    if args.check:
        if path.read_text(encoding="utf-8") != expected:
            raise SystemExit("Synthetic fixture file differs from pinned-contract regeneration")
        print("Pinned FIGURES source and five synthetic fixture cases checked")
    else:
        path.write_text(expected, encoding="utf-8")
