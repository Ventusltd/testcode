# Checkpoint 202611140144: GridAtlas main before the October 2026 REPD preview generation was merged

GridAtlas main was 41729af. The preview PR #84 adds generation 202611132345 (v9.189) beside the live one; it does
not change atlas/current.json or STATE.md (copies here). gridatlas.blobmanifest.tsv lists blob id, size and path of
every tracked file at 41729af.

Undo the preview merge: revert its commit(s) on main (`git revert <sha>`), or follow docs/RELEASE.md step 8.
The live generation is whatever atlas/current.json names; compare it with the copy here.
