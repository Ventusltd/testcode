"""PipelineNews release builder — one timestamp, one discovery cartridge.

THE ARCHITECTURE THIS IMPLEMENTS
--------------------------------
Take a working app. Stamp a new timestamp. Add ONE discovery cartridge to the
UI. If the result is wrong, do not debug it — build again from an earlier
timestamp. Every timestamp is a complete working app, because the file sizes
are trivial and the UI is the control surface.

Rollback is therefore not a git operation, an undo, or a revert. It is
`--from` an earlier timestamp. Nothing is ever edited in place: releases are
`immutable_after_publication`.

    python release_builder.py --list
    python release_builder.py --from 202608300309-pipelinenews --cartridge project-intelligence
    python release_builder.py --check 202608311304-pipelinenews

`--gen` defaults to the current UTC minute, read from the clock and never
chosen, because cvaa's monotonic-utc-generations vaccine requires a generation
within 15 minutes of its commit time and says generations are read, not picked.

A cartridge package is a directory containing:
    cartridge.json      the manifest: files, the UI section, the loader
    assets/*            files copied into the release's assets/
    data/*              files copied into the release's data/

Pure stdlib. No network. No git operation. Writes only a NEW release directory.
"""

import argparse
import atexit
import contextlib
import datetime
import hashlib
import io
import json
import os
import re
import shutil
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
# tools/intelligence/ -> repo root -> releases/
REPO = os.path.dirname(os.path.dirname(HERE))
RELEASES = os.path.join(REPO, "releases")
CARTRIDGES = os.path.join(HERE, "cartridges")

APP = "assets/202608291447-app.mjs"
REGISTRY = "data/202608291447-registry.json"
ANALYTICS_ANCHOR = '    <h2 class="section-title">REPD PIPELINE ANALYTICS</h2>'
# This is the one stable core binding in every current release. Earlier builds
# inserted every new cartridge after bindFederatedRelationships(), which made
# the builder unable to extend a release once that rejected panel was
# deliberately withdrawn. A withdrawn optional surface cannot be the extension
# point for the application.
BOOT_BIND_ANCHOR = "  bindSectorIntelligence();"
RELEASE_ID_RE = re.compile(r"^[0-9]{12}-pipelinenews$")
LEGACY_ROOT_RELEASE_ID = "202608291447-pipelinenews"
LEGACY_ROOT_SCHEMA = "pipelinenews.timestamp-folder-successor.v1"


# --------------------------------------------------------------------- utils

def utc_stamp():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H%M")


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


# Text assets are hashed as they are PUBLISHED, which is LF: the sums are
# generated from LF content and GitHub Pages serves those bytes. A Windows
# checkout with core.autocrlf=true writes CRLF into the working copy, so
# hashing the file on disk disagrees with every published digest and --check
# fails on a release nobody has touched. Measured on 202608312018: 48 of 55
# files "mismatched", none of them actually wrong.
#
# The browser hashes what the server sends, so this is the comparison that
# means anything. Same defect, same fix, as the GridAtlas release verifier.
def sha256_published(path):
    return hashlib.sha256(published_bytes(path)).hexdigest()


# Six of the thirty-one ledgered releases fail their own `--check` today, and
# every one of the ten mismatched entries is this defect:
#
#   releases/202608311530 .. 202608311610  grid-proximity.mjs + its sidecar
#   releases/202608312018                  atlas-pointer-deep-link.mjs
#
# For all ten, sha256(bytes.replace(LF, CRLF)) equals the recorded digest
# exactly. The bytes GitHub Pages serves are LF and are correct; the LEDGER
# names bytes that were never served. The digests were taken on a Windows
# working copy before `.gitattributes` forced LF, by hashing the file on disk.
#
# normalise_to_lf() and `.gitattributes` between them mean the tree is already
# LF by the time any digest is recorded, so on a current checkout this helper
# returns the same bytes sha256_file() would have hashed. That is the point: it
# is no longer possible for the answer to depend on whose machine ran the build.
def published_bytes(path):
    """The bytes this file ships as: LF for text, untouched for everything else."""
    with open(path, "rb") as fh:
        raw = fh.read()
    if os.path.splitext(path)[1].lower() not in TEXT_EXT:
        return raw
    return raw.replace(b"\r\n", b"\n")


def published_size(path):
    return len(published_bytes(path))


def read(p):
    # Applicability walks every manifest and registry in an ancestry. Closing
    # each handle immediately avoids retaining two descriptors per generation.
    with io.open(p, encoding="utf-8") as stream:
        return stream.read()


def write(p, t):
    io.open(p, "w", encoding="utf-8", newline="").write(t)


def walk(root):
    out = []
    for base, _d, names in os.walk(root):
        for n in names:
            out.append(os.path.relpath(os.path.join(base, n), root).replace("\\", "/"))
    return sorted(out)


