"""Conservative, non-publishing asset identity and additive note compatibility contract.

No MAP URLs, coordinates, record IDs or source fields are regenerated here. The
product integration will be independently reviewed in a later authorised branch.
"""
from __future__ import annotations

from copy import deepcopy
import math
import re
from urllib.parse import urlsplit

from .engine import EvidenceError, require

VERTICALS = {"repd", "datacentre", "storage", "transmission", "industrial_offtaker"}
TOKEN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")


def token(value, name):
    require(isinstance(value, str) and TOKEN.fullmatch(value) is not None, f"identity:{name}")
    return value


def asset_identity(vertical, source_register, source_snapshot, source_record_id):
    require(vertical in VERTICALS, "identity:unknown_vertical")
    for key, value in (("register", source_register), ("snapshot", source_snapshot), ("record", source_record_id)):
        token(value, key)
    if vertical == "repd":
        require(source_record_id.isascii() and source_record_id.isdigit(), "identity:repd_numeric_required")
    elif source_record_id.isascii() and source_record_id.isdigit():
        # A non-REPD asset may have a numeric native ID; that ID is still not a REPD ref.
        pass
    return {"vertical": vertical, "source_register": source_register,
            "source_snapshot": source_snapshot, "source_record_id": source_record_id}


def optional_point(lat, lon):
    if lat is None and lon is None:
        return None
    require(lat is not None and lon is not None, "geometry:incomplete")
    require(all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in (lat, lon)), "geometry:not_finite_number")
    require(-90 <= lat <= 90 and -180 <= lon <= 180, "geometry:out_of_range")
    return {"latitude": lat, "longitude": lon}


def _mw(value, field):
    require(value is None or (isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0), f"capacity:{field}")
    return value


def _map_href(href):
    if href is None:
        return None
    require(isinstance(href, str) and len(href) <= 2048, "map:invalid_href")
    parsed = urlsplit(href)
    require(parsed.scheme == "https" and parsed.hostname == "ventusltd.github.io"
            and parsed.path.startswith("/gridatlas/atlas/")
            and parsed.username is None and parsed.password is None and parsed.port in (None, 443), "map:unexpected_receiver")
    return href  # byte-for-byte passthrough, including parameter order / encoding


def adapt_repd(row, source_snapshot, source_register="DESNZ-REPD"):
    require(isinstance(row, dict) and "repd_ref" in row, "repd:missing_ref")
    identity = asset_identity("repd", source_register, source_snapshot, row["repd_ref"])
    point = optional_point(row.get("latitude"), row.get("longitude"))
    map_href = _map_href(row.get("map_href"))
    # No mutation and no surrogate coordinates for unmapped rows.
    return {"identity": identity, "geometry": point, "map_href": map_href,
            "technology": row.get("technology"), "source_status": row.get("status")}


def adapt_datacentre(feature, source_snapshot, source_register="gridatlas-uk-datacentres"):
    require(isinstance(feature, dict) and feature.get("type") == "Feature", "datacentre:not_feature")
    props = feature.get("properties")
    require(isinstance(props, dict), "datacentre:missing_properties")
    require("repd_ref" not in props and "repd_ref" not in feature, "datacentre:forged_repd")
    site_id = feature.get("id")
    require(site_id == props.get("id"), "datacentre:conflicting_ids")
    identity = asset_identity("datacentre", source_register, source_snapshot, site_id)
    geom = feature.get("geometry")
    if geom is None:
        point = None
    else:
        require(isinstance(geom, dict) and geom.get("type") == "Point", "datacentre:unsupported_geometry")
        coords = geom.get("coordinates")
        require(isinstance(coords, list) and len(coords) == 2, "datacentre:invalid_point")
        point = optional_point(coords[1], coords[0])
    loads = {}
    for name in ("it_load_mw", "grid_connection_mw"):
        info = props.get(name)
        require(info is None or isinstance(info, dict), f"capacity:{name}:structure")
        value = None if info is None else info.get("value")
        loads[name] = _mw(value, name)  # Explicitly separate quantities, including nulls
    return {"identity": identity, "geometry": point, "site_key": props.get("site_key"),
            "source_status": props.get("status"), "capacity": loads,
            "rights_status": "UNVERIFIED — see individual source licence receipts"}


def attach_machine_notes(source_rows, notes_by_ref, snapshot_id):
    """Append optional note data; never rewrite an existing row, MAP URL or status.

    ``notes_by_ref`` keys are literal REPD references (no fuzzy name matching).
    Existing Pipeline News filter/sort/export/render logic is left to the host.
    """
    require(isinstance(source_rows, list) and isinstance(notes_by_ref, dict), "attach:invalid_input")
    out = deepcopy(source_rows)
    known = set()
    for row in out:
        require(isinstance(row, dict) and "machine_read_notes" not in row, "attach:collision")
        ref = row.get("repd_ref")
        require(isinstance(ref, str) and ref.isascii() and ref.isdigit() and ref not in known, "attach:duplicate_or_invalid_ref")
        known.add(ref)
        if "map_href" in row:
            _map_href(row["map_href"])
        note = notes_by_ref.get(ref)
        if note is not None:
            require(isinstance(note, dict) and note.get("schema") == "globalgrid2050.machine-read-note.v1", "attach:note_schema")
            require(note.get("repd_ref") == ref and note.get("source_snapshot_id") == snapshot_id, "attach:note_identity_mismatch")
            require(note.get("label") in ("CANDIDATE — NOT INDEPENDENTLY VERIFIED", "INSUFFICIENT EVIDENCE"), "attach:unsupported_note_state")
            # Existing data keys stay equal in both value and insertion order.
            row["machine_read_notes"] = deepcopy(note)
        else:
            row["machine_read_notes"] = None
    require(not (set(notes_by_ref) - known), "attach:orphan_note")
    return out
