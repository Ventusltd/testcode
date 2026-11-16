"""Agent 11 offline adversarial tests: synthetic inputs, never publisher proof."""
import copy
import csv
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))
from engine import (EvidenceError, asset_key, build, evidence_note, match,
                    select_solar, source_queries)

TODAY = date(2026, 11, 16)
ROW = {
    "Ref ID": "13899", "Site Name": "Feed Millakin - Solar Panels",
    "Technology Type": "Solar Photovoltaics",
    "Operator (or Applicant)": "Mowi Scotland Limited",
    "County": "Highland", "Planning Authority": "Highland",
    "Planning Application Reference": "23/02112/FUL",
    "Development Status": "Planning Permission Granted",
    "Development Status (short)": "Awaiting Construction",
}
E = {
    "repd_ref": "13899", "site_name": "Feed Millakin - Solar Panels",
    "county": "Highland", "planning_authority": "Highland",
    "planning_reference": "23/02112/FUL",
    "source_url": "https://www.plottr.co.uk/renewables/highland",
    "publisher": "Plottr", "publisher_owner": "",
    "event_type": "consent_granted", "event_date": "2023-07-18",
    "published_date": None, "fetched_date": "2026-11-16",
    "first_seen_date": "2026-11-16", "rights_basis": "unknown",
}

