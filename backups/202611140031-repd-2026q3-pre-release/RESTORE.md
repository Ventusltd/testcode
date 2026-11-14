# Checkpoint 202611140031: state before the REPD October 2026 (2026q3) release

Taken by the Claude harness on the owner's instruction ("back up old work so we can easily restore it; use testcode repo for backups").

## What this is

- `globalgrid2050/`: exact copies, from Ventusltd/globalgrid2050 main at `73cbdec10bbd3fe2f8313b60b1acc2d22d31b517`, of the REPD data files and the scripts the release touches or supersedes. `SHA256SUMS` lists their hashes.
- `manifests/`: git blob id, size and path of EVERY tracked file at the default-branch heads before the release:
  globalgrid2050 `73cbdec1` (47,288 files), pipelinenews `67aa2eb` (3,896 files), gridatlas `41729af` (1,196 files).
  Any later state can be compared with these to prove nothing was truncated.

## Restore points in the repositories themselves

- globalgrid2050 branch `restore/pre-repd-2026q3-20261114` points at `73cbdec1` (main before the release).
- The release is additive: it adds files and changes five (the large-files allowlist and four V6 scripts).

## How to restore

Whole repository to the pre-release state (keeps history; one new commit):

    git fetch origin restore/pre-repd-2026q3-20261114
    git checkout main
    git revert -m 1 <merge commit of PR #57>      # or: git revert <each release commit>
    git push origin main

One file from the baseline, by path:

    git fetch origin restore/pre-repd-2026q3-20261114
    git checkout FETCH_HEAD -- repd.csv            # any path
    sha256sum repd.csv                             # compare with SHA256SUMS here

Check nothing else moved (blob id, size, path):

    git ls-tree -r -l HEAD | awk '{h=$3; s=$4; $1=$2=$3=$4=""; sub(/^ +/,""); print h"\t"s"\t"$0}' | sort > now.tsv
    sort manifests/globalgrid2050.blobmanifest.tsv | comm -23 - now.tsv   # lines here = files changed or removed

The copies in this folder are a second line: if a branch were ever lost, each file can be put back by copying it over and checking its hash.
