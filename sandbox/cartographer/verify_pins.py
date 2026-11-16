"""Offline proof of committed source identity, not execution or product acceptance."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess


class PinError(ValueError):
    pass


def _git(repo, *args):
    try:
        return subprocess.run(
            ["git", "--no-replace-objects", "-C", str(repo), *args], check=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20,
            env={**os.environ, "GIT_NO_LAZY_FETCH": "1", "GIT_GRAFT_FILE": os.devnull},
        ).stdout
    except (OSError, subprocess.SubprocessError) as exc:
        # Git errors can include workstation locations. Never copy them to receipts.
        raise PinError("required committed object unavailable") from exc


def verify(receipt, roots):
    if not isinstance(receipt, dict) or receipt.get("schema") != "testcode.cartographer-pins.v1":
        raise PinError("unsupported receipt")
    pins = receipt.get("pins")
    if not isinstance(pins, list) or not pins:
        raise PinError("empty coverage cannot pass")
    seen = set()
    for pin in pins:
        if not isinstance(pin, dict) or set(pin) != {"repository", "commit", "path", "blob", "sha256"}:
            raise PinError("invalid pin fields")
        owner = pin["repository"]
        if not isinstance(owner, str) or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", owner):
            raise PinError("invalid public repository identifier")
        for key, size in (("commit", 40), ("blob", 40), ("sha256", 64)):
            if not isinstance(pin[key], str) or not re.fullmatch(rf"[0-9a-f]{{{size}}}", pin[key]):
                raise PinError("pin requires full lowercase object identity")
        path = pin["path"]
        if (not isinstance(path, str) or not path or "\\" in path or ":" in path
                or any(ord(c) < 32 for c in path) or path.startswith(("/", "-"))
                or any(p in ("", ".", "..") for p in path.split("/"))
                or PurePosixPath(path).is_absolute()):
            raise PinError("invalid repository-relative path")
        key = (owner, pin["commit"], path)
        if key in seen:
            raise PinError("duplicate coverage")
        seen.add(key)
        if owner not in roots:
            raise PinError("required repository unavailable")
        repo = roots[owner]
        if _git(repo, "cat-file", "-t", pin["commit"]).strip() != b"commit":
            raise PinError("commit identity is not a commit")
        obj = _git(repo, "rev-parse", "--verify", f'{pin["commit"]}:{path}').decode().strip()
        if obj != pin["blob"] or _git(repo, "cat-file", "-t", obj).strip() != b"blob":
            raise PinError("path/blob mismatch")
        content = _git(repo, "cat-file", "blob", obj)
        if hashlib.sha256(content).hexdigest() != pin["sha256"]:
            raise PinError("source bytes changed")
    return {
        "status": "PASS", "scope": "committed source identity only",
        "pins_checked": len(seen), "repositories_checked": len({x[0] for x in seen}),
        "executed_source_files": 0, "runtime_acceptance": "UNVERIFIED",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("receipt", type=Path)
    parser.add_argument("--repo", action="append", default=[], metavar="OWNER/NAME=LOCAL_CHECKOUT")
    args = parser.parse_args()
    try:
        roots = {}
        for spec in args.repo:
            name, location = spec.split("=", 1)
            if not location or name in roots:
                raise PinError("invalid or duplicate repository mapping")
            roots[name] = Path(location)
        result = verify(json.loads(args.receipt.read_text(encoding="utf-8")), roots)
    except (PinError, ValueError, OSError):
        print(json.dumps({"status": "FAIL", "reason": "invalid, missing or mismatched source pin"}))
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
