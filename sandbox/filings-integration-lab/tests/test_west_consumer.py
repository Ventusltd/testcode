"""Synthetic WEST -> optional FIGURES consumer scenarios; no source acquisition.

These tests use the real pinned component APIs. There is deliberately no joint
production binding API: exact issuer/document/hash associations below are
explicit test assertions representing checks a future consumer still needs.
All company names, financial statements, decisions and source bytes are fake
test inputs. HTTPS-shaped source URLs are never fetched or asserted reachable.
"""
import copy
import hashlib
import json
import unittest

from lab_support import load_component


def synthetic_inputs(report_date="2026-09-30"):
    source = {
        "cik": "1234567", "name": "SYNTHETIC LAB CORPORATE GROUP",
        "entityType": "operating", "category": "Large accelerated filer",
        "tickers": ["SYNTH"], "exchanges": ["Nasdaq"],
        "addresses": {"business": {"street1": "SYNTHETIC PRIVATE FIELD MUST NOT PASS"}},
        "filings": {"recent": {
            "accessionNumber": ["0001234567-26-000001", "0001234567-26-000002", "0001234567-26-000003"],
            "filingDate": ["2026-10-20", "2026-10-21", "2026-10-22"],
            "reportDate": [report_date, report_date, ""],
            "acceptanceDateTime": ["2026-10-20T15:00:00Z", "2026-10-21T15:00:00Z", "2026-10-22T15:00:00Z"],
            "form": ["10-Q", "10-Q/A", "4"],
            "primaryDocument": ["synthetic-report.htm", "synthetic-report.htm", "synthetic-person.xml"],
        }},
    }
    raw = json.dumps(source, sort_keys=True).encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()
    url = "https://data.sec.gov/submissions/CIK0001234567.json"
    receipt = {
        "source_id": "us-sec-edgar", "requested_url": url, "final_url": url,
        "http_status": 200, "content_type": "application/json",
        "payload_sha256": digest, "bytes": len(raw),
        "retrieved_at": "2026-11-16T17:00:00Z", "eligible_for_publication": False,
    }
    scope = {
        "cik": "0001234567", "entity_kind": "listed_corporate_group",
        "decision": "ALLOW_METADATA_RESEARCH", "payload_sha256": digest,
        "includes_personal_or_sme_enrichment": False,
        "ticker": "SYNTH", "exchange": "Nasdaq",
        "review_url": "https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-12345",
        "reviewed_at": "2026-11-16T17:01:00Z",
    }
    return raw, receipt, scope


SYNTHETIC_DOCUMENT_BYTES = (
    b"SYNTHETIC TEST DOCUMENT. Not a real filing. CIK0001234567. Page12. "
    b"Capital expenditure reported for 2026-01-01 to 2026-09-30: "
    b"120.050 million US dollars. Issuer scope, unaudited."
)


def synthetic_figure(filing):
    """Manually authored from the labelled fixture, not an extraction API."""
    return {
        "schema": "globalgrid2050.filing-figure.v1",
        "claim_id": filing["filing_id"] + ":capex:fixture",
        "status": "machine-provisional", "quantity_kind": "finance",
        "metric": "Capital expenditure", "value": "120.050", "scale": "1e6",
        "unit": "currency", "original_unit": "million US dollars",
        "currency": "USD", "finance_stage": "reported",
        "entity": {"scope": "issuer", "id": filing["issuer_id"],
                   "consolidation_group_id": None,
                   "identity_evidence_url": filing["document_url"]},
        "reporting_period": {"start": "2026-01-01", "end": "2026-09-30"},
        "as_of": None, "basis": "reported", "assurance": "unaudited",
        "provenance": {
            "document_id": filing["filing_id"], "document_url": filing["document_url"],
            "sha256": hashlib.sha256(SYNTHETIC_DOCUMENT_BYTES).hexdigest(),
            "page": "12", "section": "Capital expenditure",
            "published_date": "2026-10-20", "retrieved_at": "2026-11-16T17:00:00Z",
        },
        "revision": {"id": "synthetic-original", "supersedes_claim_id": None, "restated": False},
    }


