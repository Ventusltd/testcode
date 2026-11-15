"""Vertical-neutral register contract, deliberately independent of note evidence.

All source records are inputs, never modified. This module is not a map router;
MAP actions are accepted only as existing, externally produced hrefs.
"""
from __future__ import annotations
from dataclasses import dataclass
from copy import deepcopy
from typing import Protocol, Mapping, Any
from ..compat import adapt_repd, adapt_datacentre, asset_identity, _map_href
from ..engine import EvidenceError, require, stable_json, digest

@dataclass(frozen=True)
class AssetKey:
    vertical: str
    source_register: str
    source_snapshot: str
    source_record_id: str

    def encode(self) -> str:
        # Source identifiers cannot contain pipe; keys cannot alias.
        parts = (self.vertical, self.source_register, self.source_snapshot, self.source_record_id)
        require(all('|' not in p for p in parts), 'asset:key_delimiter')
        return '|'.join(parts)


def asset_key_string(identity: Mapping[str, str]) -> str:
    require(isinstance(identity, dict), 'asset:invalid_identity')
    validated = asset_identity(**identity)
    return AssetKey(**validated).encode()


class AssetAdapter(Protocol):
    vertical: str
    def adapt(self, row: Mapping[str, Any]) -> dict: ...


@dataclass(frozen=True)
class RepdAdapter:
    source_snapshot: str
    source_register: str = 'DESNZ-REPD'
    vertical: str = 'repd'

    def adapt(self, row: Mapping[str, Any]) -> dict:
        original = deepcopy(row)
        result = adapt_repd(original, self.source_snapshot, self.source_register)
        require(original == row, 'repd:source_modified')
        # Existing row's MAP link is a pure passthrough (may be unavailable).
        result['asset_key'] = asset_key_string(result['identity'])
        return result


@dataclass(frozen=True)
class DataCentreAdapter:
    source_snapshot: str
    source_register: str = 'gridatlas-uk-datacentres'
    vertical: str = 'datacentre'

    def adapt(self, feature: Mapping[str, Any]) -> dict:
        original = deepcopy(feature)
        result = adapt_datacentre(original, self.source_snapshot, self.source_register)
        require(original == feature, 'datacentre:source_modified')
        result['asset_key'] = asset_key_string(result['identity'])
        # Data-centre atlas deep-link type is not authorised by the REPD contract.
        result['map_href'] = None
        return result


def attach_sidecar(records: list[dict], sidecar: Mapping[str, Any], adapter: AssetAdapter):
    """Return (source-independent view records, audit) with strict optional notes.

    Only adds the 'machine_note' view property; no source map/CSV/filters changes.
    Sidecar notes must reference an exact known asset key and remain candidates.
    A missing sidecar is normal, whereas orphan keys and dishonest states fail.
    """
    require(isinstance(records, list) and records, 'sidecar:missing_records')
    require(isinstance(sidecar, dict), 'sidecar:invalid')
    require(sidecar.get('schema') == 'globalgrid2050.machine-read-notes-sidecar.v1', 'sidecar:schema')
    notes = sidecar.get('notes')
    require(isinstance(notes, dict), 'sidecar:notes_structure')
    source_digest = digest(records)
    views = []
    seen = set()
    for source in records:
        adapted = adapter.adapt(source)
        key = adapted['asset_key']
        require(key not in seen, 'sidecar:duplicate_asset')
        seen.add(key)
        note = notes.get(key)
        if note is not None:
            require(isinstance(note, dict), 'sidecar:note_not_object')
            require(note.get('asset_key') == adapted['identity'], 'sidecar:note_identity_mismatch')
            require(note.get('note_state') in ('candidate', 'insufficient_evidence'), 'sidecar:untrusted_elevation')
            require(isinstance(note.get('brief'), str) and note['brief'].strip(), 'sidecar:missing_brief')
            require(note.get('rights_basis') == 'unknown', 'sidecar:unsupported_rights')
        views.append({'source': deepcopy(source), 'adapted': adapted, 'machine_note': deepcopy(note)})
    require(not set(notes).difference(seen), 'sidecar:orphan_note')
    require(digest(records) == source_digest, 'sidecar:source_mutated')
    return views, {'source_rows_sha256': source_digest, 'identity_count': len(seen),
                   'note_count': sum(v['machine_note'] is not None for v in views),
                   'full_7775_audit': 'UNVERIFIED unless compared against original pinned REPD file'}
