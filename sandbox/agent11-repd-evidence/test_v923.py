"""Agent 11 V9.23 offline corpus, negative controls and pilot tests."""
import json
import tempfile
import unittest
from pathlib import Path

from engine import EvidenceError
from v923 import (load_pinned, build_output, select_pilot, score,
                  adapt, load_feed, load_attempts, key)

def synthetic_v923(tmp):
    """A SYNTHETIC shape-only dataset, not a DESNZ original or article receipt."""
    solar = list(range(1018, 2017)) + [2325] + list(range(3000, 5604))
    others = list(range(7000, 11171))
    assert len(solar) == 3604 and len(others) == 4171
    def row(i, solar=True):
        return {
            "repd_ref": str(i),
            "repd_technology": "Solar Photovoltaics" if solar else "Battery",
            "name": f"Test Farm {i}" if solar else f"Test Battery {i}",
            "capacity_mw": 4.0 if i % 2 else 40.0,
            "status": ["Operational", "Revised", "Application Refused",
                       "Awaiting Construction", "Under Construction",
                       "Application Withdrawn", "Appeal Refused",
                       "Planning Permission Expired", "Abandoned"][i % 9],
            "operator": f"Test Operator {i}",
            "planning_authority": f"District {i % 41}",
            "planning_application_reference": f"20/{i}/FUL",
            "county": f"County {i % 40}",
            "repd_record_updated": "2026-10-01"
        }
    values = [row(i) for i in solar] + [row(i, False) for i in others]
    values.reverse()  # source file intentionally not numeric order
    for j in range(16):
        batch = values[j*500:(j+1)*500]
        (tmp / f"part-{j+1:03d}.json").write_text(
            json.dumps({"partition": j+1, "record_count": len(batch),
                        "projects": batch, "schema": "test"}), encoding="utf-8")

