"""Offline wire-consumer scenarios using explicitly synthetic figure claims.

These are API integration examples, not verified source data. A validated claim
has not earned source rights, factual acceptance, summation or release approval.
The loader checks pinned producer bytes before any scenario executes.
"""

from copy import deepcopy
import json
import unittest

from lab_support import load_component


def synthetic_claim():
    """No fixture URL, ID, digest or amount describes a real filing/project."""
    return {
        "schema": "globalgrid2050.filing-figure.v1",
        "claim_id": "fixture:claim:original",
        "status": "machine-provisional",
        "quantity_kind": "finance",
        "metric": "Synthetic capital expenditure",
        "value": "1.20",
        "scale": "1e9",
        "unit": "currency",
        "original_unit": "billion US dollars",
        "currency": "USD",
        "finance_stage": "announced",
        "entity": {
            "scope": "consolidated_group",
            "id": "fixture:group:parent",
            "consolidation_group_id": "fixture:group:parent",
            "identity_evidence_url": "https://www.sec.gov/synthetic-fixture-identity",
        },
        "reporting_period": {"start": "2026-01", "end": "2026-09"},
        "as_of": "2026-09-30",
        "basis": "reported",
        "assurance": "unknown",
        "provenance": {
            "document_id": "fixture:document:one",
            "document_url": "https://www.sec.gov/synthetic-fixture-document",
            "sha256": "a" * 64,
            "page": "12",
            "section": "Synthetic capital expenditure",
            "published_date": "2026-10-01",
            "retrieved_at": "2026-11-16T12:00:00Z",
        },
        "revision": {
            "id": "original",
            "supersedes_claim_id": None,
            "restated": False,
        },
    }


class FiguresWireConsumerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.figures = load_component("figures")

    def round_trip(self, input_claim):
        # Deliberately cross JSON boundaries in both directions, as a consumer
        # does. This helper neither transforms quantities nor chooses revisions.
        incoming = json.loads(json.dumps(input_claim, ensure_ascii=False, allow_nan=False))
        validated = self.figures.validate_claim(incoming)
        return json.loads(self.figures.dumps_claim(validated))

    def test_large_exact_signed_decimal_and_scale_survive_wire(self):
        claim = synthetic_claim()
        claim.update(value="-90071992547409931234567890.00100", scale="1e6",
                     metric="Synthetic reported net cash flow", finance_stage="reported")
        received = self.round_trip(claim)
        self.assertEqual(received["value"], "-90071992547409931234567890.00100")
        self.assertIsInstance(received["value"], str)
        self.assertEqual(received["scale"], "1e6")
        self.assertEqual(received["status"], "machine-provisional")
        # An upstream numeric JSON coercion must not silently become accepted.
        claim["value"] = -90071992547409931234567890.00100
        with self.assertRaises(self.figures.ClaimValidationError):
            self.round_trip(claim)

    def test_announced_committed_disbursed_finance_remain_separate(self):
        received = []
        for stage in ("announced", "committed", "disbursed"):
            claim = synthetic_claim()
            claim.update(claim_id=f"fixture:finance:{stage}", finance_stage=stage)
            received.append(self.round_trip(claim))
        self.assertEqual([c["finance_stage"] for c in received],
                         ["announced", "committed", "disbursed"])
        self.assertEqual(len({c["claim_id"] for c in received}), 3)
        self.assertEqual({c["status"] for c in received}, {"machine-provisional"})
        # These separate records are not summed and the first two are not paid.
        self.assertEqual([c["value"] for c in received], ["1.20", "1.20", "1.20"])

    def test_group_total_and_site_claim_keep_distinct_scopes(self):
        group = synthetic_claim()
        site = deepcopy(group)
        site["claim_id"] = "fixture:claim:site"
        site["entity"].update(scope="site", id="fixture:site:one")
        site["value"] = "0.10"
        original_group, original_site = deepcopy(group), deepcopy(site)
        received = [self.round_trip(group), self.round_trip(site)]
        self.assertEqual([c["entity"]["scope"] for c in received], ["consolidated_group", "site"])
        self.assertEqual([c["entity"]["id"] for c in received],
                         ["fixture:group:parent", "fixture:site:one"])
        self.assertEqual({c["entity"]["consolidation_group_id"] for c in received},
                         {"fixture:group:parent"})
        self.assertEqual([c["value"] for c in received], ["1.20", "0.10"])
        self.assertEqual((group, site), (original_group, original_site))
        # The shared group identity signals potential overlap; neither record
        # grants a consumer permission to add them or allocate group value/site.

    def test_demand_secured_connection_and_energised_load_not_equated(self):
        kinds = ["project_demand", "secured_connection", "energised_load"]
        received = []
        for kind, amount in zip(kinds, ("480.00", "120.00", "15.00")):
            claim = synthetic_claim()
            claim.update(claim_id=f"fixture:physical:{kind}", quantity_kind=kind,
                         metric=f"Synthetic source-stated {kind}", value=amount,
                         unit="MW", original_unit="MW", scale="1",
                         currency=None, finance_stage=None)
            claim["entity"].update(scope="project", id="fixture:project:one",
                                   consolidation_group_id=None)
            received.append(self.round_trip(claim))
        self.assertEqual([c["quantity_kind"] for c in received], kinds)
        self.assertEqual([c["value"] for c in received], ["480.00", "120.00", "15.00"])
        self.assertEqual({c["status"] for c in received}, {"machine-provisional"})
        self.assertTrue(all(c["currency"] is None for c in received))

    def test_original_clock_precision_and_retrieval_offset_preserved(self):
        claim = synthetic_claim()
        claim["provenance"].update(published_date="2026-11-17",
                                   retrieved_at="2026-11-17T00:30:00+09:00")
        received = self.round_trip(claim)
        self.assertEqual(received["reporting_period"], {"start": "2026-01", "end": "2026-09"})
        self.assertEqual(received["as_of"], "2026-09-30")
        self.assertEqual(received["provenance"]["published_date"], "2026-11-17")
        self.assertEqual(received["provenance"]["retrieved_at"], "2026-11-17T00:30:00+09:00")
        self.assertNotEqual(received["as_of"], received["provenance"]["published_date"])

    def test_forecast_future_target_is_not_reported_or_audited_actual(self):
        claim = synthetic_claim()
        claim.update(reporting_period={"start": "2027", "end": "2029"},
                     as_of="2029", basis="forecast")
        received = self.round_trip(claim)
        self.assertEqual((received["basis"], received["assurance"], received["as_of"]),
                         ("forecast", "unknown", "2029"))
        claim["basis"] = "reported"
        with self.assertRaises(self.figures.ClaimValidationError):
            self.round_trip(claim)
        claim.update(basis="forecast", assurance="audited")
        with self.assertRaises(self.figures.ClaimValidationError):
            self.round_trip(claim)

    def test_restatement_round_trip_retains_history_without_auto_selection(self):
        original = synthetic_claim()
        restatement = deepcopy(original)
        restatement.update(claim_id="fixture:claim:restatement", value="1.19")
        restatement["revision"] = {
            "id": "revision:two", "supersedes_claim_id": original["claim_id"], "restated": True,
        }
        received = [self.round_trip(original), self.round_trip(restatement)]
        self.assertEqual(len(received), 2)
        self.assertEqual(received[1]["revision"]["supersedes_claim_id"], received[0]["claim_id"])
        self.assertEqual([c["value"] for c in received], ["1.20", "1.19"])
        self.assertEqual({c["status"] for c in received}, {"machine-provisional"})
        # Shape validation cannot authorize replacing the source record or
        # selecting a winner. A self-superseding wire record is rejected.
        restatement["revision"]["supersedes_claim_id"] = restatement["claim_id"]
        with self.assertRaises(self.figures.ClaimValidationError):
            self.round_trip(restatement)

    def test_original_multilingual_unit_and_currency_not_converted(self):
        claim = synthetic_claim()
        claim.update(value="123.00", scale="1e6", original_unit="百万円", currency="JPY")
        received = self.round_trip(claim)
        self.assertEqual((received["value"], received["scale"], received["original_unit"], received["currency"]),
                         ("123.00", "1e6", "百万円", "JPY"))
        self.assertNotIn("fx_rate", received)
        self.assertNotIn("converted_value", received)

    def test_unknown_generic_capacity_cannot_be_invented_into_typed_claim(self):
        claim = synthetic_claim()
        claim.update(quantity_kind="generic_capacity", metric="Synthetic ambiguous capacity",
                     unit="MW", original_unit="MW", scale="1", currency=None, finance_stage=None)
        with self.assertRaises(self.figures.ClaimValidationError):
            self.round_trip(claim)
        # The consumer omits unsupported source claims pending evidence; it
        # does not relabel ambiguous capacity as IT load merely to pass.


if __name__ == "__main__":
    unittest.main()
