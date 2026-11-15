"""Fail-closed V9.23 intelligence/report integration contract (synthetic-only)."""
from __future__ import annotations
from copy import deepcopy
import json
from pathlib import Path
import unittest
from src.adapters.records import RepdAdapter, DataCentreAdapter, asset_key_string, attach_sidecar
from src.compat import adapt_repd, adapt_datacentre, attach_machine_notes, optional_point
from src.engine import EvidenceError, digest

ROOT = Path(__file__).resolve().parents[1]

def fixture(path):
    return json.loads((ROOT / path).read_text())

class AdapterContracts(unittest.TestCase):
    def setUp(self):
        self.dataset = fixture('fullscreen-report/fixtures/projects.synthetic.json')
        self.rows = self.dataset['rows']
        self.side = fixture('fullscreen-report/fixtures/notes.synthetic.json')
        self.rep = RepdAdapter(self.dataset['source_snapshot'])
        self.dc = DataCentreAdapter('202610312133')

    def test_all_three_assets_stable_original_untouched(self):
        before = deepcopy(self.rows); original_sha = digest(before)
        views, audit = attach_sidecar(self.rows, self.side, self.rep)
        self.assertEqual(self.rows, before)
        self.assertEqual(digest(self.rows), original_sha)
        self.assertEqual(audit['source_rows_sha256'], original_sha)
        self.assertEqual(audit['identity_count'], 3)
        self.assertEqual(audit['note_count'], 3)
        self.assertIn('UNVERIFIED', audit['full_7775_audit'])
        self.assertEqual([r['source']['repd_ref'] for r in views], [r['repd_ref'] for r in before])
        self.assertEqual([r['source']['official_status'] for r in views], [r['official_status'] for r in before])

    def test_map_url_byte_for_byte_preserved_including_query_order(self):
        row=deepcopy(self.rows[0]); row['map_href']='https://ventusltd.github.io/gridatlas/atlas/?technology=solar&repd_ref=12588&zoom=12'
        prior=deepcopy(row)
        out=self.rep.adapt(row)
        self.assertEqual(out['map_href'], prior['map_href'])
        self.assertEqual(row, prior)

    def test_no_map_url_missing_coordinates_passed_as_none(self):
        row=deepcopy(self.rows[0]); row.pop('latitude',None);row.pop('longitude',None)
        adapted=self.rep.adapt(row)
        self.assertIsNone(adapted['geometry']);self.assertIsNone(adapted['map_href'])

    def test_geographic_zero_not_missing(self):
        row=deepcopy(self.rows[0]);row['latitude']=0;row['longitude']=0
        self.assertEqual(self.rep.adapt(row)['geometry'],{'latitude':0,'longitude':0})

    def test_datacentre_no_repd_ref_and_loads_separate(self):
        dc=fixture('fullscreen-report/fixtures/datacentre.synthetic.json')
        before=deepcopy(dc);view=self.dc.adapt(dc)
        self.assertEqual(before,dc)
        self.assertEqual(view['identity']['vertical'],'datacentre')
        self.assertEqual(view['identity']['source_record_id'],'dcuk-synthetic-001')
        self.assertNotIn('repd_ref',view)
        self.assertIsNone(view['geometry'])
        self.assertEqual(view['capacity'],{'it_load_mw':50,'grid_connection_mw':None})
        self.assertIsNone(view['map_href'])
        self.assertIn('UNVERIFIED',view['rights_status'])

    def test_no_orphan_note(self):
        bad=deepcopy(self.side);k=next(iter(bad['notes']));bad['notes'][k+'-unknown']=deepcopy(bad['notes'][k])
        with self.assertRaisesRegex(EvidenceError,'sidecar:orphan_note'):attach_sidecar(self.rows,bad,self.rep)

    def test_unknown_rights_not_upgraded(self):
        bad=deepcopy(self.side);next(iter(bad['notes'].values()))['rights_basis']='permission_verified'
        with self.assertRaisesRegex(EvidenceError,'sidecar:unsupported_rights'):attach_sidecar(self.rows,bad,self.rep)

    def test_candidate_must_not_be_accepted(self):
        bad=deepcopy(self.side);next(iter(bad['notes'].values()))['note_state']='independently_accepted'
        with self.assertRaisesRegex(EvidenceError,'sidecar:untrusted_elevation'):attach_sidecar(self.rows,bad,self.rep)

    def test_asset_key_mismatch_rejected(self):
        bad=deepcopy(self.side);next(iter(bad['notes'].values()))['asset_key']['source_record_id']='99999'
        with self.assertRaisesRegex(EvidenceError,'sidecar:note_identity_mismatch'):attach_sidecar(self.rows,bad,self.rep)

    def test_duplicate_register_references_rejected(self):
        with self.assertRaisesRegex(EvidenceError,'sidecar:duplicate_asset'):attach_sidecar(self.rows+[deepcopy(self.rows[0])],self.side,self.rep)

    def test_absent_optional_note_is_allowed(self):
        side=deepcopy(self.side);side['notes'].clear()
        views,audit=attach_sidecar(self.rows,side,self.rep)
        self.assertEqual(audit['note_count'],0)
        self.assertTrue(all(v['machine_note'] is None for v in views))

    def test_datacentre_forged_repd_rejected(self):
        x=fixture('fullscreen-report/fixtures/datacentre.synthetic.json');x['properties']['repd_ref']='12588'
        with self.assertRaisesRegex(EvidenceError,'datacentre:forged_repd'):self.dc.adapt(x)

    def test_datacentre_conflicting_native_id_rejected(self):
        x=fixture('fullscreen-report/fixtures/datacentre.synthetic.json');x['properties']['id']='dcuk-other'
        with self.assertRaisesRegex(EvidenceError,'datacentre:conflicting_ids'):self.dc.adapt(x)

    def test_datacentre_missing_geometry_does_not_create_zero(self):
        x=fixture('fullscreen-report/fixtures/datacentre.synthetic.json');x['geometry']={'type':'Point','coordinates':[None,52]}
        with self.assertRaisesRegex(EvidenceError,'geometry:incomplete'):self.dc.adapt(x)

    def test_datacentre_grid_mw_not_derived_from_it_mw(self):
        x=fixture('fullscreen-report/fixtures/datacentre.synthetic.json');x['properties']['it_load_mw']['value']=125
        view=self.dc.adapt(x)
        self.assertEqual(view['capacity']['it_load_mw'],125)
        self.assertIsNone(view['capacity']['grid_connection_mw'])

    def test_repd_map_receiver_rejected_if_retired(self):
        x=deepcopy(self.rows[0]);x['map_href']='https://globalgrid2050.com/repd_grid_atlasv8/?repd_ref=12588'
        with self.assertRaisesRegex(EvidenceError,'map:unexpected_receiver'):self.rep.adapt(x)

    def test_repd_map_not_silently_swapped_to_new_asset(self):
        x=deepcopy(self.rows[0]);x['repd_ref']='bad-id'
        with self.assertRaisesRegex(EvidenceError,'identity:repd_numeric_required'):self.rep.adapt(x)

    def test_asset_key_delimiter_collision_rejected(self):
        with self.assertRaises(EvidenceError):asset_key_string({'vertical':'repd','source_register':'A|B','source_snapshot':'2026','source_record_id':'12588'})

    def test_note_without_brief_rejected(self):
        bad=deepcopy(self.side);next(iter(bad['notes'].values()))['brief']=''
        with self.assertRaisesRegex(EvidenceError,'sidecar:missing_brief'):attach_sidecar(self.rows,bad,self.rep)

    def test_no_source_mutation_when_client_changes_nested_view(self):
        views,_=attach_sidecar(self.rows,self.side,self.rep)
        views[0]['source']['project_name']='CHANGED'
        self.assertEqual(self.rows[0]['project_name'],'Botley West')

    def test_identity_contract_schema_and_sidecar_schema(self):
        from jsonschema import Draft202012Validator
        a=fixture('contracts/asset_key.schema.json');b=fixture('contracts/machine_read_notes_sidecar.schema.json')
        Draft202012Validator.check_schema(a);Draft202012Validator.check_schema(b)
        for n in self.side['notes'].values():Draft202012Validator(a).validate(n['asset_key'])
        # The sidecar resolver loads the local referenced AssetKey schema rather than fetching a remote URL.
        from referencing import Registry, Resource
        resource=Resource.from_contents(a)
        registry=Registry().with_resource('https://globalgrid2050.com/contracts/asset-key-v1.schema.json',resource)
        # Relative refs are based on schema $id, both JSON schema files share a directory.
        Draft202012Validator(b,registry=registry).validate(self.side)

    def test_fullscreen_static_accessibility_contract(self):
        html=(ROOT/'fullscreen-report/index.html').read_text()
        css=(ROOT/'fullscreen-report/report-mode.css').read_text()
        js=(ROOT/'fullscreen-report/report-mode.js').read_text()
        self.assertIn('aria-modal="true"',html)
        self.assertIn('role="dialog"',html)
        self.assertIn('id="static-reference"',html)
        self.assertIn('aria-live="polite"',html)
        self.assertIn('min-height:44px',css)
        self.assertIn('prefers-reduced-motion:reduce',css)
        self.assertIn('@media print',css)
        self.assertIn('100dvh',css)
        self.assertIn('textContent',js)
        self.assertIn('history.pushState',js)
        self.assertIn('history.replaceState',js)
        self.assertNotIn('innerHTML',js)
        self.assertNotIn('buildAtlasDeepLink',js)

if __name__=='__main__':unittest.main()
