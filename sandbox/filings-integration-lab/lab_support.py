"""Load only byte-pinned producer modules. No network or source activation."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import types

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "inputs.json"


class InputClosureError(ValueError):
    pass


def input_root(root=None):
    value = root if root is not None else os.environ.get("FILINGS_LAB_INPUTS")
    if not value:
        raise InputClosureError("FILINGS_LAB_INPUTS is required; inputs are never silently skipped")
    return Path(value).resolve()


def manifest():
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def verify_inputs(root=None):
    root = input_root(root)
    receipt = []
    for name, component in manifest()["components"].items():
        for relative, expected in component["files"].items():
            path = root / name / relative
            if not path.is_file() or path.is_symlink():
                raise InputClosureError(f"Missing or symlinked input: {name}/{relative}")
            if not path.resolve().is_relative_to(root):
                raise InputClosureError(f"Input escapes closure: {name}/{relative}")
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest != expected:
                raise InputClosureError(f"Input hash mismatch: {name}/{relative}")
        receipt.append({"component": name, "repository": component["repository"],
                        "commit": component["commit"], "files": component["files"]})
    return receipt


def load_component(name):
    components = manifest()["components"]
    if name not in components:
        raise InputClosureError("Unknown component")
    verify_inputs()
    component = components[name]
    path = input_root() / name / component["module"]
    # Execute the bytes just checked, not a stale __pycache__ from a checkout.
    source = path.read_bytes()
    if hashlib.sha256(source).hexdigest() != component["files"][component["module"]]:
        raise InputClosureError("Module changed after closure verification")
    module = types.ModuleType("filings_lab_" + name)
    module.__file__ = str(path)
    exec(compile(source, str(path), "exec"), module.__dict__)
    return module
