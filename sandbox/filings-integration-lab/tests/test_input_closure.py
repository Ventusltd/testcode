"""Prove the gate rejects absent/tampered inputs rather than skipping them."""
import os
from pathlib import Path
import shutil
import socket
import tempfile
import unittest
from unittest.mock import patch

from lab_support import InputClosureError, input_root, manifest, verify_inputs


class InputClosureTests(unittest.TestCase):
    def test_pins_cover_all_three_components(self):
        self.assertEqual({item["component"] for item in verify_inputs()}, {"west", "asia", "figures"})

    def test_no_default_workstation_inputs(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(InputClosureError):
                verify_inputs()

    def test_missing_component_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(InputClosureError):
                verify_inputs(directory)

    def test_one_byte_mutation_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            copied = Path(directory) / "inputs"
            shutil.copytree(input_root(), copied)
            part = manifest()["components"]["figures"]["module"]
            path = copied / "figures" / part
            path.write_bytes(path.read_bytes() + b"\n# mutation\n")
            with self.assertRaisesRegex(InputClosureError, "hash mismatch"):
                verify_inputs(copied)

    def test_runner_denies_socket_creation_before_any_connection(self):
        # Run through run.py: a direct unittest run lacks this execution gate.
        with self.assertRaisesRegex(RuntimeError, "Network is disabled"):
            socket.socket()
