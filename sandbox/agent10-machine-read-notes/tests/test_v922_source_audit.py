"""Strong negative controls for real-source gate even without network access."""
from pathlib import Path
from tempfile import TemporaryDirectory
import copy
import json
import unittest
from src.engine import EvidenceError
from scripts.audit_v922_source import audit

class V922SourceAudit(unittest.TestCase):
    def setUp(self):
        self.tmp=TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.rows=[{'repd_ref':'12588','project_name':'Demo','technology':'solar','status':'Application Submitted','latitude':None,'longitude':None},
                   {'repd_ref':'2527','project_name':'Demo B','technology':'wind_offshore','status':'Under Construction','latitude':54.2,'longitude':-1.4}]
        self.write()
    def write(self):
        (self.root/'part-001.json').write_text(json.dumps({'schema':'globalgrid2050.v9.project-partition.v9.1','record_count':len(self.rows),'projects':self.rows}))
    def run_audit(self): return audit(self.root,expected_count=2,expected_parts=1)
    def test_accepts_explicit_pinned_fixture_and_does_not_promote_to_original_desnz_verification(self):
        result=self.run_audit()
        self.assertEqual(result['repd_records'],2)
        self.assertEqual(result['source_record_mutations'],0)
        self.assertFalse(result['official_desnz_source_bytes_verified'])
        self.assertEqual(result['map_href_bytes_verified'].split(' — ')[0],'NOT AVAILABLE IN PARTITIONS')
    def test_missing_part_is_fail_closed(self):
        (self.root/'part-001.json').unlink()
        with self.assertRaisesRegex(EvidenceError,'audit:part_count'):self.run_audit()
    def test_missing_register_row_is_fail_closed(self):
        self.rows.pop();self.write()
        with self.assertRaisesRegex(EvidenceError,'audit:total_records'):self.run_audit()
    def test_duplicate_identity_is_fail_closed(self):
        self.rows[1]['repd_ref']='12588';self.write()
        with self.assertRaisesRegex(EvidenceError,'audit:duplicate_repd_ref'):self.run_audit()
    def test_invalid_id_is_fail_closed(self):
        self.rows[1]['repd_ref']='dcuk-123';self.write()
        with self.assertRaisesRegex(EvidenceError,'audit:invalid_repd_ref'):self.run_audit()
    def test_declared_count_disagreement_is_fail_closed(self):
        (self.root/'part-001.json').write_text(json.dumps({'schema':'globalgrid2050.v9.project-partition.v9.1','record_count':10,'projects':self.rows}))
        with self.assertRaisesRegex(EvidenceError,'audit:part_record_count'):self.run_audit()
    def test_incomplete_geometry_fails_not_guess(self):
        self.rows[1]['longitude']=None;self.write()
        with self.assertRaisesRegex(EvidenceError,'geometry:incomplete'):self.run_audit()
    def test_unexpected_part_filename_fails(self):
        (self.root/'part-001.json').rename(self.root/'part-002.json')
        with self.assertRaisesRegex(EvidenceError,'audit:missing_or_ordered_part'):self.run_audit()

if __name__=='__main__':unittest.main()
