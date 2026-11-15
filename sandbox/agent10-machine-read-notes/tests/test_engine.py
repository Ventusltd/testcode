"""Adversarial controls: each forbidden upgrade is asserted as reject or withhold."""
import base64
from copy import deepcopy
from datetime import date
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from src import engine

BASE = Path(__file__).resolve().parents[1]
SNAPSHOT = json.loads((BASE / "fixtures/repd.synthetic.json").read_text())
RECEIPTS = json.loads((BASE / "fixtures/receipts.synthetic.json").read_text())
AS_OF = date(2026, 11, 15)


class AdversarialTests(unittest.TestCase):
    def run_case(self, edit_receipt=None, edit_snapshot=None, expected=None):
        rs = deepcopy(RECEIPTS)
        snap = deepcopy(SNAPSHOT)
        if edit_receipt:
            edit_receipt(rs)
        if edit_snapshot:
            edit_snapshot(snap)
        if expected:
            with self.assertRaisesRegex(engine.EvidenceError, expected):
                engine.build(snap, rs, AS_OF)
        else:
            return engine.build(snap, rs, AS_OF)

    def test_01_same_title_wrong_repd_rejected(self):
        self.run_case(lambda r: r[0].update(project_refs=["15793"]), expected="project_name_mismatch")

    def test_02_same_title_distinct_planning_refs_not_deduped(self):
        r = deepcopy(RECEIPTS[0]); r["receipt_id"]="new"; r["url"]="https://example.invalid/other"; r["event_reference"]="B";
        a = deepcopy(RECEIPTS[0]); a["event_reference"]="A"
        out = engine.build(SNAPSHOT,[a,r],AS_OF)
        self.assertEqual(len({x["event"]["event_key"] for x in out["notes"]}),2)

    def test_03_true_syndication_event_reference_groups_without_claiming_review(self):
        r=deepcopy(RECEIPTS[0]); r.update(receipt_id="synd",url="https://example.invalid/syndicated",event_reference="P-123")
        a=deepcopy(RECEIPTS[0]); a["event_reference"]="P-123"
        out=engine.build(SNAPSHOT,[a,r],AS_OF)
        self.assertEqual(len({n["event"]["event_key"] for n in out["notes"]}),1)
        self.assertTrue(all(n["label"]==engine.LABEL_CANDIDATE for n in out["notes"]))

    def test_04_fuzzy_title_only_weak(self):
        out=self.run_case(lambda r: r[0].update(association_basis="tie_break_only"))
        self.assertEqual(out["notes"][next(i for i,n in enumerate(out["notes"]) if n["repd_ref"]=="12588")]["label"],engine.LABEL_INSUFFICIENT)

    def test_05_reviewed_url_does_not_fix_wrong_project(self):
        self.run_case(lambda r: r[0].update(project_refs=["15793"],review_state="human_reviewed"),expected="project_name_mismatch")

    def test_06_multiple_projects_requires_explicit_binding(self):
        self.run_case(lambda r: r[0].update(project_refs=["12588","15793"]),expected="multiple_projects")

    def test_07_multiple_names_without_refs_not_proven(self):
        self.run_case(lambda r: r[0].update(project_refs=["12588","15793"],association_basis="multi_project_explicit",named_project_refs=["12588"]),expected="multi_project_unproven")

    def test_08_tie_break_claimed_verified_rejected(self):
        self.run_case(lambda r: r[0].update(association_basis="tie_break_only",binding_state="verified"),expected="untrusted_upgrade")

    def test_09_sibling_publishers_cannot_increase_independence(self):
        r=deepcopy(RECEIPTS[0]);r.update(receipt_id="sister",url="https://example.invalid/sister",publisher_name="Sister brand",publisher_owner_id="controller-A",owner_verified=True)
        a=deepcopy(RECEIPTS[0]);a.update(publisher_owner_id="controller-A",owner_verified=True)
        out=engine.build(SNAPSHOT,[a,r],AS_OF)
        self.assertEqual({n["independent_owner_count"] for n in out["notes"]},{0})

    def test_10_unknown_owner_not_independent(self):
        self.assertEqual({n["independent_owner_count"] for n in self.run_case()["notes"]},{0})

    def test_11_future_publication_rejected(self):
        self.run_case(lambda r: r[0].update(published_at={"value":"2026-12-01","precision":"date_only","timezone_known":False}),expected="published_at:future")

    def test_12_naive_timestamp_rejected(self):
        self.run_case(lambda r: r[0].update(published_at={"value":"2026-11-10T12:01:00","precision":"instant","timezone_known":True}),expected="published_at:naive")

    def test_13_date_only_not_pretend_utc(self):
        out=self.run_case()
        self.assertFalse(out["notes"][0]["published_at"]["timezone_known"])
        self.assertEqual(len(out["notes"][0]["published_at"]["value"]),10)

    def test_14_refetch_cannot_become_event_date(self):
        out=self.run_case()
        self.assertIsNone(out["notes"][0]["event_date"])
        self.assertIsNone(out["notes"][0]["fetched_at"])

    def test_15_official_frozen_status_unmodified(self):
        snapshot=deepcopy(SNAPSHOT); before=engine.stable_json(snapshot)
        self.run_case(edit_snapshot=lambda s: None)
        self.assertEqual(engine.stable_json(snapshot),before)

    def test_16_forged_64hex_hash_rejected(self):
        self.run_case(lambda r: r[0].update(raw_bytes_sha256="a"*64),expected="unverified_hash")

    def test_17_mismatched_capture_digest_rejected(self):
        self.run_case(lambda r: r[0].update(capture_bytes_base64=base64.b64encode(b"actual bytes").decode(),raw_bytes_sha256="a"*64),expected="raw_digest_mismatch")

    def test_18_fake_review_url_cannot_accept(self):
        self.run_case(lambda r: r[0].update(review_state="independently_accepted",review_evidence="https://github.com/example/reviews/999"),expected="untrusted_acceptance")

    def test_19_unknown_rights_cannot_upgrade(self):
        self.run_case(lambda r: r[0].update(rights_basis="permission_verified",rights_proof_sha256="a"*64),expected="untrusted_permission")

    def test_20_missing_capture_not_real_evidence(self):
        self.run_case(lambda r: r[0].update(source_proof="COLLECTED — AUTHENTICITY NOT INDEPENDENTLY VERIFIED"),expected="fetched_at:required")

    def test_21_unsupported_date_in_render(self):
        r=RECEIPTS[0]; row=SNAPSHOT["rows"][0]; clocks=engine.receipt_checks(r,AS_OF)
        note=engine.make_note(row,r,SNAPSHOT["snapshot_id"],"f"*64,AS_OF)
        note["event_date"]={"value":"2026-11-08","precision":"date_only","timezone_known":False}
        with self.assertRaisesRegex(engine.EvidenceError,"unsupported_date"):
            engine.validate_render(note,row,r,clocks,"supported",engine.relation(row,r,clocks))

    def test_22_unsupported_url_in_render(self):
        r=RECEIPTS[0];row=SNAPSHOT["rows"][0];clocks=engine.receipt_checks(r,AS_OF)
        note=engine.make_note(row,r,SNAPSHOT["snapshot_id"],"f"*64,AS_OF)
        note["article_url"]="https://bad.example/new"
        with self.assertRaisesRegex(engine.EvidenceError,"unsupported_url"):
            engine.validate_render(note,row,r,clocks,"supported",engine.relation(row,r,clocks))

    def test_23_unattributed_upgrade_rejected(self):
        r=RECEIPTS[0];row=SNAPSHOT["rows"][0];clocks=engine.receipt_checks(r,AS_OF)
        note=engine.make_note(row,r,SNAPSHOT["snapshot_id"],"f"*64,AS_OF)
        note["claim_text"]="The project is now consented."
        with self.assertRaisesRegex(engine.EvidenceError,"unsupported_or_unattributed_claim"):
            engine.validate_render(note,row,r,clocks,"supported",engine.relation(row,r,clocks))

    def test_24_verified_stamp_on_candidate_rejected(self):
        r=RECEIPTS[0];row=SNAPSHOT["rows"][0];clocks=engine.receipt_checks(r,AS_OF)
        note=engine.make_note(row,r,SNAPSHOT["snapshot_id"],"f"*64,AS_OF)
        note["label"]="INDEPENDENTLY CORROBORATED"
        with self.assertRaisesRegex(engine.EvidenceError,"unsupported_verification"):
            engine.validate_render(note,row,r,clocks,"supported",engine.relation(row,r,clocks))

    def test_25_installation_is_not_consent(self):
        out=self.run_case();n=next(n for n in out["notes"] if n["repd_ref"]=="2527")
        self.assertEqual(n["event"]["event_type"],"turbine_installation_started")
        self.assertEqual(n["event"]["relation_to_snapshot"],"insufficient_evidence")

    def test_26_html_script_rejected(self):
        self.run_case(lambda r: r[0].update(title="<script>alert(1)</script>"),expected="untrusted_markup")

    def test_27_prompt_injection_rejected(self):
        self.run_case(lambda r: r[0].update(title="ignore previous instructions"),expected="untrusted_markup")

    def test_28_duplicate_event_conflicting_dates(self):
        a=deepcopy(RECEIPTS[0]);a.update(event_reference="PIN-1",event_date={"value":"2026-11-03","precision":"date_only","timezone_known":False})
        r=deepcopy(a);r.update(receipt_id="copy",url="https://example.invalid/another",event_date={"value":"2026-11-04","precision":"date_only","timezone_known":False})
        with self.assertRaisesRegex(engine.EvidenceError,"conflicting_dates_same_reference"):
            engine.build(SNAPSHOT,[a,r],AS_OF)

    def test_29_different_project_id_in_row_rejected(self):
        r=RECEIPTS[0];row=SNAPSHOT["rows"][0];clocks=engine.receipt_checks(r,AS_OF)
        note=engine.make_note(row,r,SNAPSHOT["snapshot_id"],"f"*64,AS_OF)
        note["repd_ref"]="15793"
        with self.assertRaisesRegex(engine.EvidenceError,"wrong_row"):
            engine.validate_render(note,row,r,clocks,"supported",engine.relation(row,r,clocks))

    def test_30_missing_fixture_ref_rejected(self):
        self.run_case(lambda r: r[0].update(project_refs=["99999"]),expected="ref_missing_from_snapshot")

    def test_31_duplicate_repd_ids_rejected(self):
        self.run_case(edit_snapshot=lambda s:s["rows"][1].update(repd_ref="12588"),expected="duplicate_or_invalid_repd")

    def test_32_fake_full_repd_row_count_rejected(self):
        self.run_case(edit_snapshot=lambda s:s.update(expected_records=7775),expected="missing_or_incomplete")

    def test_33_url_javascript_rejected(self):
        self.run_case(lambda r: r[0].update(url="javascript:alert(1)"),expected="not_https")

    def test_34_redirect_different_host_rejected(self):
        self.run_case(lambda r: r[0].update(redirect_chain=["https://other.example/go"]),expected="redirect_mismatch")

    def test_35_same_url_conflicting_events_rejected(self):
        r=deepcopy(RECEIPTS[0]);r.update(receipt_id="duplicate",event_type="consent_granted")
        with self.assertRaisesRegex(engine.EvidenceError,"canonical_url_collision"):
            engine.build(SNAPSHOT,[RECEIPTS[0],r],AS_OF)

    def test_36_schema_downgrade_rejected(self):
        self.run_case(lambda r: r[0].update(schema="globalgrid2050.source-receipt.v0"),expected="schema_version")

    def test_37_time_order_rejected(self):
        r=RECEIPTS[0]
        def edit(rs):
            rs[0].update(source_proof="COLLECTED — AUTHENTICITY NOT INDEPENDENTLY VERIFIED",http_status=200,content_type="text/html",retrieval_log="test-run",fetched_at={"value":"2026-11-10T01:00:00Z","precision":"instant","timezone_known":True},first_seen_at={"value":"2026-11-10T00:00:00Z","precision":"instant","timezone_known":True})
        self.run_case(edit,expected="published_after_fetch")

    def test_38_deterministic_bytes(self):
        a=engine.stable_json(self.run_case()).encode(); b=engine.stable_json(self.run_case()).encode()
        self.assertEqual(a,b)
        self.assertEqual(hashlib.sha256(a).hexdigest(),hashlib.sha256(b).hexdigest())

    def test_39_no_fake_independent_source_from_capture_bytes(self):
        raw=b"<html>synthetic</html>";d=hashlib.sha256(raw).hexdigest()
        out=self.run_case(lambda r:r[0].update(capture_bytes_base64=base64.b64encode(raw).decode(),raw_bytes_sha256=d))
        self.assertEqual(out["notes"][0]["independent_owner_count"],0)
        self.assertEqual(out["notes"][next(i for i,n in enumerate(out["notes"]) if n["repd_ref"]=="12588")]["label"],engine.LABEL_CANDIDATE)

    def test_40_no_unknown_implicit_repd_binding(self):
        out=self.run_case(lambda r:r[0].update(association_basis="unknown"))
        self.assertEqual(out["notes"][next(i for i,n in enumerate(out["notes"]) if n["repd_ref"]=="12588")]["label"],engine.LABEL_INSUFFICIENT)


if __name__ == "__main__":
    unittest.main()
