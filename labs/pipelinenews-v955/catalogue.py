"""Group isolated checkout files by Kuiper's Git-blob identity."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess


def git(root, *args):
    return subprocess.check_output(["git", "-C", root, *args])


def catalogue(roots):
    blobs = {}
    repositories = {}
    for name, root in roots.items():
        repositories[name] = git(root, "rev-parse", "HEAD").decode().strip()
        for record in git(root, "ls-files", "--stage", "-z").split(b"\0"):
            if not record:
                continue
            index, filename = record.split(b"\t", 1)
            mode, oid, stage = index.decode().split()
            relative = os.fsdecode(filename)
            path = root / relative
            if stage != "0" or mode not in {"100644", "100755"} or not path.is_file():
                continue
            with path.open("rb") as contents:
                digest = hashlib.file_digest(contents, "sha256").hexdigest()
            blob = blobs.setdefault(oid, {"sha256": digest, "paths": []})
            if blob["sha256"] != digest:
                raise ValueError(f"Checkout content for {oid} differs at {name}:{relative}")
            blob["paths"].append(f"{name}:{relative}")
    return {"repositories": repositories, "unique_git_blobs": len(blobs), "blobs": blobs}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("roots", nargs="+", type=Path)
    args = parser.parse_args()
    roots = {path.name: path for path in args.roots}
    if len(roots) != len(args.roots):
        parser.error("checkout directory names must be unique")
    report = catalogue(roots)
    if not report["unique_git_blobs"]:
        parser.error("checkout scope contains no materialized Git blobs")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f'Catalogued {report["unique_git_blobs"]} unique Git blobs')


if __name__ == "__main__":
    main()
