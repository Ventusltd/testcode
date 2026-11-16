"""Actual temporary Git regressions; only local file transport is ever allowed.

Reuse the promisor/replacement fixture approach from Testcode's
sandbox/cartographer/test_verify_pins.py at f98a5a986db92366a640fea9be5d1b712c42415d.
These tests observe hydration, child processes and extracted bytes, not an
implementation's environment dictionary. Missing Git/partial-clone support is
a failure, never a skip. No adjacent product repository or user Git config is read.

Default driver: sibling driver.py. TESTCODE_OBSERVATION_DRIVER can select the
owner's patched driver for verification without copying or editing that file.
"""
from __future__ import annotations

from contextlib import contextmanager
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
DRIVER_PATH = Path(os.environ.get("TESTCODE_OBSERVATION_DRIVER", HERE / "driver.py"))
SPEC = importlib.util.spec_from_file_location("observation_driver_git_fixture", DRIVER_PATH)
DRIVER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DRIVER)
RELATIVE_FILE = "fixture/pinned.txt"
ORIGINAL = b"original committed fixture bytes\n"
CHANGED = b"replacement committed fixture bytes\n"


class GitInputTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(shutil.which("git"), "Git runtime is required")
        self.temporary = tempfile.TemporaryDirectory(prefix="testcode-git-inputs-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.repo = self.root / "source"
        self.repo.mkdir()
        # CI itself disables lazy fetch/replacements/protocols. Remove inherited
        # Git knobs in these child fixtures so they cannot mask the regression.
        # Global/system config and every non-file protocol remain unavailable.
        self.environment = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        self.environment.update({
            "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_SYSTEM": os.devnull,
            "GIT_CONFIG_GLOBAL": os.devnull, "GIT_TERMINAL_PROMPT": "0",
            "GIT_ALLOW_PROTOCOL": "file", "GIT_ATTR_NOSYSTEM": "1",
        })
        self.git(self.repo, "init", "-q", "--initial-branch=main")
        self.git(self.repo, "config", "core.autocrlf", "false")
        self.commit = self.commit_bytes(ORIGINAL, "original")
        self.blob = self.git(self.repo, "rev-parse", self.commit + ":" + RELATIVE_FILE).stdout.decode().strip()

    def git(self, repo, *arguments, env=None, check=True):
        result = subprocess.run(
            ["git", "-C", str(repo), *arguments], capture_output=True,
            env=self.environment if env is None else env, timeout=30,
        )
        if check:
            self.assertEqual(result.returncode, 0, "Temporary Git fixture command failed: " + " ".join(arguments[:2]))
        return result

    def commit_bytes(self, content, message):
        target = self.repo / RELATIVE_FILE
        target.parent.mkdir(exist_ok=True)
        target.write_bytes(content)
        self.git(self.repo, "add", RELATIVE_FILE)
        self.git(self.repo, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
                 "-c", "commit.gpgSign=false", "commit", "-qm", message)
        return self.git(self.repo, "rev-parse", "HEAD").stdout.decode().strip()

    def partial_clone(self, name):
        self.git(self.repo, "config", "uploadpack.allowFilter", "true")
        destination = self.root / name
        self.git(self.repo, "clone", "-q", "--no-checkout", "--filter=blob:none",
                 self.repo.as_uri(), str(destination))
        self.assertEqual(self.git(destination, "config", "--get", "remote.origin.promisor").stdout.strip(), b"true")
        self.assertIn("?" + self.blob, self.missing_objects(destination), "Fixture must begin with a missing blob")
        return destination

    def missing_objects(self, repo):
        # Probe itself must not hydrate the repository being measured.
        env = {**self.environment, "GIT_NO_LAZY_FETCH": "1", "GIT_NO_REPLACE_OBJECTS": "1"}
        return self.git(repo, "rev-list", "--objects", "--all", "--missing=print", env=env).stdout.decode().splitlines()

    @staticmethod
    def archived_bytes(raw):
        with tarfile.open(fileobj=io.BytesIO(raw), mode="r:") as archive:
            return archive.extractfile(RELATIVE_FILE).read()

    @staticmethod
    def trace_events(path):
        return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]

    @staticmethod
    def fetch_children(events):
        return [event for event in events if event.get("event") == "child_start"
                and any(argument in {"fetch", "fetch-pack", "upload-pack", "git-upload-pack"}
                        for argument in event.get("argv", []))]

    @contextmanager
    def driver_environment(self, *, trace=None, graft=None):
        environment = dict(self.environment)
        if trace is not None:
            environment["GIT_TRACE2_EVENT"] = str(trace)
        if graft is not None:
            environment["GIT_GRAFT_FILE"] = str(graft)
        with patch.dict(os.environ, environment, clear=True):
            yield

    def test_missing_promisor_blob_cannot_hydrate_or_emit_output(self):
        # First establish the exact hazard using reachable file-only transport.
        control = self.partial_clone("unguarded")
        control_trace = self.root / "unguarded.trace.jsonl"
        env = {**self.environment, "GIT_TRACE2_EVENT": str(control_trace)}
        raw = self.git(control, "archive", "--format=tar", self.commit, "fixture", env=env).stdout
        self.assertEqual(self.archived_bytes(raw), ORIGINAL)
        self.assertNotIn("?" + self.blob, self.missing_objects(control), "Unguarded control must really hydrate")
        self.assertTrue(self.fetch_children(self.trace_events(control_trace)), "Unguarded control must start a fetch child")

        # A distinct clone starts cold, so the control cannot warm the test input.
        guarded = self.partial_clone("guarded")
        trace = self.root / "guarded.trace.jsonl"
        destination = self.root / "guarded-output"
        missing_before = self.missing_objects(guarded)
        error = None
        with self.driver_environment(trace=trace):
            try:
                DRIVER.extract(guarded, self.commit, ["fixture"], destination)
            except DRIVER.ProofError as caught:
                error = caught
        # Separate observations expose every effect on the old driver.
        with self.subTest(observation="reject missing object"):
            self.assertIsNotNone(error, "Missing committed blob must fail closed")
        with self.subTest(observation="no hydration"):
            self.assertEqual(self.missing_objects(guarded), missing_before, "Driver hydrated missing input")
        with self.subTest(observation="no fetch child"):
            events = self.trace_events(trace)
            self.assertTrue(any(event.get("event") == "start" for event in events), "Git trace coverage is required")
            self.assertEqual(self.fetch_children(events), [], "Driver launched a fetch child")
        with self.subTest(observation="no output"):
            self.assertFalse(destination.exists(), "Missing input produced extracted output")

    def test_replacement_reference_cannot_change_pinned_bytes(self):
        replacement = self.commit_bytes(CHANGED, "replacement")
        self.git(self.repo, "replace", self.commit, replacement)
        raw = self.git(self.repo, "archive", "--format=tar", self.commit, "fixture").stdout
        self.assertEqual(self.archived_bytes(raw), CHANGED, "Unguarded control must observe replacement tree")
        destination = self.root / "replacement-output"
        with self.driver_environment():
            DRIVER.extract(self.repo, self.commit, ["fixture"], destination)
        self.assertEqual((destination / RELATIVE_FILE).read_bytes(), ORIGINAL)

    def test_repository_and_environment_grafts_cannot_rewrite_pinned_ancestry(self):
        child = self.commit_bytes(CHANGED, "child")
        original_parents = (child + " " + self.commit).encode()
        for mode in ("repository", "environment"):
            with self.subTest(graft=mode):
                if mode == "environment":
                    (self.repo / ".git/info/grafts").unlink()
                path = self.repo / ".git/info/grafts" if mode == "repository" else self.root / "fixture.grafts"
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(child + "\n", encoding="ascii")
                env = self.environment if mode == "repository" else {**self.environment, "GIT_GRAFT_FILE": str(path)}
                control = self.git(self.repo, "rev-list", "--parents", "-n", "1", child, env=env).stdout.strip()
                self.assertEqual(control, child.encode(), "Unguarded graft must remove the real parent")
                with self.driver_environment(graft=path if mode == "environment" else None):
                    observed = DRIVER.git(self.repo, "rev-list", "--parents", "-n", "1", child).strip()
                self.assertEqual(observed, original_parents, "Driver used grafted ancestry")

    def test_missing_commit_fails_without_output_or_fetch(self):
        destination = self.root / "missing-commit-output"
        trace = self.root / "missing-commit.trace.jsonl"
        with self.driver_environment(trace=trace):
            with self.assertRaises(DRIVER.ProofError) as raised:
                DRIVER.extract(self.repo, "f" * 40, ["fixture"], destination)
        self.assertFalse(destination.exists())
        self.assertNotIn(str(self.root), str(raised.exception), "Public errors must omit local paths")
        events = self.trace_events(trace)
        self.assertTrue(events, "Git trace coverage is required")
        self.assertEqual(self.fetch_children(events), [])

    def test_complete_local_commit_extracts_original_bytes_despite_dirty_worktree(self):
        (self.repo / RELATIVE_FILE).write_bytes(b"uncommitted bytes must not become evidence\n")
        destination = self.root / "complete-output"
        trace = self.root / "complete.trace.jsonl"
        with self.driver_environment(trace=trace):
            archive_digest = DRIVER.extract(self.repo, self.commit, ["fixture"], destination)
        self.assertRegex(archive_digest, r"^[0-9a-f]{64}$")
        self.assertEqual((destination / RELATIVE_FILE).read_bytes(), ORIGINAL)
        self.assertEqual(self.fetch_children(self.trace_events(trace)), [])


if __name__ == "__main__":
    unittest.main()
