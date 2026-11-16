"""Synthetic end-to-end byte/identity bindings, including actual failing gates."""
from copy import deepcopy
import hashlib
import unittest

from binding import BindingError, bind_claim
from lab_support import load_component
from test_west_consumer import (synthetic_inputs, synthetic_figure as west_figure,
                                SYNTHETIC_DOCUMENT_BYTES)
from test_asia_consumer import (synthetic_metadata, synthetic_figure as asia_figure,
                                SYNTHETIC_DOCUMENT)


class BindingScenarios(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.west = load_component("west")
        cls.asia = load_component("asia")

    def west_case(self):
        raw, receipt, scope = synthetic_inputs()
        record = self.west.normalize_submissions(raw, receipt=receipt, issuer_scope=scope)
        filing = record["filings"][0]
        claim = west_figure(filing)
        document_receipt = {
            "requested_url": filing["document_url"], "final_url": filing["document_url"],
            "http_status": 200, "sha256": hashlib.sha256(SYNTHETIC_DOCUMENT_BYTES).hexdigest(),
            "retrieved_at": claim["provenance"]["retrieved_at"],
        }
        args = {"document_bytes": SYNTHETIC_DOCUMENT_BYTES, "document_receipt": document_receipt,
                "source_kind": "west", "filing_id": filing["filing_id"]}
        return record, claim, args

    def asia_case(self):
        supplied = synthetic_metadata(self.asia)
        record = self.asia.normalize_disclosure(supplied, document_bytes=SYNTHETIC_DOCUMENT)
        return record, asia_figure(record), {"document_bytes": SYNTHETIC_DOCUMENT,
            "document_receipt": deepcopy(record["receipt"]), "source_kind": "asia"}

    def test_west_positive_requires_actual_document_receipt_and_does_not_mutate(self):
        metadata, claim, args = self.west_case()
        before = deepcopy((metadata, claim, args))
        result = bind_claim(metadata, claim, **args)
        self.assertEqual(result["claim"]["value"], "120.050")
        self.assertEqual(result["issuer_id"], metadata["issuer"]["id"])
        self.assertNotEqual(result["document_sha256"], metadata["receipt"]["payload_sha256"])
        self.assertFalse(result["publishable"])
        self.assertFalse(result["independently_verified"])
        self.assertEqual(result["group_or_project_associations"], [])
        result["claim"]["value"] = "0"
        result["document_receipt"]["sha256"] = "0" * 64
        self.assertEqual((metadata, claim, args), before)

    def test_asia_positive_uses_namespaced_record_id_and_existing_receipt(self):
        metadata, claim, args = self.asia_case()
        result = bind_claim(metadata, claim, **args)
        self.assertEqual(result["document_id"], metadata["id"])
        self.assertNotEqual(result["document_id"], metadata["document_id"])
        self.assertEqual(result["document_sha256"], metadata["receipt"]["sha256"])
        self.assertEqual(result["status"], "PROVISIONAL")
        self.assertFalse(result["publishable"])
        self.assertIn("rights_not_accepted_by_binding", result["hold_reasons"])

    def test_missing_west_document_receipt_is_fatal(self):
        metadata, claim, args = self.west_case()
        args["document_receipt"] = None
        with self.assertRaises(BindingError): bind_claim(metadata, claim, **args)

    def test_tampered_document_bytes_fail_both_sources(self):
        for case in (self.west_case, self.asia_case):
            with self.subTest(source=case.__name__):
                metadata, claim, args = case()
                args["document_bytes"] += b"SYNTHETIC TAMPER"
                with self.assertRaises(BindingError): bind_claim(metadata, claim, **args)

    def test_shape_valid_wrong_identity_url_or_document_id_is_rejected(self):
        for case in (self.west_case, self.asia_case):
            for field in ("issuer", "document_id", "document_url", "scope", "group"):
                with self.subTest(source=case.__name__, field=field):
                    metadata, claim, args = case()
                    if field == "issuer": claim["entity"]["id"] = "issuer:unrelated"
                    elif field == "scope": claim["entity"]["scope"] = "project"
                    elif field == "group": claim["entity"]["consolidation_group_id"] = "group:unsupported"
                    elif field == "document_id": claim["provenance"][field] = "document:unrelated"
                    else: claim["provenance"][field] = "https://www.sec.gov/unrelated-document"
                    with self.assertRaises(BindingError): bind_claim(metadata, claim, **args)

    def test_document_receipt_failure_or_mismatch_blocks_binding(self):
        changes = {"http_status": 403, "sha256": "0" * 64,
                   "final_url": "https://www.sec.gov/unrelated-document",
                   "requested_url": "https://www.sec.gov/unrelated-document",
                   "retrieved_at": "2026-11-17T17:00:00Z"}
        for case in (self.west_case, self.asia_case):
            for field, value in changes.items():
                with self.subTest(source=case.__name__, field=field):
                    metadata, claim, args = case()
                    args["document_receipt"][field] = value
                    with self.assertRaises(BindingError): bind_claim(metadata, claim, **args)

    def test_normalized_metadata_cannot_upgrade_itself_to_verified_or_publishable(self):
        for case in (self.west_case, self.asia_case):
            metadata, claim, args = case()
            for field, value in (("status", "VERIFIED"), ("schema", "unrecognized"),
                                 ("publishable" if args["source_kind"] == "asia" else "eligible_for_publication", True)):
                with self.subTest(source=case.__name__, field=field):
                    altered = deepcopy(metadata); altered[field] = value
                    with self.assertRaises(BindingError): bind_claim(altered, claim, **args)

    def test_west_submissions_payload_cannot_be_substituted_for_document(self):
        metadata, claim, args = self.west_case()
        raw, _, _ = synthetic_inputs()
        args["document_bytes"] = raw
        digest = hashlib.sha256(raw).hexdigest()
        args["document_receipt"]["sha256"] = digest
        claim["provenance"]["sha256"] = digest
        with self.assertRaisesRegex(BindingError, "Submissions bytes"):
            bind_claim(metadata, claim, **args)

    def test_west_selection_is_explicit_unique_and_not_matched_by_filename(self):
        metadata, claim, args = self.west_case()
        for selection in (None, "sec:missing", metadata["filings"][1]["filing_id"]):
            with self.subTest(selection=selection):
                changed = dict(args, filing_id=selection)
                with self.assertRaises(BindingError): bind_claim(metadata, claim, **changed)
        metadata["filings"].append(deepcopy(metadata["filings"][0]))
        with self.assertRaises(BindingError): bind_claim(metadata, claim, **args)

    def test_asia_original_receipt_mismatch_cannot_be_overridden(self):
        metadata, claim, args = self.asia_case()
        metadata["receipt"]["sha256"] = "0" * 64
        with self.assertRaises(BindingError): bind_claim(metadata, claim, **args)

    def test_equivalent_retrieval_timezone_keeps_same_instant(self):
        metadata, claim, args = self.asia_case()
        claim["provenance"]["retrieved_at"] = "2026-11-16T20:00:00+08:00"
        result = bind_claim(metadata, claim, **args)
        self.assertEqual(result["document_receipt"]["retrieved_at"], "2026-11-16T12:00:00Z")
        self.assertEqual(result["claim"]["provenance"]["retrieved_at"], "2026-11-16T20:00:00+08:00")

    def test_binding_is_not_numerical_extraction_or_semantic_verification(self):
        metadata, claim, args = self.asia_case()
        claim["value"] = "999.00"  # Deliberately unsupported fixture assertion.
        result = bind_claim(metadata, claim, **args)
        self.assertNotIn(b"999.00", args["document_bytes"])
        self.assertEqual(result["claim"]["value"], "999.00")
        self.assertIn("claim_semantics_not_verified", result["hold_reasons"])
        self.assertFalse(result["independently_verified"])
        self.assertFalse(result["publishable"])


if __name__ == "__main__":
    unittest.main()
