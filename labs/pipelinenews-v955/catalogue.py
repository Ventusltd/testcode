"""Group isolated Git files by exact bytes and retain every repository/path alias."""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess


def catalogue(roots):
    artifacts = {}
    repos = {}
    for name, root in roots.items():
        repos[name] = subprocess.check_output(
            ["git", "-C", root, "rev-parse", "HEAD"], text=True
        ).strip()
        raw = subprocess.check_output(["git", "-C", root, "ls-files", "-z"])
        for filename in raw.decode().split("\0"):
            path = root / filename
            if not filename or not path.is_file():
                continue
            digest = hashlib.file_digest(path.open("rb"), "sha256").hexdigest()
            artifacts.setdefault(digest, []).append(f"{name}:{filename}")
    return {"repositories": repos, "unique_files": len(artifacts), "files": artifacts}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("roots", nargs="+", type=Path)
    args = parser.parse_args()
    roots = {path.name: path for path in args.roots}
    if len(roots) != len(args.roots):
        parser.error("checkout directory names must be unique")
    report = catalogue(roots)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f'Catalogued {report["unique_files"]} unique file digests')


if __name__ == "__main__":
    main()