# Text extensions git stores with LF. Anything not listed is left untouched,
# because a stray byte change in a parquet or an image is a corruption.
TEXT_EXT = {".html", ".htm", ".css", ".js", ".mjs", ".json", ".txt", ".md",
            ".yml", ".yaml", ".csv", ".svg", ".sha256", ".geojson"}


def normalise_to_lf(root):
    """Rewrite CRLF to LF across a copied release tree.

    THIS IS NOT COSMETIC. A Windows checkout holds CRLF; git holds LF; and the
    release manifests record the LF byte counts and SHA-256 digests. Copying
    the working tree therefore produces a release whose every inherited file is
    a few hundred bytes larger than its own manifest says, and the repository's
    Pages gate rejects it — correctly.

    Measured on a real build: app.mjs +2,823 bytes, index.html +935, and 35
    records mismatched in total. Nothing in the release was wrong except the
    line endings, and no verifier in this suite caught it, because they all
    hashed the same wrong bytes consistently.
    """
    fixed = 0
    for rel in walk(root):
        if os.path.splitext(rel)[1].lower() not in TEXT_EXT:
            continue
        path = os.path.join(root, rel)
        with open(path, "rb") as fh:
            raw = fh.read()
        if b"\r\n" not in raw:
            continue
        with open(path, "wb") as fh:
            fh.write(raw.replace(b"\r\n", b"\n"))
        fixed += 1
    if fixed:
        print("  normalised %d text files to LF (matching what git stores)" % fixed)
    return fixed


def refresh_sha256_sidecars(target):
    """Rewrite every `<file>.sha256` to attest the file as it now stands.

    A cartridge ships its payload as `{GEN}-thing.json` plus a sidecar digest,
    and the build substitutes {GEN} in BOTH -- which changes the payload's
    bytes after the sidecar was written. The sidecar then attests a file that
    no longer exists, and nothing catches it: app.mjs verifies against the
    registry digest, and sha256sums.txt is regenerated from scratch.

    Measured on 202608311610: the shipped grid-proximity sidecar said
    c6ef7879..., the file hashed 49aaf5c3.... A file whose only job is to
    attest its neighbour, getting its neighbour wrong, is worse than no file.
    Published releases are immutable, so that one stays as it is; this repairs
    it going forward, for inherited sidecars as well as new ones.
    """
    fixed = 0
    for rel in walk(target):
        if not rel.endswith(".sha256"):
            continue
        subject = rel[:-len(".sha256")]
        subject_abs = os.path.join(target, subject)
        if not os.path.exists(subject_abs):
            continue
        path = os.path.join(target, rel)
        want = sha256_published(subject_abs)
        line = "%s  %s\n" % (want, os.path.basename(subject))
        if read(path) != line:
            write(path, line)
            fixed += 1
            print("    %s now attests %s" % (rel, want[:12]))
    print("  %d sha256 sidecar(s) rewritten" % fixed)
    return fixed


