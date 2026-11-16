"""Synthetic Git fixtures; no network, source execution, or personal data."""
import copy
import hashlib
import subprocess
import tempfile
import unittest
from pathlib import Path

from verify_pins import PinError, verify


class PinTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git("init", "-q")
        (self.root / "module.py").write_bytes(b'raise RuntimeError("never execute inspected source")\n')
        self.git("add", "module.py")
        self.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture")
        self.commit = self.git("rev-parse", "HEAD")
        self.pin = {"repository": "fixture/source", "commit": self.commit, "path": "module.py",
                    "blob": self.git("rev-parse", "HEAD:module.py"),
                    "sha256": hashlib.sha256((self.root / "module.py").read_bytes()).hexdigest()}
        self.receipt = {"schema": "testcode.cartographer-pins.v1", "pins": [self.pin]}
        self.roots = {"fixture/source": self.root}

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.root), *args], stderr=subprocess.DEVNULL).decode().strip()

    def test_actual_blob_proof_does_not_execute_source(self):
        result = verify(self.receipt, self.roots)
        self.assertEqual(result["pins_checked"], 1)
        self.assertEqual(result["executed_source_files"], 0)
        self.assertEqual(result["runtime_acceptance"], "UNVERIFIED")

    def test_dirty_worktree_cannot_change_pinned_evidence(self):
        (self.root / "module.py").write_text("different source")
        self.assertEqual(verify(self.receipt, self.roots)["status"], "PASS")

    def test_missing_repo_is_failure(self):
        with self.assertRaises(PinError):
            verify(self.receipt, {})

    def test_missing_object_is_failure_without_local_path(self):
        self.pin["commit"] = "f" * 40
        with self.assertRaises(PinError) as raised:
            verify(self.receipt, self.roots)
        self.assertNotIn(str(self.root), str(raised.exception))

    def test_wrong_bytes_and_blob_and_path_rejected(self):
        for field, value in (("sha256", "0" * 64), ("blob", "0" * 40), ("path", "missing.py")):
            with self.subTest(field=field):
                receipt = copy.deepcopy(self.receipt)
                receipt["pins"][0][field] = value
                with self.assertRaises(PinError):
                    verify(receipt, self.roots)

    def test_empty_and_duplicate_coverage_rejected(self):
        for pins in ([], [self.pin, self.pin]):
            with self.assertRaises(PinError):
                verify({"schema": self.receipt["schema"], "pins": pins}, self.roots)

    def test_unsafe_paths_rejected_before_git(self):
        for value in ("../module.py", "/module.py", "C:/module.py", "x\\y", "x//y", "-option", "x\ny"):
            with self.subTest(value=value):
                self.pin["path"] = value
                with self.assertRaisesRegex(PinError, "relative path"):
                    verify(self.receipt, self.roots)

    def test_branch_name_cannot_replace_full_commit(self):
        self.pin["commit"] = "HEAD"
        with self.assertRaises(PinError):
            verify(self.receipt, self.roots)

    def test_blob_cannot_impersonate_commit(self):
        self.pin["commit"] = self.pin["blob"]
        with self.assertRaisesRegex(PinError, "not a commit"):
            verify(self.receipt, self.roots)

    def test_unknown_fields_rejected(self):
        self.pin["local_path"] = "never exported"
        with self.assertRaises(PinError):
            verify(self.receipt, self.roots)

    def test_partial_clone_missing_blob_never_fetches(self):
        # A real promisor clone: Git normally fetches this blob on cat-file.
        # Keep the remote reachable so a missing-object failure cannot merely
        # be caused by a broken transport or unavailable fixture server.
        self.git("config", "uploadpack.allowFilter", "true")
        partial = self.root / "partial-clone"
        subprocess.run(
            ["git", "clone", "-q", "--filter=blob:none", "--no-checkout",
             self.root.as_uri(), str(partial)], check=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )

        def missing_objects():
            return subprocess.check_output(
                ["git", "-C", str(partial), "rev-list", "--objects", "--all",
                 "--missing=print"], stderr=subprocess.DEVNULL,
            ).decode().splitlines()

        missing_blob = "?" + self.pin["blob"]
        self.assertIn(missing_blob, missing_objects())
        with self.assertRaises(PinError):
            verify(self.receipt, {"fixture/source": partial})
        self.assertIn(missing_blob, missing_objects(), "verifier fetched a missing blob")

    def test_replacement_commit_cannot_substitute_a_different_tree(self):
        changed = b"replacement tree must not impersonate pinned commit\n"
        (self.root / "module.py").write_bytes(changed)
        self.git("add", "module.py")
        self.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
                 "commit", "-qm", "replacement fixture")
        replacement = self.git("rev-parse", "HEAD")
        self.pin["blob"] = self.git("rev-parse", "HEAD:module.py")
        self.pin["sha256"] = hashlib.sha256(changed).hexdigest()
        self.git("replace", self.commit, replacement)
        # Pin now describes the replacement's bytes but the original commit.
        with self.assertRaisesRegex(PinError, "path/blob mismatch"):
            verify(self.receipt, self.roots)


if __name__ == "__main__":
    unittest.main()
