"""Materialize immutable Git blobs from an existing local clone; no network."""
import argparse
import hashlib
import os
from pathlib import Path
import subprocess

from lab_support import manifest, verify_inputs


def prepare(source_repo, output):
    output = Path(output).resolve()
    if output.exists():
        raise ValueError("Output must be a new directory; existing inputs are not overwritten")
    git_env = os.environ.copy()
    git_env.update(GIT_NO_LAZY_FETCH="1", GIT_NO_REPLACE_OBJECTS="1",
                   GIT_GRAFT_FILE=os.devnull)
    pending = []
    for name, component in manifest()["components"].items():
        for path, expected in component["files"].items():
            data = subprocess.run(["git", "-c", "protocol.allow=never", "-C", str(source_repo), "show",
                                   f"{component['commit']}:{path}"],
                                  check=True, capture_output=True, env=git_env).stdout
            if hashlib.sha256(data).hexdigest() != expected:
                raise ValueError(f"Pinned Git blob mismatch: {name}/{path}")
            pending.append((output / name / path, data))
    for target, data in pending:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    verify_inputs(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-repo", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    prepare(args.source_repo, args.output)
    print("Pinned local input closure prepared; no network used.")
