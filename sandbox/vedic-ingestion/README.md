# VEDIC incremental ingestion — isolated TestCode candidate

Owner-directed Tacit 3 work package, 26 November 2026. Coordination: [Neural Link #87](https://github.com/Ventusltd/neural-link-between-agents/issues/87#issuecomment-7181058314). This is an offline-tested candidate, not VEDIC production deployment.

## Contract

Read two complete, checkpointed, SHA-256-pinned SQLite snapshots from the existing Modular Star producer. Compare permanent line/tablet/family/element identities and historical membership/occurrence records. Reconstruct changed tablets from ordered little-endian uint32 line IDs and verify Git blob bytes. Emit unique newly assigned line IDs, new family IDs, changed current-scan file candidates, representative exact historical candidates, explicit unmapped IDs, scan issues and removals from successful scans. Current scan is not proof of live deployment. Unchanged file content is not re-catalogued.

The authoritative producer remains Stars; reuse the existing VEDIC acquisition consumer. No new ID allocator, semantic translator, source execution, new scanner, dashboard or publisher. The script never edits either snapshot. New meanings and runtime proofs remain null/unverified. Repeated lines and nested spans are represented by sets of permanent IDs, not summed counts. Refuse changed old IDs, missing historical provenance, bad source hashes and corrupt input rather than silently accepting.

## Priority hints

Owner requested hot items first. The candidate emits priority 0 for See Through, Kuiper, Solar Design Studio (including its 3D site world), LiDAR, Ventus Grid Engine, Vicinity, substation locations, GridAtlas and GIS SLD Financial Sandbox; other applications remain eligible at priority 1. Hints are deterministic repository/path rules, not verified semantic classification or a claim of active runtime. Preserve historical versus current-scan distinction; stable meaning IDs are independent of ordering.

Existing taxonomy/evidence to reuse and reconcile:

- [GlobalGrid2050 homepage catalogue](https://github.com/Ventusltd/globalgrid2050/blob/c66759f0d7ac3489df9158da6eaa1330a37c069f/homepage_versions/homepage_v134.html) and [historical archive](https://github.com/Ventusltd/globalgrid2050/blob/c66759f0d7ac3489df9158da6eaa1330a37c069f/historical_builds.html).
- [Kuiper application registry](https://github.com/Ventusltd/kuiper-belt/blob/e8b04bea0d369e422cd6313981f1d51cbc4347b9/editions/202611021201/data/apps.json), including [See Through](https://github.com/Ventusltd/kuiper-belt/tree/e8b04bea0d369e422cd6313981f1d51cbc4347b9/see-through/202611020012).
- Solar Design Studio: energy-transition-simulator; archived globalgrid2050/solar-design-studio and GIS SLD paths. LiDAR: lidar/world-lidar. Standalone GIS sandbox: gis-sld-sandbox. Grid engine and GridAtlas have separate producer identities.

These are pinned discovery references, not proof that a named edition is currently served. Tacit 2 resolves exact source/family associations; Tacit 1 retains the meaning registry and release authority.

## Run locally first (Python 3.12, standard library)

From repository root:

```sh
python -m unittest discover -s sandbox/vedic-ingestion -p 'test_*.py' -v
python sandbox/vedic-ingestion/ingest.py --before baseline.sqlite --after next.sqlite --before-sha BASELINE_SHA256 --after-sha NEXT_SHA256 --output delta.json
```

Replace the SHA placeholders with independently verified snapshot digests. Output must not already exist. Use only producer-published public code snapshots. Do not upload the raw database to TestCode.

## Evidence and limitations

Local Python regression: 15/15 synthetic fixture tests passed, including overlap, new historical tablet, priority rules, no-op, unmapped lines, failed scan, immutable IDs, bad digest, malformed tablet and reconstruction drift. Tested Git blobs: ingest.py 152c78b034c8899c7f9c815b9b7f7183c4363c5f; test_ingest.py f7a3bc495e874af98136d68aa07594e879a7c942. Hosted CI independently reruns the offline suite. These are local regression safeguards, not installed CVAA vaccines.

A two-real-snapshot producer replay, actual scale/runtime and parity with the existing JavaScript reader are still required before enabling unattended production ingestion. A strict historical rewrite or schema migration deliberately fails closed and requires a reviewed migration contract, not a bypass. JSON is an intermediate candidate report; Parquet/DuckDB, full lexical indexing, permanent meaning allocation and UI integration remain separate work. No claim of translated corpus coverage or live publication. Do not hold the working VEDIC V1 release for these additions.
