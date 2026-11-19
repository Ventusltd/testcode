"""Catalogue isolated Git blobs and render the same scope with Kuiper."""

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys


def git(root, *args):
    return subprocess.check_output(["git", "-C", root, *args])


def checked_out_files(root):
    for record in git(root, "ls-files", "--stage", "-z").split(b"\0"):
        if not record:
            continue
        index, filename = record.split(b"\t", 1)
        mode, oid, stage = index.decode().split()
        relative = os.fsdecode(filename)
        path = root / relative
        if stage == "0" and mode in {"100644", "100755"} and path.is_file():
            yield mode, oid, path


def catalogue(roots):
    blobs = {}
    repositories = {}
    for name, root in roots.items():
        repositories[name] = git(root, "rev-parse", "HEAD").decode().strip()
        for _, oid, path in checked_out_files(root):
            with path.open("rb") as contents:
                digest = hashlib.file_digest(contents, "sha256").hexdigest()
            relative = path.relative_to(root).as_posix()
            blob = blobs.setdefault(oid, {"sha256": digest, "paths": []})
            if blob["sha256"] != digest:
                raise ValueError(f"Checkout content for {oid} differs at {name}:{relative}")
            blob["paths"].append(f"{name}:{relative}")
    return {"repositories": repositories, "unique_git_blobs": len(blobs), "blobs": blobs}


def render_kuiper(tool, roots, output):
    parents = {root.parent for root in roots.values()}
    if len(parents) != 1:
        raise ValueError("Kuiper checkouts must share a parent directory")
    spec = importlib.util.spec_from_file_location("kuiper_estate", tool)
    estate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(estate)
    original_git = estate.git

    def sparse_tree(cwd, args):
        # Native ls-tree -l would lazily fetch the monolith's out-of-scope blobs.
        if args != ["ls-tree", "-r", "-l", "HEAD"]:
            return original_git(cwd, args)
        root = Path(cwd)
        return "\n".join(
            f"{mode} blob {oid} {path.stat().st_size}\t{json.dumps(path.relative_to(root).as_posix())}"
            for mode, oid, path in checked_out_files(root)
        )

    estate.git = sparse_tree
    previous_args = sys.argv
    sys.argv = [str(tool), "--roots", str(parents.pop()), "--depth", "blob",
                "--seed", "pipeline-news-v956", "--out", str(output)]
    try:
        if estate.main() != 0:
            raise RuntimeError("Kuiper estate render failed")
    finally:
        sys.argv = previous_args
    rendered = json.loads((output / "bodies.json").read_text(encoding="utf-8"))
    return rendered["bodies"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("roots", nargs="+", type=Path)
    parser.add_argument("--kuiper", type=Path)
    args = parser.parse_args()
    roots = {path.name: path for path in args.roots}
    if len(roots) != len(args.roots):
        parser.error("checkout directory names must be unique")
    report = catalogue(roots)
    if not report["unique_git_blobs"]:
        parser.error("checkout scope contains no materialized Git blobs")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.kuiper:
        reported_count = render_kuiper(args.kuiper, roots, args.output.parent / "kuiper")
        if reported_count != report["unique_git_blobs"]:
            raise ValueError("Kuiper and the Git catalogue disagree on unique blob count")
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f'Catalogued {report["unique_git_blobs"]} unique Git blobs')


if __name__ == "__main__":
    main()
