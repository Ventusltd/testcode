"""Read-only authoritative-in-product V9.22 source preservation audit.

Input MUST be an explicit, pinned checkout of V9.22 project partitions. This does
not prove original DESNZ XLSX byte authenticity or live MAP receiver behaviour.
"""
from __future__ import annotations
from pathlib import Path
import argparse
import hashlib
import json
import re
import sys
from src.adapters.records import RepdAdapter, attach_sidecar
from src.engine import EvidenceError, require, digest, stable_json

EXPECTED_FILES = 16
EXPECTED_RECORDS = 7775


def audit(source_dir: Path, *, expected_count=EXPECTED_RECORDS, expected_parts=EXPECTED_FILES):
    require(source_dir.is_dir(), 'audit:source_not_found')
    parts = sorted(source_dir.glob('part-*.json'))
    require(len(parts) == expected_parts, 'audit:part_count')
    require(all(re.fullmatch(r'part-\d{3}\.json', p.name) for p in parts), 'audit:part_name')
    require([p.name for p in parts] == [f'part-{i:03}.json' for i in range(1, expected_parts+1)], 'audit:missing_or_ordered_part')
    rows = []
    proofs=[]
    for p in parts:
        raw=p.read_bytes()
        try: fragment=json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc: raise EvidenceError('audit:invalid_json_part') from exc
        require(isinstance(fragment, dict) and fragment.get('schema') == 'globalgrid2050.v9.project-partition.v9.1', 'audit:part_schema')
        batch=fragment.get('projects')
        require(isinstance(batch,list) and fragment.get('record_count')==len(batch) and batch, 'audit:part_record_count')
        require(all(isinstance(r,dict) for r in batch), 'audit:invalid_record')
        proofs.append({'path':p.name,'source_sha256':hashlib.sha256(raw).hexdigest(),'rows':len(batch)})
        rows.extend(batch)
    require(len(rows)==expected_count, 'audit:total_records')
    refs=[r.get('repd_ref') for r in rows]
    require(all(isinstance(x,str) and x.isascii() and x.isdigit() for x in refs), 'audit:invalid_repd_ref')
    require(len(set(refs))==len(refs),'audit:duplicate_repd_ref')
    before=digest(rows)
    adapter=RepdAdapter(source_snapshot='202611151300',source_register='DESNZ-REPD')
    views, evidence = attach_sidecar(rows,{'schema':'globalgrid2050.machine-read-notes-sidecar.v1','notes':{}},adapter)
    require(digest(rows)==before,'audit:source_changed')
    require(all(v['source']==r for v,r in zip(views,rows)),'audit:source_row_changed')
    require(all(v['source']['status']==r['status'] for v,r in zip(views,rows)),'audit:official_status_changed')
    require(all(v['adapted']['map_href'] is None for v in views), 'audit:unexpected_map_link_input')
    require(all(v['machine_note'] is None for v in views),'audit:unexpected_machine_note')
    return {'schema':'globalgrid2050.agent10-v922-preservation-audit.v1',
            'source':'explicitly supplied V9.22 part-001..016 product JSON; not original DESNZ XLSX',
            'source_snapshot':'202611151300','repd_records':len(rows),'unique_repd_ids':len(set(refs)),
            'original_source_rows_digest':before,'after_sidecar_rows_digest':digest(rows),
            'parts':proofs,'source_record_mutations':0,'sidecar_notes_attached':0,
            'map_href_bytes_verified':'NOT AVAILABLE IN PARTITIONS — original product JS deep-link tests separate',
            'official_desnz_source_bytes_verified':False,
            'live_gridatlas_map_restoration_verified':False,
            'owner_iphone_accepted':False}


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--source-dir',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--expected-count',type=int,default=EXPECTED_RECORDS)
    p.add_argument('--expected-parts',type=int,default=EXPECTED_FILES)
    args=p.parse_args()
    result=audit(args.source_dir,expected_count=args.expected_count,expected_parts=args.expected_parts)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(stable_json(result)+'\n',encoding='utf-8')
    print(f'PASS source preservation: {result["repd_records"]} rows, {result["unique_repd_ids"]} exact REPD keys, {len(result["parts"])} pinned V9.22 parts; original DESNZ XLSX / MAP browser UNVERIFIED')

if __name__=='__main__':main()