class EvidenceTests(unittest.TestCase):
    def test_identity_strong(self):
        self.assertEqual(match(ROW, E)[0], "strong_identity_candidate")

    def test_note_remains_candidate(self):
        note, error = evidence_note(ROW, E, TODAY)
        self.assertIsNone(error)
        self.assertEqual(note["verification"], "candidate_requires_independent_review")
        self.assertEqual(note["source_independence"], "unverified")
        self.assertEqual(note["rights_basis"], "unknown")
        self.assertEqual(note["event_date"], "2023-07-18")
        self.assertEqual(note["fetched_date"], "2026-11-16")
        self.assertEqual(note["first_seen_date"], "2026-11-16")
        self.assertIsNone(note["published_date"])
        self.assertEqual(note["asset_key"], "repd|desnz-repd|2026q3|13899")
        self.assertEqual(note["relation_to_official"],
                         "corroborates_existing_official_status")
        self.assertTrue(note["brief"].startswith("CANDIDATE"))
        self.assertNotIn("Operational", note["brief"])

    def test_later_refusal_never_rewrites_official_status(self):
        row = dict(ROW, **{"Record Last Updated (dd/mm/yyyy)": "15/10/2026"})
        event = dict(E, event_type="consent_refused", event_date="2026-11-10")
        note, error = evidence_note(row, event, TODAY)
        self.assertIsNone(error)
        self.assertEqual(note["relation_to_official"],
                         "possible_newer_milestone_unverified")
        self.assertEqual(row["Development Status"], "Planning Permission Granted")
        self.assertEqual(note["verification"], "candidate_requires_independent_review")

    def test_negative_identity_mutations(self):
        cases = [
            ({"repd_ref": "13898"}, "wrong_repd_id"),
            ({"site_name": "Hawthorne Cottage"}, "project_name_conflict"),
            ({"site_name": "Random Solar Farm"}, "project_name_conflict"),
            ({"planning_authority": "Wakefield"}, "authority_conflict"),
            ({"planning_authority": "York"}, "authority_conflict"),
            ({"county": "North Yorkshire"}, "county_conflict"),
            ({"planning_reference": "23/02112/OUT"}, "planning_reference_conflict"),
            ({"site_name": "Panels"}, "project_name_conflict"),
            ({"site_name": ""}, "project_name_conflict"),
        ]
        for changes, expected in cases:
            with self.subTest(changes=changes):
                e = dict(E, **changes)
                self.assertEqual(match(ROW, e)[1], expected)

    def test_missing_planning_reference_downgrades_to_possible(self):
        for change in ({"planning_reference": ""}, {"planning_authority": ""}):
            self.assertEqual(match(ROW, dict(E, **change))[0], "possible_identity_candidate")

    def test_negative_receipt_mutations(self):
        cases = [
            ({"source_url": "http://www.plottr.co.uk/a"}, "unsafe_url"),
            ({"source_url": "javascript:alert(1)"}, "unsafe_url"),
            ({"source_url": "https://localhost/a"}, "unsafe_url"),
            ({"source_url": "https://127.0.0.1/a"}, "unsafe_url"),
            ({"source_url": "https://reader.invalid/a"}, "unsafe_url"),
            ({"source_url": "https://username:password@example.com/a"}, "unsafe_url"),
            ({"source_url": "https://example.com/\nspoof"}, "unsafe_url"),
            ({"source_url": ""}, "unsafe_url"),
            ({"publisher": ""}, "missing_publisher"),
            ({"publisher": "X" * 200}, "missing_publisher"),
            ({"event_type": "grid_live_confirmed_forever"}, "unapproved_event_type"),
            ({"event_date": "2026-12-30"}, "future_dated_claim"),
            ({"event_date": "18/07/2023"}, "ambiguous_or_missing_date"),
            ({"event_date": "2023-02-30"}, "invalid_date"),
            ({"event_date": None}, "ambiguous_or_missing_date"),
            ({"published_date": "2027-01-01"}, "future_dated_claim"),
            ({"fetched_date": "2027-01-01"}, "future_dated_claim"),
            ({"first_seen_date": "2027-01-01"}, "future_dated_claim"),
            ({"published_date": "2026-11-16", "fetched_date": "2026-11-15", "first_seen_date": "2026-11-15"}, "publication_after_fetch"),
            ({"first_seen_date": "2026-11-16", "fetched_date": "2026-11-15"}, "first_seen_after_fetched"),
            ({"review_state": "verified"}, "self_declared_verification"),
            ({"review_state": "approved"}, "self_declared_verification"),
            ({"rights_basis": "CC-BY"}, "self_declared_rights"),
            ({"rights_basis": "OGL"}, "self_declared_rights"),
            ({"original_receipt_sha256": "a" * 64}, "unverified_receipt_hash"),
        ]
        for changes, expected in cases:
            with self.subTest(changes=changes):
                note, error = evidence_note(ROW, dict(E, **changes), TODAY)
                self.assertIsNone(note)
                self.assertEqual(error, expected)

    def test_fallback_and_no_mutation(self):
        original = copy.deepcopy(ROW)
        notes, reasons, queue = build([ROW], [], TODAY)
        self.assertEqual(ROW, original)
        self.assertEqual(notes[0]["machine_note_state"], "no_external_evidence")
        self.assertEqual(notes[0]["headline"], "No independent evidence found")
        self.assertEqual(notes[0]["official_status"], ROW["Development Status"])
        self.assertEqual(len(queue), 1)
        self.assertEqual(len(queue[0]["queries"]), 3)
        self.assertEqual(reasons, {})

    def test_dedupe_source_event_but_not_other_events(self):
        other = dict(E, event_type="construction_started", event_date="2024-01-01")
        notes, rejection, queue = build([ROW], [E, E, other], TODAY)
        self.assertEqual(len(notes[0]["remarks"]), 2)
        self.assertEqual(queue, [])
        self.assertEqual(rejection, {})

    def test_invalid_claim_rejected_not_fallback_promoted(self):
        wrong = dict(E, planning_authority="Wakefield")
        notes, reasons, queue = build([ROW], [wrong], TODAY)
        self.assertEqual(notes[0]["machine_note_state"], "no_external_evidence")
        self.assertEqual(reasons["authority_conflict"], 1)
        self.assertEqual(len(queue), 1)

    def test_selection_follows_csv_order_not_ref_sort(self):
        a = dict(ROW)
        b = dict(ROW, **{"Ref ID": "2", "Site Name": "Kirkton Solar"})
        c = dict(ROW, **{"Ref ID": "7777", "Technology Type": "Battery"})
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "frozen.csv"
            with p.open("w", encoding="utf-8", newline="") as f:
                w = csv.DictWriter(f, fieldnames=list(ROW))
                w.writeheader()
                w.writerows([a, c, b])
            original = p.read_bytes()
            result, info = select_solar(p, 2)
            self.assertEqual([x["Ref ID"] for x in result], ["13899", "2"])
            self.assertEqual(info["solar_rows"], 2)
            self.assertEqual(info["all_csv_rows"], 3)
            self.assertEqual(p.read_bytes(), original)

    def test_duplicate_and_missing_ids_fail(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "bad.csv"
            for rows in ([ROW, ROW], [ROW, dict(ROW, **{"Ref ID": "NA"})]):
                with p.open("w", newline="") as f:
                    w = csv.DictWriter(f, fieldnames=list(ROW))
                    w.writeheader()
                    w.writerows(rows)
                with self.assertRaises(EvidenceError):
                    select_solar(p, 1)

    def test_plan_always_contains_scoped_queries(self):
        qs = source_queries(ROW)
        self.assertTrue("23/02112/FUL" in qs[0]["query"])
        self.assertTrue("Highland" in qs[0]["query"])
        self.assertTrue(all(x["search_url"].startswith("https://") for x in qs))

if __name__ == "__main__":
    unittest.main()