class WestConsumerScenarios(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.west = load_component("west")
        cls.figures = load_component("figures")

    def metadata(self, report_date="2026-09-30"):
        raw, receipt, scope = synthetic_inputs(report_date)
        return self.west.normalize_submissions(raw, receipt=receipt, issuer_scope=scope)

    def test_metadata_is_not_numeric_evidence_and_excludes_personal_forms(self):
        metadata = self.metadata()
        self.assertEqual(metadata["input_rows"], 3)
        self.assertEqual(metadata["returned_rows"], 2)
        self.assertEqual(metadata["financial_claims"], [])
        self.assertEqual(metadata["group_relationships"], [])
        self.assertTrue(all(row["figures"] == [] and row["document_sha256"] is None
                            for row in metadata["filings"]))
        self.assertNotIn("PRIVATE FIELD", json.dumps(metadata))
        self.assertNotIn("synthetic-person.xml", json.dumps(metadata))
        self.assertFalse(metadata["eligible_for_publication"])

    def test_optional_figure_uses_separate_source_bytes_and_explicit_identity_checks(self):
        metadata = self.metadata()
        before = copy.deepcopy(metadata)
        filing = metadata["filings"][0]
        figure = self.figures.validate_claim(synthetic_figure(filing))
        # Explicit consumer assertions: neither component performs this binding.
        self.assertEqual(figure["entity"]["id"], "sec-cik:0001234567")
        self.assertEqual(figure["entity"]["id"], metadata["issuer"]["id"])
        self.assertEqual(figure["provenance"]["document_id"], filing["filing_id"])
        self.assertEqual(figure["provenance"]["document_url"], filing["document_url"])
        self.assertEqual(figure["provenance"]["sha256"], hashlib.sha256(SYNTHETIC_DOCUMENT_BYTES).hexdigest())
        self.assertNotEqual(figure["provenance"]["sha256"], metadata["receipt"]["payload_sha256"])
        wire = json.loads(self.figures.dumps_claim(figure))
        self.assertEqual((wire["value"], wire["scale"], wire["currency"]), ("120.050", "1e6", "USD"))
        self.assertEqual(wire["status"], "machine-provisional")
        self.assertEqual(metadata, before)  # Validation does not attach or verify anything.

    def test_unknown_document_hash_cannot_be_promoted_from_metadata(self):
        filing = self.metadata()["filings"][0]
        claim = synthetic_figure(filing)
        claim["provenance"]["sha256"] = filing["document_sha256"]
        with self.assertRaises(self.figures.ClaimValidationError):
            self.figures.validate_claim(claim)

    def test_submission_hash_substitution_exposes_external_binding_gap(self):
        metadata = self.metadata()
        claim = synthetic_figure(metadata["filings"][0])
        claim["provenance"]["sha256"] = metadata["receipt"]["payload_sha256"]
        # Contract shape validation alone accepts a syntactically valid hash.
        validated = self.figures.validate_claim(claim)
        self.assertNotEqual(validated["provenance"]["sha256"],
                            hashlib.sha256(SYNTHETIC_DOCUMENT_BYTES).hexdigest())
        self.assertEqual(metadata["financial_claims"], [])
        self.assertFalse(metadata["eligible_for_publication"])

    def test_different_issuer_valid_claim_is_not_automatically_associated(self):
        metadata = self.metadata()
        claim = synthetic_figure(metadata["filings"][0])
        claim["entity"]["id"] = "sec-cik:0007654321"
        validated = self.figures.validate_claim(claim)
        # FIGURES intentionally does not consult WEST or authenticate identity.
        self.assertNotEqual(validated["entity"]["id"], metadata["issuer"]["id"])
        self.assertEqual(metadata["group_relationships"], [])
        self.assertEqual(metadata["financial_claims"], [])

    def test_same_filename_amendment_is_separate_document_not_inferred_restatement(self):
        original, amended = self.metadata()["filings"]
        self.assertEqual(original["document_url"].rsplit("/", 1)[1], amended["document_url"].rsplit("/", 1)[1])
        self.assertNotEqual(original["filing_id"], amended["filing_id"])
        self.assertNotEqual(original["document_url"], amended["document_url"])
        self.assertTrue(amended["is_amendment"])
        self.assertEqual(amended["restatement_status"], "UNKNOWN")
        self.assertIsNone(amended["supersedes"])
        unsupported = synthetic_figure(amended)
        unsupported["revision"]["restated"] = True
        with self.assertRaises(self.figures.ClaimValidationError):
            self.figures.validate_claim(unsupported)

    def test_missing_report_date_is_not_filled_with_filing_or_retrieval_date(self):
        metadata = self.metadata(report_date="")
        filing = metadata["filings"][0]
        self.assertIsNone(filing["report_date"])
        self.assertEqual(filing["filing_date"], "2026-10-20")
        claim = synthetic_figure(filing)
        claim["reporting_period"] = None
        claim["as_of"] = filing["report_date"]
        with self.assertRaises(self.figures.ClaimValidationError):
            self.figures.validate_claim(claim)
        # The separately supplied fixture period is acceptable, without modifying metadata.
        independent = self.figures.validate_claim(synthetic_figure(filing))
        self.assertEqual(independent["reporting_period"]["end"], "2026-09-30")
        self.assertIsNone(filing["report_date"])

    def test_tampered_document_is_detectable_only_by_upstream_byte_comparison(self):
        claim = self.figures.validate_claim(synthetic_figure(self.metadata()["filings"][0]))
        changed_bytes = SYNTHETIC_DOCUMENT_BYTES.replace(b"120.050", b"920.050")
        self.assertNotEqual(hashlib.sha256(changed_bytes).hexdigest(), claim["provenance"]["sha256"])
        self.assertEqual(claim["value"], "120.050")
        # Neither component reads document bytes or certifies a figure's truth.
        self.assertEqual(claim["status"], "machine-provisional")


if __name__ == "__main__":
    unittest.main()
