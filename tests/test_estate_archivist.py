"""Synthetic repositories only; no network, estate scripts or source imports."""
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / "tools" / "estate_archivist.py"
spec = importlib.util.spec_from_file_location("archivist", MODULE)
archivist = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archivist)


class ArchaeologyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / "private-workstation-name"
        self.repo.mkdir()
        self.git("init", "-q")
        self.git("config", "user.name", "Synthetic Tester")
        self.git("config", "user.email", "synthetic@example.invalid")

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.repo), *args], stderr=subprocess.DEVNULL).decode().strip()

    def write(self, path, value):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(value, encoding="utf-8")

    def commit(self):
        self.git("add", "-A")
        self.git("commit", "-qm", "synthetic history")
        return self.git("rev-parse", "HEAD")

    def state(self, public_head=None, extra_tips=()):
        head = public_head or self.git("rev-parse", "HEAD")
        return archivist.start(self.repo, {"repository": "public/example", "head": head,
                                          "tips": [head, *extra_tips]})

    def test_deleted_renamed_dedup_and_resume(self):
        self.write("old.py", "import json\ndef work():\n    return 1\n")
        self.write("deleted.py", "# historical only\n")
        first = self.commit()
        self.git("mv", "old.py", "new.py")
        self.git("rm", "deleted.py")
        self.write("copy.py", (self.repo / "new.py").read_text())
        self.write(".github/workflows/check.yml", "jobs: {}\n")
        second = self.commit()
        state = self.state()
        real_git = archivist.git
        reads = []
        def spy(repo, *args):
            if args[:2] == ("cat-file", "blob"):
                reads.append(args[2])
            return real_git(repo, *args)
        with patch.object(archivist, "git", side_effect=spy):
            result = archivist.advance(self.repo, state, max_commits=1, max_blobs=1)
            self.assertFalse(result["coverage"]["traversal_complete"])
            state = json.loads(json.dumps(state))  # persisted/resumed shape
            for _ in range(4):
                result = archivist.advance(self.repo, state, max_commits=1, max_blobs=1)
        self.assertEqual(len(reads), len(set(reads)))
        self.assertEqual(len(reads), 3)
        self.assertEqual(result["coverage"]["blob_status_counts"]["pending"], 0)
        observed = {o["path"]: o for b in result["blobs"] for o in b["observations"]}
        self.assertTrue(observed["deleted.py"]["path_absent_at_public_head"])
        self.assertTrue(observed["old.py"]["path_absent_at_public_head"])
        self.assertTrue(observed["new.py"]["current_public_head"])
        shared = next(b for b in result["blobs"] if len(b["observations"]) == 3)
        self.assertEqual({o["path"] for o in shared["observations"]}, {"old.py", "new.py", "copy.py"})
        self.assertEqual({o["commit"] for o in shared["observations"]}, {first, second})

    def test_private_ref_body_and_workstation_never_exported_or_executed(self):
        sentinel = self.repo / "executed"
        self.write("public.py", "from pathlib import Path\nPath('executed').write_text('BAD')\n# PRIVATE BODY STRING\n")
        public = self.commit()
        self.git("checkout", "-qb", "sensitive-ref-name")
        self.write("private-customer.py", "# confidential-local-only\n")
        private = self.commit()
        result = archivist.advance(self.repo, self.state(public))
        serialized = json.dumps(result)
        for secret in (str(self.repo), "private-workstation-name", "PRIVATE BODY STRING", "sensitive-ref-name", "private-customer", private):
            self.assertNotIn(secret, serialized)
        self.assertFalse(sentinel.exists())
        self.assertEqual(result["coverage"]["public_reachability_unproven_commits"], 1)

    def test_current_and_historical_content_versions_remain_distinct(self):
        self.write("changing.py", "x = 1\n")
        self.commit()
        self.write("changing.py", "x = 2\n")
        self.commit()
        result = archivist.advance(self.repo, self.state())
        rows = [o for b in result["blobs"] for o in b["observations"]]
        self.assertEqual(len(rows), 2)
        self.assertEqual(sum(o["current_public_head"] for o in rows), 1)
        self.assertTrue(all(not o["path_absent_at_public_head"] for o in rows))

    def test_missing_tip_blob_and_oversize_are_explicit(self):
        self.write("small.py", "x=1\n")
        self.write("large.py", "#" * 100)
        self.commit()
        state = self.state(extra_tips=("f" * 40,))
        oid = self.git("rev-parse", "HEAD:small.py")
        object_path = self.repo / ".git" / "objects" / oid[:2] / oid[2:]
        object_path.chmod(0o600)
        object_path.unlink()  # deliberate synthetic corruption
        result = archivist.advance(self.repo, state, max_bytes=10)
        self.assertEqual(result["coverage"]["unavailable_public_tips"], 1)
        self.assertEqual(result["coverage"]["blob_status_counts"]["unavailable"], 1)
        self.assertEqual(result["coverage"]["blob_status_counts"]["excluded_oversize"], 1)

    def test_exclusions_and_invalid_source_syntax(self):
        self.write("vendor/skip.py", "raise SystemExit()")
        self.write("ordinary.txt", "secret")
        self.write("broken.py", "def invalid(\n")
        self.commit()
        result = archivist.advance(self.repo, self.state())
        self.assertEqual(result["coverage"]["distinct_selected_blobs"], 1)
        self.assertEqual(result["blobs"][0]["python"]["parse"], "unavailable")
        self.assertEqual(result["coverage"]["excluded_tree_entries"], 2)
        for path in ("/absolute.py", "../escape.py", "C:/private.py", "bad\npath.py", "a\\b.py"):
            self.assertFalse(archivist.selected(path))

    def test_unavailable_current_tree_is_unknown_not_absent(self):
        self.write("available.py", "x=1\n")
        head = self.commit()
        state = archivist.start(self.repo, {"repository": "public/example", "head": "f" * 40, "tips": [head]})
        result = archivist.advance(self.repo, state)
        self.assertFalse(result["coverage"]["public_head_tree_available"])
        self.assertIsNone(result["blobs"][0]["observations"][0]["current_public_head"])


if __name__ == "__main__":
    unittest.main()
