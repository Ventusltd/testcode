import json
from pathlib import Path
import unittest
from src.engine import stable_json,digest

BASE=Path(__file__).resolve().parents[1]

class ContractAndUI(unittest.TestCase):
    def test_schema_bundle_and_notes(self):
        from jsonschema import Draft202012Validator
        note_schema=json.loads((BASE/'contracts/machine_read_note.schema.json').read_text())
        receipt_schema=json.loads((BASE/'contracts/source_receipt.schema.json').read_text())
        Draft202012Validator.check_schema(note_schema)
        Draft202012Validator.check_schema(receipt_schema)
        bundle=json.loads((BASE/'ui/fixture-data.json').read_text())
        self.assertEqual(bundle['bundle_sha256'],digest({k:v for k,v in bundle.items() if k!='bundle_sha256'}))
        for n in bundle['notes']:
            Draft202012Validator(note_schema).validate(n)
        for n in json.loads((BASE/'fixtures/receipts.synthetic.json').read_text()):
            Draft202012Validator(receipt_schema).validate(n)
    def test_static_safe_if_javascript_fails(self):
        html=(BASE/'ui/index.html').read_text()
        self.assertGreaterEqual(html.count('<details>'),3)
        self.assertIn('Machine-originated Pipeline Intelligence Brief',html)
        self.assertIn('Synthetic, not an official source receipt',html)
        self.assertNotIn('display:none',html)
    def test_mobile_and_reduced_motion_rules(self):
        css=(BASE/'ui/machine-read-notes.css').read_text()
        self.assertIn('min-height:44px',css)
        self.assertIn('min-width:44px',css)
        self.assertIn('prefers-reduced-motion:reduce',css)
        self.assertIn('@media print',css)
        self.assertIn('overflow-x:auto',css)
    def test_no_inner_html_or_unsafe_image_injection(self):
        js=(BASE/'ui/machine-read-notes.js').read_text()
        self.assertNotIn('innerHTML',js)
        self.assertIn('textContent',js)
        self.assertIn('aria-expanded',js)
        self.assertIn('replaceChildren',js)
    def test_schema_downgrade_drops_rights_field_and_fails_validation(self):
        from jsonschema import ValidationError, validate
        schema=json.loads((BASE/'contracts/machine_read_note.schema.json').read_text())
        note=json.loads((BASE/'ui/fixture-data.json').read_text())['notes'][0]
        del note['rights_basis']
        with self.assertRaises(ValidationError):validate(note,schema)

if __name__=='__main__':unittest.main()