class V923Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.td = tempfile.TemporaryDirectory()
        cls.path = Path(cls.td.name)
        synthetic_v923(cls.path)
        cls.rows, cls.hashes, cls.parts, cls.sha = load_pinned(cls.path)
    @classmethod
    def tearDownClass(cls):
        cls.td.cleanup()

    def test_numerical_ids_not_file_order(self):
        ids = [int(r["repd_ref"]) for r in self.rows]
        self.assertEqual((ids[0], ids[-1]), (1018, 2325))
        self.assertEqual(len(ids), 1000)
        self.assertEqual(ids, sorted(ids))
        self.assertNotEqual(self.rows[0]["repd_ref"], "5603")

    def test_hashes_and_determinism(self):
        self.assertEqual(self.sha, load_pinned(self.path)[-1])
        self.assertEqual(self.hashes, load_pinned(self.path)[1])
        self.assertEqual(len(self.parts), 16)
        self.assertEqual(len(self.hashes), 7775)
        self.assertEqual(len(set(self.hashes.values())), 7775)

    def test_25_representative_pilot_reproducible(self):
        p = select_pilot(self.rows, 25)
        self.assertEqual(p, select_pilot(self.rows, 25))
        self.assertEqual(len(p), len({r["repd_ref"] for r in p}))
        self.assertGreaterEqual(len({r["status"] for r in p}), 7)
        self.assertGreaterEqual(len({r["planning_authority"] for r in p}), 6)

    def test_full_1000_fallback_is_not_false_research(self):
        manifest, notes, queue, audit = build_output(
            self.rows, self.hashes, self.parts, self.sha,
            {"status": "ok", "native_possible_matches": ["12588", "2527", "15793"]})
        self.assertEqual(audit["native_v923_possible_matches_total"], 3)
        self.assertEqual(audit["native_v923_possible_matches_in_sample"], 0)
        self.assertEqual(audit["not_researched"], 1000)
        self.assertEqual(audit["researched"], 0)
        self.assertEqual(audit["independently_sourced"], 0)
        self.assertEqual(audit["display_rows_with_honest_state_pct"], 100)
        self.assertEqual(len(queue), 1000)
        self.assertEqual(len(manifest["row_sha256"]), 1000)
        self.assertEqual(len(notes), 1000)
        self.assertFalse(audit["publication_authorised"])
        self.assertTrue(all(n["headline"] == "Independent research not yet attempted."
                            for n in notes))

    def test_attempt_only_marked_after_log(self):
        r = self.rows[0]["repd_ref"]
        m, ledger, q, a = build_output(
            self.rows, self.hashes, self.parts, self.sha, {},
            {r: {"state": "attempted_no_source", "attempted_at": "2026-11-16"}})
        self.assertEqual(ledger[0]["headline"], "No independent evidence found; research attempted.")
        self.assertEqual(a["no_source"], 1)
        self.assertEqual(a["not_researched"], 999)

    def test_blocked_does_not_become_news(self):
        r = self.rows[0]["repd_ref"]
        *_, a = build_output(
            self.rows, self.hashes, self.parts, self.sha, {},
            {r: {"state": "blocked", "attempted_at": "2026-11-16"}})
        self.assertEqual(a["blocked"], 1)
        self.assertEqual(a["candidate"], 0)

    def test_score_transparency(self):
        r = dict(self.rows[0], capacity_mw=500, status="Under Construction")
        s = score(r)
        self.assertEqual(s["capacity_points"], 30)
        self.assertEqual(s["possible_electrical_work_points"], 10)
        self.assertEqual(s["recency_points"], 0)

    def test_counterfeit_matches_rejected(self):
        r = self.rows[0]
        good = {"repd_ref": r["repd_ref"], "site_name": r["name"],
                "county": r["county"], "planning_authority": r["planning_authority"],
                "planning_reference": r["planning_application_reference"],
                "publisher": "Synthetic publisher", "source_url": "https://example.org/test",
                "event_date": "2025-05-05", "event_type": "consent_granted"}
        m, l, q, a = build_output(self.rows, self.hashes, self.parts,
                                   self.sha, {}, evidence=[good])
        self.assertEqual(a["candidate"], 1)
        self.assertEqual(a["independently_sourced"], 0)
        self.assertEqual(l[0]["research_state"], "candidate")
        self.assertIn("CANDIDATE", l[0]["headline"])
        bad = dict(good, planning_authority="Other County")
        m, l, q, a = build_output(self.rows, self.hashes, self.parts, self.sha, {},
                                   evidence=[bad])
        self.assertEqual(a["candidate"], 0)
        self.assertEqual(a["rejections"].get("authority_conflict"), 1)

    def test_negative_50_collision_replay(self):
        r = self.rows[0]
        for n in range(50):
            with self.subTest(control=n):
                candidate = {
                    "repd_ref": r["repd_ref"], "site_name": r["name"],
                    "planning_authority": f"Wrong district {n}",
                    "planning_reference": r["planning_application_reference"],
                    "county": r["county"], "publisher": "Fake",
                    "source_url": "https://example.org/legit-appearing",
                    "event_date": "2025-05-05", "event_type": "consent_granted"}
                from engine import evidence_note
                note, reason = evidence_note(adapt(r), candidate,
                                              __import__("datetime").date(2026, 11, 16))
                self.assertIsNone(note)
                self.assertEqual(reason, "authority_conflict")

    def test_fails_closed_on_corrupt_part(self):
        original = (self.path / "part-001.json").read_bytes()
        try:
            doc = json.loads(original)
            doc["record_count"] = 499
            (self.path / "part-001.json").write_text(json.dumps(doc))
            with self.assertRaises(EvidenceError):
                load_pinned(self.path)
        finally:
            (self.path / "part-001.json").write_bytes(original)

    def test_feed_schema_fail_closed(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)/"feed.json"
            p.write_text(json.dumps({"schema": "fake", "items": []}))
            with self.assertRaises(EvidenceError):
                load_feed(p)

    def test_undated_and_duplicate_attempts_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)/"attempts.jsonl"
            p.write_text('{"repd_ref":"1018","state":"blocked","attempted_at":"2026-11-16"}\n' * 2)
            with self.assertRaises(EvidenceError):
                load_attempts(p, {"1018"})
            p.write_text('{"repd_ref":"1018","state":"verified","attempted_at":"2026-11-16"}\n')
            with self.assertRaises(EvidenceError):
                load_attempts(p, {"1018"})

if __name__ == "__main__":
    unittest.main()
