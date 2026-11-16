"""Read-only, resumable source archaeology. Never imports inspected source.

The private checkpoint is NOT a public artifact. Only report() is exportable.
Public reachability is a metadata disclosure gate, not execution approval.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import urllib.parse
import urllib.request

SCHEMA = "ventus.estate-archivist.v1"
EXCLUDED = {"node_modules", ".venv", "venv", "vendor", "__pycache__"}
OID = re.compile(r"[0-9a-f]{40}(?:[0-9a-f]{24})?\Z")


class ScanError(Exception):
    """Messages deliberately omit paths, subprocess output and credentials."""


def git(repo, *args):
    env = dict(os.environ, GIT_NO_LAZY_FETCH="1", GIT_TERMINAL_PROMPT="0",
               GIT_OPTIONAL_LOCKS="0", GIT_GRAFT_FILE=os.devnull)
    # No shell, source execution, replacements, textconv, diff drivers or hooks.
    try:
        p = subprocess.run(["git", "--no-replace-objects", "-C", str(repo), *args],
                           env=env, capture_output=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired):
        raise ScanError("git unavailable or metadata operation timed out") from None
    if p.returncode:
        raise ScanError("git object or metadata unavailable")
    return p.stdout


def public_identity(name):
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", name):
        raise ScanError("invalid public repository identity")
    # No authenticated request: private repository metadata cannot pass.
    try:
        request = urllib.request.Request("https://api.github.com/repos/" + name,
                                         headers={"User-Agent": "Ventus-Estate-Archivist/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            metadata = json.load(response)
        if metadata.get("private") is not False or metadata.get("full_name", "").lower() != name.lower():
            raise ScanError("repository is not confirmed public")
        # Fresh advertised public refs, no local remote URL or credential helper.
        url = "https://github.com/" + name + ".git"
        p = subprocess.run(["git", "-c", "credential.helper=", "ls-remote", url,
                            "HEAD", "refs/heads/*", "refs/tags/*"],
                           capture_output=True, timeout=60,
                           env=dict(os.environ, GIT_TERMINAL_PROMPT="0",
                                    GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1"))
        if p.returncode:
            raise ScanError("public refs unavailable")
        refs = [line.split() for line in p.stdout.decode("ascii").splitlines()]
        head = next(oid for oid, ref in refs if ref == "HEAD")
        tips = sorted({oid for oid, _ in refs})
        if not all(OID.fullmatch(x) for x in tips):
            raise ScanError("invalid public object identity")
        return {"repository": metadata["full_name"], "head": head, "tips": tips}
    except (OSError, ValueError, KeyError, StopIteration, subprocess.TimeoutExpired):
        raise ScanError("unauthenticated public identity check failed") from None


def selected(path):
    # Reject ambiguous/unsafe path spellings rather than echoing them publicly.
    if (not path or "\\" in path or ":" in path or any(ord(c) < 32 for c in path)
            or PurePosixPath(path).is_absolute() or ".." in PurePosixPath(path).parts):
        return False
    parts = PurePosixPath(path).parts
    if EXCLUDED.intersection(parts):
        return False
    return path.endswith(".py") or (path.startswith(".github/workflows/")
                                      and path.endswith((".yml", ".yaml")))


def tree(repo, commit):
    entries = []
    for entry in git(repo, "ls-tree", "-rz", "--full-tree", commit).split(b"\0"):
        if not entry:
            continue
        metadata, raw_path = entry.split(b"\t", 1)
        mode, kind, oid = metadata.decode("ascii").split()
        path = raw_path.decode("utf-8", errors="replace")
        if kind == "blob" and mode in {"100644", "100755"}:
            entries.append((path, oid))
    return entries


def start(repo, public):
    """public must come from public_identity; tests supply synthetic public tips."""
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", public["repository"]):
        raise ScanError("invalid public repository identity")
    tips = sorted(set(public["tips"]))
    if not tips or not all(OID.fullmatch(x) for x in tips + [public["head"]]):
        raise ScanError("invalid public object identity")
    # Freeze the local reachable universe; later new refs require a new scan.
    commits = git(repo, "rev-list", "--all", "HEAD").decode().splitlines()
    available, unavailable = [], 0
    for oid in tips:
        try:
            git(repo, "cat-file", "-e", oid + "^{commit}")
            available.append(oid)
        except ScanError:
            unavailable += 1
    public_commits = set()
    missing_history = 0
    if available:
        listing = git(repo, "rev-list", "--missing=print", *available, "--").decode().splitlines()
        public_commits = {x for x in listing if OID.fullmatch(x)}
        missing_history = sum(x.startswith("?") for x in listing)
    current = None
    try:
        current = dict(tree(repo, public["head"]))
    except ScanError:
        pass
    return {"schema": SCHEMA, "public": public, "commits": commits,
            "public_commits": sorted(public_commits), "cursor": 0, "blobs": {},
            "current": current, "unavailable_public_tips": unavailable,
            "missing_public_history": missing_history, "unavailable_trees": 0,
            "unproven_commits_skipped": 0, "excluded_entries": 0,
            "shallow": git(repo, "rev-parse", "--is-shallow-repository").strip() == b"true"}


def advance(repo, state, *, max_commits=20, max_blobs=20, max_bytes=131072):
    """Bound tree traversal and unique blob reads separately on each invocation."""
    if min(max_commits, max_blobs, max_bytes) < 1:
        raise ScanError("budgets must be positive")
    if state.get("schema") != SCHEMA:
        raise ScanError("unsupported private checkpoint")
    public = set(state["public_commits"])
    end = min(len(state["commits"]), state["cursor"] + max_commits)
    for commit in state["commits"][state["cursor"]:end]:
        if commit not in public:
            state["unproven_commits_skipped"] += 1
            continue
        try:
            entries = tree(repo, commit)
        except ScanError:
            state["unavailable_trees"] += 1
            continue
        for path, oid in entries:
            if not selected(path):
                state["excluded_entries"] += 1
                continue
            blob = state["blobs"].setdefault(oid, {"paths": {}, "status": "pending"})
            # One public commit proof for every observed path/blob pair.
            blob["paths"].setdefault(path, commit)
    state["cursor"] = end
    pending = [oid for oid, b in sorted(state["blobs"].items()) if b["status"] == "pending"]
    for oid in pending[:max_blobs]:
        blob = state["blobs"][oid]
        try:
            size = int(git(repo, "cat-file", "-s", oid))
            blob["bytes"] = size
            if size > max_bytes:
                blob["status"] = "excluded_oversize"
                continue
            body = git(repo, "cat-file", "blob", oid)
            blob["sha256"] = hashlib.sha256(body).hexdigest()
            blob["lines"] = len(body.splitlines())
            # No source text, identifiers, literal values or comments exported.
            # Cache syntax counts even when first encountered as a workflow:
            # an older commit may later reveal a .py path for this same blob.
            try:
                parsed = ast.parse(body)
                blob["python"] = {"parse": "ok", "imports": sum(isinstance(n, (ast.Import, ast.ImportFrom)) for n in ast.walk(parsed)),
                                  "functions": sum(isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) for n in ast.walk(parsed))}
            except (SyntaxError, ValueError, UnicodeError, RecursionError):
                blob["python"] = {"parse": "unavailable"}
            blob["status"] = "read"
        except ScanError:
            blob["status"] = "unavailable"
    return report(state)


def report(state):
    current = state["current"]
    records = []
    for oid, b in sorted(state["blobs"].items()):
        record = {k: b[k] for k in ("status", "bytes", "sha256", "lines", "python") if k in b}
        if not any(path.endswith(".py") for path in b["paths"]):
            record.pop("python", None)
        record["git_blob"] = oid
        record["observations"] = [{"path": path, "commit": commit,
                                    "current_public_head": None if current is None else current.get(path) == oid,
                                    "path_absent_at_public_head": None if current is None else path not in current,
                                    "url": "https://github.com/" + state["public"]["repository"] + "/blob/" + commit + "/" + urllib.parse.quote(path, safe="/")}
                                   for path, commit in sorted(b["paths"].items())]
        records.append(record)
    statuses = {status: sum(b["status"] == status for b in state["blobs"].values())
                for status in ("read", "pending", "unavailable", "excluded_oversize")}
    complete = (state["cursor"] == len(state["commits"]) and not state["shallow"]
                and not any(state[k] for k in ("unavailable_public_tips", "missing_public_history",
                                              "unavailable_trees", "unproven_commits_skipped"))
                and not any(statuses[k] for k in ("pending", "unavailable", "excluded_oversize")))
    return {"schema": SCHEMA, "repository": state["public"]["repository"],
            "public_head": state["public"]["head"], "scope": "read-only metadata, not a registry or execution/accuracy certification",
            "coverage": {"reachable_local_commits": len(state["commits"]), "commits_processed": state["cursor"],
                         "traversal_complete": state["cursor"] == len(state["commits"]),
                         "selected_source_coverage_complete": complete,
                         "shallow": state["shallow"], "unavailable_public_tips": state["unavailable_public_tips"],
                         "missing_public_history": state["missing_public_history"],
                         "unavailable_trees": state["unavailable_trees"],
                         "public_reachability_unproven_commits": state["unproven_commits_skipped"],
                         "excluded_tree_entries": state["excluded_entries"],
                         "distinct_selected_blobs": len(records), "blob_status_counts": statuses,
                         "public_head_tree_available": current is not None},
            "exclusions": ["untracked/working-tree content", "public-reachability-unproven commit trees", "non-Python/non-workflow paths",
                           "symlinks/submodules", "unsafe path spellings", *sorted(EXCLUDED)],
            "limitations": ["All local refs and HEAD frozen at scan start; reflog/unreachable objects excluded.",
                            "Missing remote refs/objects are not fetched. Shallow history remains incomplete.",
                            "Same-blob paths show rename/copy candidates, not asserted file lineage.",
                            "Historic absence at public HEAD does not establish why a path disappeared.",
                            "No scripts, workflows, imports, source instructions or collectors executed."],
            "blobs": records}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--public-repo", required=True)
    parser.add_argument("--checkpoint", required=True, type=Path, help="PRIVATE file outside any repository; never publish")
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--max-commits", type=int, default=20)
    parser.add_argument("--max-blobs", type=int, default=20)
    parser.add_argument("--max-bytes", type=int, default=131072)
    args = parser.parse_args()
    try:
        if args.checkpoint.resolve() == args.out.resolve():
            raise ScanError("private checkpoint and public report must differ")
        if any((p / ".git").exists() for p in args.checkpoint.resolve().parents):
            raise ScanError("private checkpoint must be outside repositories")
        if args.checkpoint.exists():
            state = json.loads(args.checkpoint.read_text(encoding="utf-8"))
            if state["public"]["repository"].lower() != args.public_repo.lower():
                raise ScanError("checkpoint repository differs")
            # A local checkpoint is trusted private state, never a downloaded manifest.
            git(args.repo, "cat-file", "-e", state["commits"][0] + "^{commit}")
        else:
            state = start(args.repo, public_identity(args.public_repo))
        result = advance(args.repo, state, max_commits=args.max_commits,
                         max_blobs=args.max_blobs, max_bytes=args.max_bytes)
        for path, data in ((args.checkpoint, state), (args.out, result)):
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(path.suffix + ".tmp")
            temporary.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            temporary.replace(path)
        print(json.dumps(result["coverage"], sort_keys=True))
    except (ScanError, OSError, ValueError, KeyError, IndexError):
        parser.exit(2, "Scan unavailable: identity, checkpoint, object or output validation failed. No source/error text disclosed.\n")


if __name__ == "__main__":
    main()
