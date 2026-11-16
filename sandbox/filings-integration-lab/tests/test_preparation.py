"""Local Git fixtures: no sockets, remote services, or silently skipped inputs."""

from contextlib import ExitStack
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import lab_support
import prepare_inputs


class OfflinePreparationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="filings-preparation-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        self.env = os.environ.copy()
        for key in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR",
                    "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES"):
            self.env.pop(key, None)
        self.env.update(GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=os.devnull,
                        GIT_TERMINAL_PROMPT="0")
        self.git(self.source, "init", "--quiet")
        self.git(self.source, "config", "user.name", "Synthetic fixture")
        self.git(self.source, "config", "user.email", "fixture@example.invalid")
        self.payload = b"# synthetic pinned fixture\nVALUE = '1.20'\n"
        (self.source / "module.py").write_bytes(self.payload)
        self.git(self.source, "-c", "core.autocrlf=false", "add", "module.py")
        self.git(self.source, "-c", "core.hooksPath=" + os.devnull,
                 "commit", "--quiet", "-m", "Synthetic source")
        self.commit = self.git(self.source, "rev-parse", "HEAD").stdout.decode().strip()
        self.tree = self.git(self.source, "rev-parse", "HEAD^{tree}").stdout.decode().strip()
        self.blob = self.git(self.source, "rev-parse", "HEAD:module.py").stdout.decode().strip()
        self.pin = {"components": {"fixture": {
            "repository": "synthetic/local-only", "commit": self.commit,
            "module": "module.py",
            "files": {"module.py": hashlib.sha256(self.payload).hexdigest()},
        }}}

    def git(self, repo, *args, env=None):
        return subprocess.run(["git", "-C", str(repo), *args], check=True,
                              capture_output=True, env=env or self.env)

    def prepare(self, source, output, extra_env=None):
        with ExitStack() as stack:
            stack.enter_context(patch.object(prepare_inputs, "manifest", return_value=self.pin))
            stack.enter_context(patch.object(lab_support, "manifest", return_value=self.pin))
            stack.enter_context(patch.dict(os.environ, self.env | (extra_env or {}), clear=True))
            prepare_inputs.prepare(source, output)

    def promisor_without_blob(self, name):
        """A real local promisor has the commit/tree but must fetch its blob."""
        target = self.root / name
        target.mkdir()
        self.git(target, "init", "--quiet")
        for oid in (self.commit, self.tree):
            relative = Path(".git") / "objects" / oid[:2] / oid[2:]
            (target / relative).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(self.source / relative, target / relative)
        self.git(target, "update-ref", "HEAD", self.commit)
        self.git(target, "config", "core.repositoryFormatVersion", "1")
        self.git(target, "config", "extensions.partialClone", "origin")
        self.git(target, "config", "remote.origin.url", self.source.as_uri())
        self.git(target, "config", "remote.origin.promisor", "true")
        self.git(target, "config", "remote.origin.partialCloneFilter", "blob:none")
        return target

    def test_pinned_bytes_materialize_despite_local_replacement(self):
        changed = self.root / "changed.py"
        changed.write_bytes(b"# replaced bytes must not be trusted\n")
        replacement = self.git(self.source, "hash-object", "-w", str(changed)).stdout.decode().strip()
        self.git(self.source, "replace", self.blob, replacement)
        # Prove the fixture really changes an unguarded Git read.
        self.assertNotEqual(self.git(self.source, "show", f"{self.commit}:module.py").stdout, self.payload)
        output = self.root / "accepted"
        self.prepare(self.source, output)
        self.assertEqual((output / "fixture/module.py").read_bytes(), self.payload)

    def test_wrong_hash_rejects_before_any_output(self):
        self.pin["components"]["fixture"]["files"]["module.py"] = "0" * 64
        output = self.root / "wrong-hash"
        with self.assertRaisesRegex(ValueError, "Pinned Git blob mismatch"):
            self.prepare(self.source, output)
        self.assertFalse(output.exists())

    def test_missing_blob_path_rejects_after_staging_without_output(self):
        self.pin["components"]["fixture"]["files"]["missing.py"] = "0" * 64
        output = self.root / "missing"
        with self.assertRaises(subprocess.CalledProcessError):
            self.prepare(self.source, output)
        self.assertFalse(output.exists())

    def test_promisor_blob_cannot_be_hydrated_during_preparation(self):
        # This baseline uses only file://; no network/socket is involved. It
        # proves the missing blob would otherwise be lazily fetched from disk.
        baseline = self.promisor_without_blob("baseline-promisor")
        baseline_env = self.env.copy()
        baseline_env.pop("GIT_NO_LAZY_FETCH", None)
        self.assertEqual(self.git(baseline, "-c", "protocol.file.allow=always", "show",
                                  f"{self.commit}:module.py", env=baseline_env).stdout, self.payload)

        guarded = self.promisor_without_blob("guarded-promisor")
        trace = self.root / "guarded-trace.jsonl"
        output = self.root / "cannot-hydrate"
        with self.assertRaises(subprocess.CalledProcessError):
            self.prepare(guarded, output, {"GIT_TRACE2_EVENT": str(trace)})
        self.assertFalse(output.exists())
        events = [json.loads(line) for line in trace.read_text(encoding="utf-8").splitlines()]
        children = [event.get("argv", []) for event in events if event.get("event") == "child_start"]
        self.assertFalse(any("fetch" in args for args in children), children)
        self.assertFalse((guarded / ".git/objects" / self.blob[:2] / self.blob[2:]).exists())
        self.assertEqual(list((guarded / ".git/objects/pack").glob("*.pack")), [])


if __name__ == "__main__":
    unittest.main()