def refresh_build_manifest(target, release_id):
    """Recompute every byte count and digest the build manifest records.

    The manifest is inherited from the parent, so every file this build changed
    -- index.html, app.mjs, the registry, the atlas link manifest -- still
    carries the parent's numbers until they are rewritten here. Leaving them
    stale is what a hash-verified release is specifically designed to catch.
    """
    path = os.path.join(target, "build-manifest.json")
    if not os.path.exists(path):
        return 0
    doc = json.loads(read(path))

    def visit(node):
        count = 0
        if isinstance(node, dict):
            if "path" in node and isinstance(node.get("path"), str):
                f = os.path.join(target, node["path"])
                if os.path.exists(f):
                    if "bytes" in node:
                        node["bytes"] = published_size(f)
                        count += 1
                    if "sha256" in node:
                        node["sha256"] = sha256_published(f)
            for v in node.values():
                count += visit(v)
        elif isinstance(node, list):
            for v in node:
                count += visit(v)
        return count

    updated = visit(doc)
    write(path, json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    print("  refreshed %d records in build-manifest.json" % updated)
    return updated


def apply_once(text, old, new, label, expect=1):
    n = text.count(old)
    if n != expect:
        raise SystemExit("PATCH FAILED [%s]: expected %d, found %d" % (label, expect, n))
    print("    %-52s %d" % (label, n))
    return text.replace(old, new)


def releases():
    if not os.path.isdir(RELEASES):
        return []
    out = []
    for name in sorted(os.listdir(RELEASES)):
        d = os.path.join(RELEASES, name)
        if os.path.isdir(d) and os.path.exists(os.path.join(d, "index.html")):
            out.append(name)
    return out


# ---------------------------------------------------------------------- list

def cmd_list():
    rel = releases()
    if not rel:
        print("no releases found in %s" % RELEASES)
        return 1
    print("Rollback points — every one is a complete working app.\n")
    print("  %-34s %-8s %-9s %s" % ("RELEASE", "FILES", "CARTRIDGES", "ADDED PANELS"))
    for name in rel:
        d = os.path.join(RELEASES, name)
        files = walk(d)
        reg_path = os.path.join(d, REGISTRY)
        panels = []
        if os.path.exists(reg_path):
            try:
                sup = json.loads(read(reg_path)).get("supplemental_assets") or {}
                panels = sorted(sup.keys())
            except ValueError:
                panels = ["<unreadable registry>"]
        print("  %-34s %-8d %-9d %s"
              % (name, len(files), len(panels), ", ".join(panels) or "—"))
    print("\nBuild from any of them:")
    print("  python release_builder.py --from %s --cartridge <name>" % rel[-1])

    # "Available" used to mean "there is a directory here", and that is not the
    # same question as "can this be built". Measured against 202609030009 on
    # 2026-09-03: of the nineteen listed, fifteen were already in the release
    # and the other four could not apply at all -- their patch anchors had been
    # rewritten by later cartridges. Nothing was buildable, and the listing said
    # nothing about it. The key check below is exact and free; the anchor check
    # costs a build each, so it lives behind --applicable.
    print("\nCartridges, against %s:" % rel[-1])
    if os.path.isdir(CARTRIDGES):
        applied = set(cartridge_keys(rel[-1]))
        for c in sorted(os.listdir(CARTRIDGES)):
            man = os.path.join(CARTRIDGES, c, "cartridge.json")
            if not os.path.exists(man):
                continue
            m = json.loads(read(man))
            mark = "applied" if m.get("key") in applied else "new    "
            print("  [%s] %-26s %s" % (mark, c, m.get("summary", "")))
        print("\n  [applied] is exact. [  new  ] means only that the key is absent;")
        print("  whether its patches still anchor is a different question:")
        print("    python release_builder.py --applicable %s" % rel[-1])
    else:
        print("  (none — create %s/<name>/cartridge.json)" % CARTRIDGES)
    return 0


def cartridge_keys(release_id):
    """Every cartridge key applied anywhere in a release's ancestry.

    Registered cartridges are visible in ``supplemental_assets``. Repair-only
    cartridges intentionally register no asset, so their only durable identity
    is the ``cartridge_added`` field in the release manifest that applied them.
    Looking at the tip registry alone therefore made ``--applicable`` probe an
    already-applied repair forever. A replacement edit can be idempotent, so the
    probe may even appear to succeed while changing nothing.

    An incomplete ancestry is not evidence that a cartridge is new. Missing or
    malformed records and cycles consequently stop the command before it can
    perform a throwaway build.
    """
    keys = set()
    seen = set()
    current = release_id

    while current is not None:
        if not isinstance(current, str) or not RELEASE_ID_RE.fullmatch(current):
            raise SystemExit("malformed release id in applicability ancestry: %r"
                             % current)
        if current in seen:
            raise SystemExit("cycle in applicability ancestry at %s" % current)
        seen.add(current)

        release_dir = os.path.join(RELEASES, current)
        if not os.path.isdir(release_dir):
            raise SystemExit("missing release in applicability ancestry: %s" % current)

        manifest_path = os.path.join(release_dir, "release-manifest.json")
        if not os.path.isfile(manifest_path):
            raise SystemExit("missing release manifest in applicability ancestry: %s"
                             % current)
        try:
            manifest = json.loads(read(manifest_path))
        except (OSError, ValueError) as error:
            raise SystemExit("malformed release manifest in applicability ancestry "
                             "%s: %s" % (current, error))
        if not isinstance(manifest, dict):
            raise SystemExit("malformed release manifest in applicability ancestry "
                             "%s: expected object" % current)
        if manifest.get("release_id") != current:
            raise SystemExit("malformed release manifest in applicability ancestry "
                             "%s: release_id is %r" %
                             (current, manifest.get("release_id")))

        added = manifest.get("cartridge_added")
        if added is not None:
            if (not isinstance(added, str) or not added.strip()
                    or added != added.strip()):
                raise SystemExit("malformed cartridge_added in applicability ancestry "
                                 "%s: %r" % (current, added))
            keys.add(added)

        registry_path = os.path.join(release_dir, REGISTRY)
        if not os.path.isfile(registry_path):
            raise SystemExit("missing registry in applicability ancestry: %s" % current)
        try:
            registry = json.loads(read(registry_path))
        except (OSError, ValueError) as error:
            raise SystemExit("malformed registry in applicability ancestry %s: %s"
                             % (current, error))
        if not isinstance(registry, dict):
            raise SystemExit("malformed registry in applicability ancestry %s: "
                             "expected object" % current)
        supplemental = registry.get("supplemental_assets")
        if not isinstance(supplemental, dict):
            raise SystemExit("malformed supplemental_assets in applicability ancestry "
                             "%s: expected object" % current)
        malformed_keys = [key for key in supplemental
                          if (not isinstance(key, str) or not key.strip()
                              or key != key.strip())]
        if malformed_keys:
            raise SystemExit("malformed supplemental asset key in applicability ancestry "
                             "%s: %r" % (current, malformed_keys[0]))
        malformed_entries = [key for key, entry in supplemental.items()
                             if not isinstance(entry, dict)]
        if malformed_entries:
            key = malformed_entries[0]
            raise SystemExit("malformed supplemental asset entry in applicability "
                             "ancestry %s: %s is %s, expected object"
                             % (current, key, type(supplemental[key]).__name__))
        keys.update(supplemental)

        parent = manifest.get("parent_release_id")
        if parent is None:
            is_legacy_root = (current == LEGACY_ROOT_RELEASE_ID
                              and manifest.get("schema") == LEGACY_ROOT_SCHEMA)
            if not is_legacy_root:
                state = "null" if "parent_release_id" in manifest else "missing"
                raise SystemExit("%s parent_release_id in applicability ancestry %s; "
                                 "only legacy root %s (%s) may terminate the chain"
                                 % (state, current, LEGACY_ROOT_RELEASE_ID,
                                    LEGACY_ROOT_SCHEMA))
            break
        if not isinstance(parent, str) or not RELEASE_ID_RE.fullmatch(parent):
            raise SystemExit("malformed parent_release_id in applicability ancestry "
                             "%s: %r" % (current, parent))
        if current == LEGACY_ROOT_RELEASE_ID:
            raise SystemExit("legacy applicability root %s must not declare a parent"
                             % current)
        if parent == current:
            raise SystemExit("parent release generation is not strictly older in "
                             "applicability ancestry: %s -> %s" % (current, parent))
        if parent in seen:
            raise SystemExit("cycle in applicability ancestry: %s -> %s"
                             % (current, parent))
        if parent[:12] >= current[:12]:
            raise SystemExit("parent release generation is not strictly older in "
                             "applicability ancestry: %s -> %s" % (current, parent))
        current = parent

    return keys


# --------------------------------------------------------------- applicable

def cmd_applicable(parent_id):
    """Report which cartridges can actually be built onto a parent.

    A cartridge fails to apply when a later cartridge rewrote the text its
    patches anchor on. Nothing in the repository detected that: `--list` showed
    every directory under cartridges/ as available, and the operator found out
    by running a build and watching it discard itself.

    Applied identity comes from the complete release ancestry. For every key
    absent from that ancestry, this answers the remaining anchor question the
    only way it can be answered honestly -- by building it. Every probe writes
    a throwaway release and removes it again; a failed probe is already removed
    by the builder's own discard handler before this function sees it. The
    parent is never modified, and cmd_build asserts that itself.
    """
    if not os.path.isdir(os.path.join(RELEASES, parent_id)):
        raise SystemExit("no such parent release: %s" % parent_id)
    if not os.path.isdir(CARTRIDGES):
        raise SystemExit("no cartridges directory: %s" % CARTRIDGES)

    applied = cartridge_keys(parent_id)
    names = sorted(n for n in os.listdir(CARTRIDGES)
                   if os.path.exists(os.path.join(CARTRIDGES, n, "cartridge.json")))
    print("Cartridges against %s\n" % parent_id)
    print("  each unapplied candidate is built into a throwaway generation and removed again\n")

    rows = []
    for name in names:
        man = json.loads(read(os.path.join(CARTRIDGES, name, "cartridge.json")))
        if man.get("key") in applied:
            rows.append((name, "ALREADY APPLIED", ""))
            continue
        gen = utc_stamp()
        target = os.path.join(RELEASES, "%s-pipelinenews" % gen)
        if os.path.exists(target):
            rows.append((name, "NOT PROBED", "a release already occupies %s" % gen))
            continue
        buffer = io.StringIO()
        try:
            with contextlib.redirect_stdout(buffer):
                cmd_build(parent_id, name, gen, None)
            rows.append((name, "APPLIES", ""))
        except SystemExit as error:
            rows.append((name, "CANNOT APPLY", str(error).splitlines()[0][:120]))
        finally:
            if os.path.isdir(target):
                shutil.rmtree(target, ignore_errors=True)

    for name, verdict, detail in rows:
        print("  %-28s %-16s %s" % (name, verdict, detail))
    tally = Counter(verdict for _n, verdict, _d in rows)
    print()
    for verdict, count in tally.most_common():
        print("  %-16s %d" % (verdict, count))
    if not tally.get("APPLIES"):
        print("\n  Nothing here can be built onto %s. A new generation needs a new"
              % parent_id)
        print("  cartridge, not a rebuild of an existing one.")
    return 0


# --------------------------------------------------------------------- build

def cmd_build(parent_id, cartridge_name, gen, atlas_target):
    parent = os.path.join(RELEASES, parent_id)
    if not os.path.isdir(parent):
        raise SystemExit("no such parent release: %s" % parent)

    pkg = os.path.join(CARTRIDGES, cartridge_name)
    man_path = os.path.join(pkg, "cartridge.json")
    if not os.path.exists(man_path):
        raise SystemExit("no cartridge manifest: %s" % man_path)
    man = json.loads(read(man_path))

    release_id = "%s-pipelinenews" % gen
    target = os.path.join(RELEASES, release_id)
    if os.path.exists(target):
        raise SystemExit("release already exists (immutable): %s\n"
                         "Bump the generation or delete it deliberately." % target)

    # A new timestamp must sort after its parent, or the ordering the whole
    # system relies on runs backwards.
    if gen <= parent_id[:12]:
        raise SystemExit("generation %s is not after parent %s; generations are "
                         "monotonic" % (gen, parent_id[:12]))

    print("Building %s\n  from    %s\n  adding  %s\n" % (release_id, parent_id, cartridge_name))

    before = {p: sha256_file(os.path.join(parent, p)) for p in walk(parent)}
    shutil.copytree(parent, target)
    normalise_to_lf(target)

    # A build that fails part-way must leave NOTHING behind. A half-written
    # release directory looks like a real release to every later command — it
    # has an index.html, so --list shows it and --from will build on it — and
    # the whole rollback model depends on every timestamp being complete.
    # This is not hypothetical: it happened, and the corrupt release carried
    # its parent's registry entry and import while looking fine from outside.
    build_ok = {"done": False}

    def _discard_partial():
        if not build_ok["done"] and os.path.isdir(target):
            shutil.rmtree(target, ignore_errors=True)
            sys.stderr.write("\nbuild failed; discarded partial release %s\n" % release_id)

    atexit.register(_discard_partial)
    print("  %d files carried forward\n" % len(before))

    key = man["key"]
    stamped = {}      # placeholder -> value used across the manifest
    stamped["{GEN}"] = gen

    def sub(text):
        for k, v in stamped.items():
            text = text.replace(k, v)
        return text

    # ---- 1. copy the cartridge's own files -------------------------------
    print("  new files")
    added = []
    for sub_dir in ("assets", "data"):
        src_dir = os.path.join(pkg, sub_dir)
        if not os.path.isdir(src_dir):
            continue
        for name in sorted(os.listdir(src_dir)):
            dest_name = sub(name)
            src_file = os.path.join(src_dir, name)
            dst_file = os.path.join(target, sub_dir, dest_name)

            # {GEN} must be substituted in CONTENT as well as in filenames.
            # The cartridge declares its own generation, and app.mjs asserts
            # cartridge.CONTRACT.generation === entry.generation before it will
            # mount. Leaving the placeholder in the body ships a panel that
            # throws on open and shows "unavailable" — caught by render_proof.
            if os.path.splitext(name)[1].lower() in TEXT_EXT:
                body = io.open(src_file, encoding="utf-8", newline="").read()
                transformed = False
                if "{GEN}" in body:
                    body = sub(body)
                    transformed = True
                # Compose the target switch with generation substitution.
                # The old early `continue` made --atlas-target unreachable for
                # any module that also contained {GEN}; a manifest could claim
                # "ported" while its executable still emitted legacy URLs.
                if (atlas_target and name.endswith('.mjs')
                        and 'const ACTIVE_TARGET' in body):
                    body = re.sub(r'const ACTIVE_TARGET = "\w+"',
                                  'const ACTIVE_TARGET = "%s"' % atlas_target,
                                  body)
                    transformed = True
                    print('    (atlas target set to %s)' % atlas_target)
                if transformed:
                    write(dst_file, body)
                    added.append("%s/%s" % (sub_dir, dest_name))
                    print("    %s  (text build inputs applied)" % added[-1])
                    continue
            shutil.copyfile(src_file, dst_file)
            added.append("%s/%s" % (sub_dir, dest_name))
            print("    %s" % added[-1])

    # The parent tree was normalised at line 290, but the cartridge's own files
    # arrive AFTER that, straight from a working copy that Windows checks out
    # with CRLF. They then get hashed as they lie, so sha256sums.txt and the
    # registry attest CRLF bytes while GitHub Pages serves the LF ones git
    # stored. Measured on a clean build of 202608312036: the pointer asset's
    # recorded digest was 2c0eb0e0 and its published digest 9923acba.
    #
    # The browser hashes what the server sends, so the release must attest that.
    # Normalising again here, before any digest is taken, is the whole fix.
    normalise_to_lf(target)

    # ---- 2. index.html : the UI section, plus any declared repairs --------
    print("\n  index.html")
    idx = read(os.path.join(target, "index.html"))
    for rep in man.get("repairs", {}).get("index.html", []):
        idx = apply_once(idx, sub(rep["from"]), sub(rep["to"]), rep["label"],
                         rep.get("expect", 1))
    if man.get("section"):
        idx = apply_once(idx, ANALYTICS_ANCHOR, sub(man["section"]) + ANALYTICS_ANCHOR,
                         "UI section for %s" % key)
    idx = apply_once(idx, "<title>", "<title>", "title tag present", idx.count("<title>"))
    write(os.path.join(target, "index.html"), idx)

    # ---- 3. app.mjs : loader, plus any declared repairs -------------------
    print("\n  %s" % APP)
    app = read(os.path.join(target, APP))
    for rep in man.get("repairs", {}).get("app", []):
        app = apply_once(app, sub(rep["from"]), sub(rep["to"]), rep["label"],
                         rep.get("expect", 1))
    if man.get("loader"):
        app = apply_once(app, "async function boot() {",
                         sub(man["loader"]) + "async function boot() {",
                         "loader for %s" % key)
        app = apply_once(app, BOOT_BIND_ANCHOR,
                         "%s\n  %s" % (BOOT_BIND_ANCHOR, sub(man["bind_call"])),
                         "bind call in boot()")
    write(os.path.join(target, APP), app)

    # ---- 3b. any other shipped asset -------------------------------------
    # index.html and app.mjs were the only files a cartridge could repair, so a
    # fault living in a supplemental module -- the grid proximity dashboard,
    # say -- could not be corrected by a cartridge at all. It is the same
    # operation on a different path, and the path is declared and checked
    # rather than free: it must stay inside the release directory.
    for rep in man.get("repairs", {}).get("assets", []):
        rel = rep["path"]
        full = os.path.normpath(os.path.join(target, rel))
        if not full.startswith(os.path.normpath(target) + os.sep):
            raise SystemExit("asset repair escaped the release: %s" % rel)
        if not os.path.exists(full):
            raise SystemExit("asset repair target missing: %s" % rel)
        print("\n  %s" % rel)
        text = read(full)
        for one in rep["edits"]:
            text = apply_once(text, sub(one["from"]), sub(one["to"]),
                              one["label"], one.get("expect", 1))
        write(full, text)

    # ---- 4. registry -----------------------------------------------------
    print("\n  %s" % REGISTRY)
    reg_path = os.path.join(target, REGISTRY)
    reg = json.loads(read(reg_path))
    # A cartridge that only repairs shipped files registers nothing: there is no
    # new asset to attest. Requiring an entry forced such a cartridge to invent
    # one, which would put a fictitious asset in the registry to satisfy the
    # builder. The repairs are recorded in the build manifest either way.
    if "registry_entry" in man:
        entry = json.loads(sub(json.dumps(man["registry_entry"])))
        for ref in man.get("hash_fields", []):
            node, rel_path = entry, sub(ref["path"])
            for step in ref["at"][:-1]:
                node = node[step]
            abs_path = os.path.join(target, rel_path)
            node[ref["at"][-1]] = sha256_file(abs_path)
            node["bytes"] = os.path.getsize(abs_path)
        if key in reg.get("supplemental_assets", {}):
            raise SystemExit("registry already carries %s" % key)
        reg.setdefault("supplemental_assets", {})[key] = entry
    else:
        print("    no registry entry: this cartridge only repairs shipped files")
    # A registered asset may be retained for provenance while its launcher is
    # withdrawn from a later release. Record that state explicitly; otherwise
    # the verifier cannot distinguish a deliberate withdrawal from a broken
    # host or missing boot binding. Registry repairs are restricted to this
    # small UI-state vocabulary and cannot rewrite asset identity or digests.
    #
    # The vocabulary started at withdrawal alone, and that was too narrow the
    # first time a cartridge changed the SHAPE of a surface instead of removing
    # it. wider-fleet-dropdown replaced twenty appended tabs with one select;
    # the registry entry it inherited went on saying
    # "tabs_in_product_technology_row": true and "appends twenty buttons to
    # #tech", and neither could be corrected. A published attestation that
    # describes a control the release does not draw is worse than no
    # attestation, because it is the file a reader checks the UI against.
    # These fields are descriptive only: none of them names a path, a digest,
    # a byte count, a generation or a schema, so the identity guarantee this
    # restriction exists to protect is untouched.
    allowed_registry_repairs = {
        "ui_state", "ui_withdrawal_reason",
        "control_in_product_technology_row", "deep_linkable", "mutation_scope",
        "presentation", "tabs_in_product_technology_row",
    }
    for repair in man.get("registry_repairs", []):
        other_key = repair.get("key")
        other = (reg.get("supplemental_assets") or {}).get(other_key)
        if not isinstance(other, dict):
            raise SystemExit("registry repair target missing: %s" % other_key)
        updates = repair.get("set") or {}
        forbidden = sorted(set(updates) - allowed_registry_repairs)
        if forbidden:
            raise SystemExit("registry repair fields forbidden for %s: %s"
                             % (other_key, forbidden))
        for field, value in updates.items():
            other[field] = value
        print("    %s UI state -> %s" % (other_key, other.get("ui_state", "unchanged")))
    # Every INHERITED cartridge entry still carries the parent's digest, and
    # the parent's digest was taken from a Windows working copy holding CRLF.
    # normalise_to_lf has since rewritten those files to the LF bytes that
    # actually ship, so the inherited digests now describe bytes no one will
    # ever receive. Measured on 202608311610: the registry claims
    # grid-proximity.mjs is 34,239 bytes (3265e118...), the file on the server
    # is 33,541 (8703fce7...). The build manifest is already re-derived after
    # normalisation for exactly this reason; the registry never was.
    print("    re-deriving inherited digests after LF normalisation")
    for other_key, other in sorted((reg.get("supplemental_assets") or {}).items()):
        for kind in ("cartridge", "payload"):
            node = other.get(kind)
            if not isinstance(node, dict) or "path" not in node:
                continue
            abs_path = os.path.join(target, node["path"])
            if not os.path.exists(abs_path):
                continue
            digest, size = sha256_published(abs_path), published_size(abs_path)
            if node.get("sha256") != digest or node.get("bytes") != size:
                print("      %s.%s  %s -> %s" % (other_key, kind,
                                                 str(node.get("sha256"))[:12], digest[:12]))
                node["sha256"], node["bytes"] = digest, size
            # record_count is the same kind of claim as sha256 and bytes: a statement
            # about the file at `path`. It was not re-derived, so a cartridge that ships
            # a longer payload under an inherited filename left the registry announcing
            # the old count for the new file - the registry describing a file no one will
            # ever receive, which is the exact defect the block above exists to fix.
            # Derived, never repaired: `record_count` is deliberately absent from
            # allowed_registry_repairs, because a count a cartridge can assert is a count
            # that can disagree with the payload.
            if kind == "payload" and "record_count" in node:
                # An unparseable payload is a worse problem than a stale count, and
                # swallowing it would leave the registry asserting the inherited number
                # over a file nobody can read - neither a failure nor a correction.
                try:
                    doc = json.loads(read(abs_path))
                except ValueError as exc:
                    raise SystemExit("payload will not parse, so its record_count cannot "
                                     "be derived: %s (%s)" % (node["path"], exc))
                counted = None
                if isinstance(doc, dict):
                    # Exactly one list-of-records, named or not. Taking the FIRST such
                    # list in dict order would count whichever key the JSON happens to
                    # put first, so a payload carrying both `rows` and `sources` would
                    # produce a confidently wrong number rather than no number. Ambiguity
                    # must fail loudly, not resolve itself by insertion order.
                    candidates = [k for k, v in doc.items()
                                  if isinstance(v, list) and v and isinstance(v[0], dict)]
                    if len(candidates) > 1:
                        raise SystemExit(
                            "cannot derive record_count for %s: %d candidate row lists "
                            "(%s). Name the field rather than trusting key order."
                            % (node["path"], len(candidates), ", ".join(sorted(candidates))))
                    counted = (len(doc[candidates[0]]) if candidates
                               else doc.get("record_count"))
                elif isinstance(doc, list):
                    counted = len(doc)
                if isinstance(counted, int) and node.get("record_count") != counted:
                    print("      %s.%s  record_count %s -> %s"
                          % (other_key, kind, node.get("record_count"), counted))
                    node["record_count"] = counted
    write(reg_path, json.dumps(reg, indent=2, ensure_ascii=False) + "\n")
    print("    supplemental_assets.%s" % key)

    # ---- 5. manifests ----------------------------------------------------
    print("\n  manifests")
    rel = json.loads(read(os.path.join(target, "release-manifest.json")))
    rel.update({
        "schema": "pipelinenews.additive-cartridge-release.v1",
        "generation": gen,
        "release_id": release_id,
        "parent_release_id": parent_id,
        "classification": ("DASHBOARD_MODIFYING_CARTRIDGE"
                           if man.get("modifies_existing_dashboard")
                           else "ADDITIVE_DISCOVERY_CARTRIDGE"),
        "cartridge_added": key,
        "cartridges_present": sorted(reg["supplemental_assets"].keys()),
        # Hard-coding False was true while every cartridge was a self-contained
        # panel. A cartridge that patches the table renderer is not additive,
        # and a manifest that says it is would be the one place a reader goes
        # to find out. The cartridge declares it; the manifest records it.
        "existing_dashboard_modified": bool(man.get("modifies_existing_dashboard")),
        "existing_dashboard_modification": man.get("modification_note") or None,
        "generation_source": "read from UTC clock at build time, never chosen",
        "rollback": "build again with --from an earlier release; nothing is edited in place",
        "immutable_after_publication": True,
        "deployment": "not-authorised",
        "runtime_verified": False,
    })
    if atlas_target:
        rel["atlas_target"] = atlas_target
    write(os.path.join(target, "release-manifest.json"),
          json.dumps(rel, indent=2, sort_keys=True, ensure_ascii=False) + "\n")
    print("    release-manifest.json")

    refresh_sha256_sidecars(target)
    refresh_build_manifest(target, release_id)

    files = [f for f in walk(target) if f != "sha256sums.txt"]
    write(os.path.join(target, "sha256sums.txt"),
          "".join("%s  %s\n" % (sha256_published(os.path.join(target, f)), f) for f in files))
    print("    sha256sums.txt (%d files)" % len(files))

    # ---- 6. the parent must be untouched ---------------------------------
    after = {p: sha256_file(os.path.join(parent, p)) for p in walk(parent)}
    if after != before:
        raise SystemExit("FAIL: the parent release changed. That must never happen.")
    print("\n  %s unchanged (%d files, byte-for-byte)" % (parent_id, len(after)))

    # ---- 7. the release must pass its own check ---------------------------
    # `--check` existed from the beginning and nothing ran it. Six releases
    # shipped with a digest that does not describe their own bytes, and each of
    # them would have been caught here, at the one moment when the answer is
    # still "build it again" rather than "it is immutable now".
    #
    # A failure leaves build_ok False, so the atexit handler above discards the
    # partial release. That is deliberate: a release that cannot verify itself
    # must not exist, because --list will offer it as a parent and every later
    # build will inherit whatever was wrong with it.
    print("\n  ---- proving the release against itself ----\n")
    if cmd_check(release_id) != 0:
        raise SystemExit("FAIL: %s does not pass its own --check. Nothing shipped."
                         % release_id)

    build_ok["done"] = True
    print("\nBuilt %s" % release_id)
    print("  unhappy with it? python release_builder.py --from %s --cartridge <other>"
          % parent_id)
    return 0


# --------------------------------------------------------------------- check

def cmd_check(release_id):
    target = os.path.join(RELEASES, release_id)
    if not os.path.isdir(target):
        raise SystemExit("no such release: %s" % target)
    print("Checking %s\n" % release_id)
    ok = True

    listed = {}
    for line in io.open(os.path.join(target, "sha256sums.txt"), encoding="utf-8"):
        digest, name = line.rstrip("\n").split("  ", 1)
        listed[name] = digest
    actual = {f for f in walk(target) if f != "sha256sums.txt"}
    bad = [n for n, d in listed.items()
           if n in actual and sha256_published(os.path.join(target, n)) != d]
    for label, items in (("unlisted files", sorted(actual - set(listed))),
                         ("listed but absent", sorted(set(listed) - actual)),
                         ("digest mismatch", bad)):
        print("  [%s] %-20s %s" % ("PASS" if not items else "FAIL", label,
                                   "none" if not items else items[:4]))
        ok &= not items

    reg = json.loads(read(os.path.join(target, REGISTRY)))
    idx = read(os.path.join(target, "index.html"))
    app = read(os.path.join(target, APP))
    for key, entry in sorted((reg.get("supplemental_assets") or {}).items()):
        for kind in ("cartridge", "payload"):
            node = entry.get(kind)
            if not node or "path" not in node:
                continue
            p = os.path.join(target, node["path"])
            good = os.path.exists(p) and sha256_published(p) == node.get("sha256")
            print("  [%s] %s.%s digest" % ("PASS" if good else "FAIL", key, kind))
            ok &= good
        withdrawn = entry.get("ui_state") == "WITHDRAWN"
        host = entry.get("host_id")
        if host:
            present = ('id="%s"' % host) in idx
            good = (not present) if withdrawn else present
            expectation = "absent after withdrawal" if withdrawn else "present in UI"
            print("  [%s] %s host %s" % ("PASS" if good else "FAIL", key, expectation))
            ok &= good
        bind = entry.get("bind_call")
        if bind:
            wired = bind in app
            good = (not wired) if withdrawn else wired
            expectation = "absent after withdrawal" if withdrawn else "wired in boot()"
            print("  [%s] %s loader %s" % ("PASS" if good else "FAIL", key, expectation))
            ok &= good
    print()
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true", help="show rollback points and cartridges")
    ap.add_argument("--from", dest="parent", help="parent release id to build from")
    ap.add_argument("--cartridge", help="cartridge package name under cartridges/")
    ap.add_argument("--gen", help="12-digit generation (default: current UTC minute)")
    ap.add_argument("--atlas-target", choices=["legacy", "ported"],
                    help="record which atlas this release points at")
    ap.add_argument("--check", help="verify an existing release")
    ap.add_argument("--applicable", metavar="PARENT",
                    help="report which cartridges can actually be built onto PARENT")
    a = ap.parse_args()

    if a.list:
        return cmd_list()
    if a.check:
        return cmd_check(a.check)
    if a.applicable:
        return cmd_applicable(a.applicable)
    if a.parent and a.cartridge:
        return cmd_build(a.parent, a.cartridge, a.gen or utc_stamp(), a.atlas_target)
    ap.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
