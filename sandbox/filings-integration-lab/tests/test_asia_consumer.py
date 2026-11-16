"""Synthetic consumer flows across the pinned ASIA and FIGURES components.

All document bytes, issuer evidence and financial statements below are invented
test fixtures. The fixture author supplies the figure explicitly: no production
claim extraction, automatic association, rights grant or verification is implied.
"""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import json
import unittest

from lab_support import load_component


SYNTHETIC_DOCUMENT = (
    b"SYNTHETIC TEST DOCUMENT - NOT A REAL ISSUER FILING\n"
    b"Page 1 / Capital expenditure: forecast 1.20 billion CNY in 2027.\n"
)


def synthetic_metadata(asia, *, source="sse", code="600000", body=SYNTHETIC_DOCUMENT):
    """Build source-shaped synthetic evidence; no network or issuer lookup."""
    host = asia.source_registry()["sources"][source]["allowed_hosts"][0]
    url = f"https://{host}/synthetic-test-only/disclosure.pdf"
    return {
        "source_id": source, "issuer_code": code, "document_id": "synthetic-doc-001",
        "document_url": url,
        "published": {"value": "2026-11-16", "precision": "day"},
        "identity_evidence": {
            "issuer_id": f"{source}:{code}", "listed_parent_id": f"{source}:{code}",
            "relation": "self", "eligibility": "eligible_listed_parent_group",
            "listing_evidence_url": url, "group_evidence_url": url,
            "eligibility_evidence_url": url, "reviewed_at": "2026-11-17T12:00:00Z",
        },
        "receipt": {
            "requested_url": url, "final_url": url, "http_status": 200,
            "retrieved_at": "2026-11-16T12:00:00Z",
            "sha256": hashlib.sha256(body).hexdigest(),
        },
    }


def synthetic_figure(record, *, retrieved_at=None):
    """Explicit fixture mapping, not a general production association API."""
    return {
        "schema": "globalgrid2050.filing-figure.v1",
        "claim_id": record["id"] + ":capex:original",
        "status": "machine-provisional", "quantity_kind": "finance",
        "metric": "Capital expenditure", "value": "1.20", "scale": "1e9",
        "unit": "currency", "original_unit": "billion CNY", "currency": "CNY",
        "finance_stage": "announced",
        "entity": {
            "scope": "issuer", "id": record["issuer_id"],
            "consolidation_group_id": record["listed_parent_id"],
            "identity_evidence_url": record["identity_evidence"]["group_evidence_url"],
        },
        "reporting_period": {"start": "2027", "end": "2027"},
        "as_of": "2026-11-16", "basis": "forecast", "assurance": "unknown",
        "provenance": {
            "document_id": record["id"], "document_url": record["document_url"],
            "sha256": record["receipt"]["sha256"], "page": "1",
            "section": "Capital expenditure",
            "published_date": record["published"]["value"],
            "retrieved_at": retrieved_at or record["receipt"]["retrieved_at"],
        },
        "revision": {"id": "original", "supersedes_claim_id": None, "restated": False},
    }


class AsiaConsumerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.asia = load_component("asia")
        cls.figures = load_component("figures")

    def test_explicit_synthetic_figure_retains_document_identity_and_decimal(self):
        metadata = synthetic_metadata(self.asia)
        before = deepcopy(metadata)
        record = self.asia.normalize_disclosure(metadata, document_bytes=SYNTHETIC_DOCUMENT)
        claim = self.figures.validate_claim(synthetic_figure(record))
        self.assertIn(b"1.20 billion CNY", SYNTHETIC_DOCUMENT)
        self.assertEqual(claim["value"], "1.20")
        self.assertEqual(claim["scale"], "1e9")
        self.assertEqual(claim["provenance"]["sha256"], record["receipt"]["sha256"])
        self.assertEqual(claim["provenance"]["document_url"], record["document_url"])
        self.assertEqual(claim["entity"]["id"], record["issuer_id"])
        self.assertEqual(claim["provenance"]["document_id"], record["id"])
        self.assertEqual(record["status"], "PROVISIONAL")
        self.assertEqual(claim["status"], "machine-provisional")
        self.assertFalse(record["publishable"])
        self.assertEqual(metadata, before)

    def test_valid_figure_does_not_override_unknown_or_restricted_source_rights(self):
        for source, code in (("sse", "600000"), ("jpx", "130A")):
            with self.subTest(source=source):
                metadata = synthetic_metadata(self.asia, source=source, code=code)
                record = self.asia.normalize_disclosure(metadata, document_bytes=SYNTHETIC_DOCUMENT)
                self.figures.validate_claim(synthetic_figure(record))
                self.assertIn(record["rights_status"], {"unknown", "restricted_unapproved"})
                self.assertFalse(record["collection_enabled"])
                self.assertFalse(record["publishable"])
                self.assertFalse(record["independently_verified"])
                self.assertIn("rights_not_approved", record["hold_reasons"])

    def test_planted_byte_mismatch_blocks_intake_before_figure_mapping(self):
        metadata = synthetic_metadata(self.asia)
        changed = SYNTHETIC_DOCUMENT.replace(b"1.20", b"9.99")
        with self.assertRaises(ValueError):
            self.asia.normalize_disclosure(metadata, document_bytes=changed)

    def test_revision_flow_preserves_original_and_explicitly_links_new_claim(self):
        original_metadata = synthetic_metadata(self.asia)
        original_record = self.asia.normalize_disclosure(
            original_metadata, document_bytes=SYNTHETIC_DOCUMENT)
        original_claim = self.figures.validate_claim(synthetic_figure(original_record))
        saved_original = json.dumps(original_claim, sort_keys=True)
        revised_bytes = SYNTHETIC_DOCUMENT.replace(b"1.20", b"1.25")
        revised_metadata = deepcopy(original_metadata)
        with self.assertRaises(ValueError):
            self.asia.normalize_disclosure(revised_metadata, document_bytes=revised_bytes)
        revised_metadata["receipt"]["sha256"] = hashlib.sha256(revised_bytes).hexdigest()
        revised_metadata["receipt"]["retrieved_at"] = "2026-11-17T12:00:00Z"
        revised_record = self.asia.normalize_disclosure(revised_metadata, document_bytes=revised_bytes)
        candidate = synthetic_figure(revised_record)
        candidate["value"] = "1.25"  # Explicit fixture-author assertion, not extraction.
        candidate["claim_id"] = revised_record["id"] + ":capex:revision-2"
        candidate["revision"] = {
            "id": "revision-2", "supersedes_claim_id": original_claim["claim_id"], "restated": True,
        }
        revised_claim = self.figures.validate_claim(candidate)
        self.assertEqual(original_record["id"], revised_record["id"])
        self.assertNotEqual(original_record["receipt"]["sha256"], revised_record["receipt"]["sha256"])
        self.assertNotEqual(original_claim["claim_id"], revised_claim["claim_id"])
        self.assertEqual(revised_claim["revision"]["supersedes_claim_id"], original_claim["claim_id"])
        self.assertEqual(json.dumps(original_claim, sort_keys=True), saved_original)
        self.assertFalse(revised_record["publishable"])

    def test_restated_claim_cannot_silently_supersede_its_own_identity(self):
        record = self.asia.normalize_disclosure(synthetic_metadata(self.asia), document_bytes=SYNTHETIC_DOCUMENT)
        claim = synthetic_figure(record)
        claim["revision"] = {"id": "r2", "supersedes_claim_id": claim["claim_id"], "restated": True}
        with self.assertRaises(ValueError):
            self.figures.validate_claim(claim)

    def test_source_midnight_needs_explicit_same_instant_offset_for_figure_date(self):
        metadata = synthetic_metadata(self.asia)
        metadata["receipt"]["retrieved_at"] = "2026-11-15T16:30:00Z"  # Shanghai Nov 16 00:30.
        record = self.asia.normalize_disclosure(metadata, document_bytes=SYNTHETIC_DOCUMENT)
        # ASIA compares the date in the registered source timezone; FIGURES
        # preserves the caller's supplied timezone. A naive UTC handoff fails.
        with self.assertRaises(ValueError):
            self.figures.validate_claim(synthetic_figure(record))
        offset = self.asia.source_registry()["sources"][record["source_id"]]["utc_offset_minutes"]
        utc_instant = datetime.fromisoformat(record["receipt"]["retrieved_at"].replace("Z", "+00:00"))
        source_instant = utc_instant.astimezone(timezone(timedelta(minutes=offset)))
        claim = self.figures.validate_claim(synthetic_figure(record, retrieved_at=source_instant.isoformat()))
        self.assertEqual(source_instant, utc_instant)
        self.assertEqual(claim["provenance"]["published_date"], "2026-11-16")
        self.assertEqual(record["published"]["precision"], "day")
        self.assertEqual(claim["provenance"]["retrieved_at"], "2026-11-16T00:30:00+08:00")
        self.assertEqual(record["receipt"]["retrieved_at"], "2026-11-15T16:30:00Z")

    def test_same_numeric_code_across_markets_is_not_one_issuer(self):
        records = []
        claims = []
        for source in ("sse", "bse"):
            metadata = synthetic_metadata(self.asia, source=source, code="600000")
            record = self.asia.normalize_disclosure(metadata, document_bytes=SYNTHETIC_DOCUMENT)
            records.append(record)
            claims.append(self.figures.validate_claim(synthetic_figure(record)))
        self.assertNotEqual(records[0]["issuer_id"], records[1]["issuer_id"])
        self.assertNotEqual(claims[0]["entity"]["id"], claims[1]["entity"]["id"])
        self.assertNotEqual(claims[0]["provenance"]["document_id"], claims[1]["provenance"]["document_id"])

    def test_subsidiary_figure_is_not_promoted_to_a_group_total(self):
        metadata = synthetic_metadata(self.asia)
        metadata["identity_evidence"].update(
            relation="subsidiary", listed_parent_id="group:synthetic-listed-parent")
        record = self.asia.normalize_disclosure(metadata, document_bytes=SYNTHETIC_DOCUMENT)
        claim = self.figures.validate_claim(synthetic_figure(record))
        self.assertEqual(claim["entity"]["scope"], "issuer")
        self.assertEqual(claim["entity"]["id"], "sse:600000")
        self.assertEqual(claim["entity"]["consolidation_group_id"], "group:synthetic-listed-parent")
        self.assertNotEqual(claim["entity"]["id"], claim["entity"]["consolidation_group_id"])

    def test_nse_ampersand_identity_is_explicitly_unsupported_by_figure_contract(self):
        # ASIA admits the source's symbol syntax. FIGURES has a narrower ID
        # alphabet. Preserve this integration limitation instead of stripping
        # punctuation and silently creating a different issuer identity.
        metadata = synthetic_metadata(self.asia, source="nse", code="M&M")
        record = self.asia.normalize_disclosure(metadata, document_bytes=SYNTHETIC_DOCUMENT)
        self.assertEqual(record["issuer_id"], "nse:M&M")
        with self.assertRaises(ValueError):
            self.figures.validate_claim(synthetic_figure(record))
        self.assertEqual(record["issuer_id"], "nse:M&M")
        self.assertFalse(record["publishable"])

    def test_valid_metadata_does_not_reclassify_it_load_as_generation(self):
        record = self.asia.normalize_disclosure(synthetic_metadata(self.asia), document_bytes=SYNTHETIC_DOCUMENT)
        claim = synthetic_figure(record)
        claim.update(quantity_kind="it_load", metric="IT load", value="10.00", scale="1",
                     unit="MW", original_unit="MW IT load", currency=None, finance_stage=None)
        validated = self.figures.validate_claim(claim)
        self.assertEqual(validated["quantity_kind"], "it_load")
        self.assertEqual(validated["value"], "10.00")
        self.assertEqual(validated["status"], "machine-provisional")
        self.assertFalse(record["publishable"])
        # This is an intentionally unsupported fixture assertion: schema/hash
        # validity does not prove that document text supports this number.
        self.assertNotIn(b"10.00", SYNTHETIC_DOCUMENT)


if __name__ == "__main__":
    unittest.main()
