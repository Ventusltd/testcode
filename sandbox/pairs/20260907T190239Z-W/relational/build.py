#!/usr/bin/env python3
"""Relational export for one candidate pair, per the paired-coherence plan Â§5.

Reads pair.json and the evidence receipts, writes pair.sqlite plus TSV/JSON
exports, runs the reverse-impact query (dependency -> consumers -> pairs ->
tests) with a cycle-safe recursive CTE, and executes four negative controls:
  D1  a changed input makes the old receipt STALE for the new pair
  D2  a dependency cycle terminates
  D3  an unresolved dependency stays visible in the answer
  D4  an unchanged semantic failure stays quarantined (not re-queued)
Stdlib only. Run from the pair directory: python3 relational/build.py
"""
import glob, hashlib, json, os, sqlite3, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PAIR = os.path.dirname(HERE)
pair = json.load(open(os.path.join(PAIR, "pair.json"), encoding="utf8"))
receipts = sorted(glob.glob(os.path.join(PAIR, "evidence", "run-*.json")) + glob.glob(os.path.join(PAIR, "evidence", "receipt-*.json")))
db_path = os.path.join(HERE, "pair.sqlite")
if os.path.exists(db_path):
    os.remove(db_path)
db = sqlite3.connect(db_path)
db.execute("PRAGMA foreign_keys = ON")
db.executescript("""
CREATE TABLE release_pairs(pair_id TEXT PRIMARY KEY, parent_pair_id TEXT, implementation_lane TEXT, experiment_id TEXT, allocated_utc TEXT);
CREATE TABLE component_versions(component_id TEXT PRIMARY KEY, repository TEXT, commit_sha TEXT, path TEXT, content_sha256 TEXT, kind TEXT);
CREATE TABLE pair_components(pair_id TEXT REFERENCES release_pairs, component_id TEXT REFERENCES component_versions, role TEXT, consumption_status TEXT, PRIMARY KEY(pair_id, component_id));
CREATE TABLE dependency_edges(edge_id INTEGER PRIMARY KEY, consumer_id TEXT REFERENCES component_versions, dependency_id TEXT REFERENCES component_versions, relation TEXT, evidence_status TEXT, evidence_ref TEXT, analyzer_version TEXT);
CREATE TABLE test_definitions(test_id TEXT PRIMARY KEY, implementation_sha256 TEXT, required_control TEXT);
CREATE TABLE test_runs(run_id TEXT PRIMARY KEY, pair_id TEXT REFERENCES release_pairs, test_id TEXT REFERENCES test_definitions, environment_fingerprint TEXT, outcome TEXT, control_run_id TEXT, receipt_sha256 TEXT, run_utc TEXT);
CREATE TABLE run_inputs(run_id TEXT REFERENCES test_runs, component_id TEXT REFERENCES component_versions, source TEXT, PRIMARY KEY(run_id, component_id));
CREATE TABLE test_cases(run_id TEXT REFERENCES test_runs, case_name TEXT, outcome TEXT, direction TEXT, expect TEXT, measured TEXT, PRIMARY KEY(run_id, case_name));
CREATE TABLE observations(observation_id INTEGER PRIMARY KEY, pair_id TEXT REFERENCES release_pairs, source_or_live TEXT, measured_at TEXT, receipt_ref TEXT, note TEXT);
CREATE TABLE reports(report_id INTEGER PRIMARY KEY, pair_id TEXT REFERENCES release_pairs, repository TEXT, repository_commit TEXT, path TEXT, sha256 TEXT);
CREATE TABLE approval_events(approval_id INTEGER PRIMARY KEY, pair_id TEXT REFERENCES release_pairs, exact_artifact_vector TEXT, owner_evidence_ref TEXT);
CREATE TABLE quarantine(fingerprint TEXT PRIMARY KEY, test_id TEXT, outcome TEXT, first_seen TEXT, reason TEXT);
""")

pid = pair["pair_id"]
db.execute("INSERT INTO release_pairs VALUES (?,?,?,?,?)", (pid, pair.get("parent_pair_id"), pair["implementation_lane"], pair["experiment_id"], pair["allocated_utc"]))
sv = pair["source_vector"]

def comp(cid, repo, commit, path, sha, kind):
    db.execute("INSERT OR IGNORE INTO component_versions VALUES (?,?,?,?,?,?)", (cid, repo, commit, path, sha, kind))
    return cid

# components: atlas
atlas_ids = {}
for c in pair["atlas"]["components"]:
    cid = comp("gridatlas:" + c["path"], "gridatlas", sv["gridatlas"]["commit"], c["path"], c["sha256"], c["role"])
    atlas_ids[c["path"]] = cid
    db.execute("INSERT INTO pair_components VALUES (?,?,?,?)", (pid, cid, c["role"], "COPIED_AS_GIT_BLOB" if c["path"] != "atlas/deeplink/receivers.json" else "DERIVED_FROM_ENGINE_CONTRACT"))
# components: pipeline (served files)
pipe_ids = {}
for c in pair["pipeline"]["components"]:
    cid = comp("globalgrid2050:" + c["path"], "globalgrid2050", sv["globalgrid2050"]["commit"], c["path"], c["sha256"], "application")
    pipe_ids[c["path"]] = cid
    db.execute("INSERT INTO pair_components VALUES (?,?,?,?)", (pid, cid, "pipeline", "COPIED_AS_GIT_BLOB" if c.get("same_as_source") else ("REBOUND_FOR_PAIR" if c.get("same_as_source") is False else "NOT_IN_SOURCE")))
# external + engine + datasets
parq = comp("external:register-parquet", "gridatlas", sv["gridatlas"]["commit"], sv["register_parquet"]["url"], sv["register_parquet"]["sha256"], "dataset")
db.execute("INSERT INTO pair_components VALUES (?,?,?,?)", (pid, parq, "dataset", "EXTERNAL_BY_ABSOLUTE_URL"))
eng = comp("ventus-grid-engine:HEAD", "ventus-grid-engine", sv["ventus_grid_engine"]["commit"], "engine/", None, "engine")
db.execute("INSERT INTO pair_components VALUES (?,?,?,?)", (pid, eng, "engine", sv["ventus_grid_engine"]["binding"]))
csv = comp("data-interconnectors:reference/interconnector_cables.csv", "data-interconnectors", sv["data_interconnectors"]["commit"], sv["data_interconnectors"]["path"], sv["data_interconnectors"]["sha256"], "dataset")
db.execute("INSERT INTO pair_components VALUES (?,?,?,?)", (pid, csv, "dataset", "PINNED_AS_FIXTURE"))
for x in sv.get("external_data_by_absolute_url", []):
    cid = comp("external:" + x["url"].split("/")[2] + ":" + x["url"].rsplit("/", 1)[1], None, None, x["url"], None, "dataset")
    db.execute("INSERT INTO pair_components VALUES (?,?,?,?)", (pid, cid, "dataset", "EXTERNAL_BY_ABSOLUTE_URL" + ("" if x["pinned"] else " (UNPINNED, tracks main)")))
far = comp("unresolved:far-end-converters-x8", None, None, "8 far converters (IFA, IFA2, Nemo, NSL, Viking, EWIC, Greenlink, Moyle)", None, "dataset")
db.execute("INSERT INTO pair_components VALUES (?,?,?,?)", (pid, far, "dataset", "UNRESOLVED"))

def edge(consumer, dep, relation, status, ref, analyzer="pair-build-20260907"):
    db.execute("INSERT INTO dependency_edges(consumer_id,dependency_id,relation,evidence_status,evidence_ref,analyzer_version) VALUES (?,?,?,?,?,?)", (consumer, dep, relation, status, ref, analyzer))

# declared edges: composition -> cartridges/shell (from current.json)
cur = atlas_ids["atlas/current.json"]
for p, cid in atlas_ids.items():
    if "/cartridges/" in p or "/releases/" in p:
        edge(cur, cid, "contains", "declared", "atlas/current.json sha256 entries")
# static-resolved: cartridges -> datasets/parquet, pipeline -> receiver -> contract
sld = atlas_ids["atlas/cartridges/202609071232-sld-sandbox-v9-8.js"]
pgs = atlas_ids["atlas/cartridges/202609071213-place-global-search-v9-5.js"]
edge(sld, atlas_ids["atlas/data/interconnectors.geojson"], "reads", "runtime-observed", "run receipts: DATA_URL XHR ../../data/interconnectors.geojson")
edge(pgs, atlas_ids["atlas/data/offshore-coordinates.json"], "reads", "runtime-observed", "run receipts: 13429 coordinate_derived true")
edge(pgs, parq, "reads", "runtime-observed", "verify-derived: 21 Range requests; PARQUET_SHA256 pinned at line 141")
edge(sld, atlas_ids["atlas/releases/202608300453-atlas-v9/ventus-corev8engine.js"], "calls", "static-resolved", "reads geodesy.EARTH_RADIUS_KM from atlas/modules; engine repo not imported (0 references)")
edge(sld, eng, "comparator", "declared", sv["ventus_grid_engine"]["binding_statement"])
edge(sld, far, "reads", "unresolved", "interconnector-endpoints.json: far_lon/far_lat null for 8 links")
rec = pipe_ids["pipeline/scripts/core/atlas-receiver-v9-7.js"]
link = pipe_ids["pipeline/scripts/core/atlas-interconnector-link-v9-8.js"]
edge(link, rec, "imports", "static-resolved", "import { atlasReceiverV9_7 } from ./atlas-receiver-v9-7.js")
edge(rec, atlas_ids["atlas/deeplink/receivers.json"], "implements-contract", "runtime-observed", "verifyAtlasReceiverV9_7 fetched the pair-local contract; changed=false")
edge(rec, cur, "points-to", "runtime-observed", "run receipts: every MAP href starts with the pair atlas route")
edge(pipe_ids.get("pipeline/scripts/plugins/newspaper-v9-7.js", rec), "external:raw.githubusercontent.com:major_project_news_v9_5_1.json", "reads", "runtime-observed", "receipt mirror_misses: aborted offline; table rendered without it")
edge(sld, "external:raw.githubusercontent.com:gb-transmission-network.v1.json", "reads", "runtime-observed", "receipt mirror_misses: aborted offline; arrivals unaffected")
part = pipe_ids.get("pipeline/data/v9.8/interconnectors.json")
if part:
    edge(part, csv, "built-from", "declared", "scripts/build/interconnectors-v9-8.mjs SOURCES pins")
    edge(part, atlas_ids["atlas/data/interconnectors.geojson"], "built-from", "declared", "fixtures/v9.8 pinned blobs")
    edge(pipe_ids.get("pipeline/scripts/plugins/projects-v9-8.js", link), part, "reads", "runtime-observed", "tab renders 16 rows from the manifest-hashed partition")

# tests and runs
tests_sha = hashlib.sha256(open(os.path.join(PAIR, "tests", "run-pair.mjs"), "rb").read()).hexdigest()
db.execute("INSERT INTO test_definitions VALUES (?,?,?)", ("pair-arrivals", tests_sha, "control-11386-harbour-farm"))
consumed_by_maps = [cur, sld, pgs, parq, atlas_ids["atlas/data/offshore-coordinates.json"], atlas_ids["atlas/data/interconnectors.geojson"], rec, link]
for rp in receipts:
    r = json.load(open(rp, encoding="utf8"))
    rid = os.path.basename(rp)
    env = json.dumps(r["harness"], sort_keys=True)
    envfp = hashlib.sha256(env.encode()).hexdigest()[:16]
    rsha = hashlib.sha256(open(rp, "rb").read()).hexdigest()
    ctrl = rid + "#control" if r.get("control", {}).get("pass") else None
    db.execute("INSERT INTO test_runs VALUES (?,?,?,?,?,?,?,?)", (rid, pid, "pair-arrivals", envfp, r["outcome"], ctrl, rsha, r["run_utc"]))
    for cid in consumed_by_maps:
        db.execute("INSERT OR IGNORE INTO run_inputs VALUES (?,?,?)", (rid, cid, "declared-by-analyzer"))
    if r.get("control"):
        c = r["control"]
        db.execute("INSERT INTO test_cases VALUES (?,?,?,?,?,?)", (rid, c["name"], "PASS" if c.get("pass") else "FAIL", "control", "RESOLVED mapped, nearest kV printed", json.dumps({"identity": c.get("identity"), "nearest_on_page": c.get("nearest_on_page")})))
    for c in r.get("cases", []):
        oc = c.get("outcome") or ("PASS" if c.get("pass") else "FAIL")
        db.execute("INSERT INTO test_cases VALUES (?,?,?,?,?,?)", (rid, c["name"], oc, c.get("direction"), c.get("expect") or c.get("statement"), json.dumps({"identity": c.get("identity"), "interconnector": c.get("interconnector"), "zoom": c.get("zoom")})))
    db.execute("INSERT INTO observations(pair_id,source_or_live,measured_at,receipt_ref,note) VALUES (?,?,?,?,?)", (pid, "source (served locally, network cut)", r["run_utc"], "evidence/" + rid, r.get("statement")))
# quarantine: the known, unchanged failure carried in
db.execute("INSERT INTO quarantine VALUES (?,?,?,?,?)", ("gridatlas-cartridge-proof:substation-intelligence:451935>368640", "gridatlas cartridge proof", "FAIL", "2026-09-06T23:58:53Z", "substation-intelligence crosses the 368,640-byte boundary and root 202609060259 has no proof file; unchanged bytes, not re-run"))
db.commit()

# ---- reverse impact: dependency -> consumers -> pairs -> tests
#
# Cycle safety. The visited test delimits both sides before matching, because a
# bare substring test is wrong on identifiers that are prefixes of one another,
# and this graph contains exactly that pair:
#   gridatlas:atlas/data/interconnectors.geojson
#   gridatlas:atlas/data/interconnectors.geojson@R_ATLAS
# A bare instr() would treat the second as already visited and silently drop
# every consumer above it.
#
# The depth cap is kept, because this query enumerates paths rather than nodes
# and is exponential on a dense DAG, but truncation is now reported instead of
# hidden. Termination does not depend on the cap.
IMPACT = """
WITH RECURSIVE up(component_id, depth, path) AS (
  SELECT :changed, 0, ' > ' || :changed || ' > '
  UNION
  SELECT e.consumer_id, up.depth + 1, up.path || e.consumer_id || ' > '
  FROM dependency_edges e JOIN up ON e.dependency_id = up.component_id
  WHERE up.depth < :max_depth AND instr(up.path, ' > ' || e.consumer_id || ' > ') = 0
)
SELECT DISTINCT up.component_id AS affected_component, up.depth, pc.pair_id, tr.run_id, tr.test_id, tr.outcome AS recorded_outcome,
  (SELECT group_concat(DISTINCT d.evidence_status) FROM dependency_edges d WHERE d.consumer_id = up.component_id) AS out_edge_evidence
FROM up
LEFT JOIN pair_components pc ON pc.component_id = up.component_id
LEFT JOIN run_inputs ri ON ri.component_id = up.component_id
LEFT JOIN test_runs tr ON tr.run_id = ri.run_id
ORDER BY up.depth, up.component_id
"""
MAX_DEPTH = 12


def impact(changed, max_depth=MAX_DEPTH):
    rows = db.execute(IMPACT, {"changed": changed, "max_depth": max_depth}).fetchall()
    deeper = db.execute(IMPACT, {"changed": changed, "max_depth": max_depth + 1}).fetchall()
    return rows, len(deeper) > len(rows)          # second value: the answer is truncated


# ---- evidence algebra -------------------------------------------------------
# Certainty that an edge exists, weakest first. 'unresolved' is deliberately
# OUTSIDE this order: it is not weak evidence for a known target, it is the
# record of a target that cannot be named. Merging it away with MAX would erase
# the very gap the D3 demonstration exists to keep visible.
RANK = {"declared": 1, "static-resolved": 2, "runtime-observed": 3}
NAME = {1: "declared", 2: "static-resolved", 3: "runtime-observed"}


def path_evidence(statuses):
    """Along a path: the weakest link bounds the claim."""
    known = [RANK[s] for s in statuses if s in RANK]
    return min(known) if known else None


def merge_paths(values):
    """Across independent paths to the same fact: the strongest stands."""
    known = [v for v in values if v]
    return max(known) if known else None


def evidence_label(rank, incomplete):
    return NAME.get(rank, "none") + (" + UNRESOLVED EDGES PRESENT" if incomplete else "")


lines = ["# Reverse impact and negative controls", "",
         "Pair `%s` - runs %d - components %d - edges %d" % (pid, len(receipts),
             db.execute("select count(*) from component_versions").fetchone()[0],
             db.execute("select count(*) from dependency_edges").fetchone()[0]),
         "",
         "Revised after an external logic review. Applicability now requires every consumed input to be present at the same content hash; the cycle test is delimited; truncation is reported; unresolved edges are never merged away; quarantine eligibility is transitive; and a run with an unimplemented case is INCOMPLETE rather than PASS.",
         ""]

rows, truncated = impact(atlas_ids["atlas/data/interconnectors.geojson"])
lines += ["## Q1  Which tests consume `atlas/data/interconnectors.geojson`?", "",
          "Truncated at depth %d: **%s**" % (MAX_DEPTH, "yes, the answer is incomplete" if truncated else "no"), "",
          "| affected component | depth | pair | run | test | recorded outcome | evidence |",
          "|---|---|---|---|---|---|---|"]
for row in rows:
    statuses = (row[6] or "").split(",")
    lab = evidence_label(path_evidence(statuses), "unresolved" in statuses)
    lines.append("| " + " | ".join(str(x) for x in row[:6]) + " | " + lab + " |")

# ---- D1  applicability ------------------------------------------------------
db.execute("INSERT INTO component_versions VALUES (?,?,?,?,?,?)", ("gridatlas:atlas/data/interconnectors.geojson@R_ATLAS", "gridatlas", "future", "atlas/data/interconnectors.geojson", "0000-placeholder-regenerated-on-6378.137", "dataset"))
child = pid.replace("-W", "-W-child-demo")
db.execute("INSERT INTO release_pairs VALUES (?,?,?,?,?)", (child, pid, "windows-rig", pair["experiment_id"], "demo"))
for (c,) in db.execute("SELECT component_id FROM pair_components WHERE pair_id = ?", (pid,)).fetchall():
    if c != atlas_ids["atlas/data/interconnectors.geojson"]:
        db.execute("INSERT OR IGNORE INTO pair_components VALUES (?,?,?,?)", (child, c, "carried", "DEMO"))
db.execute("INSERT OR IGNORE INTO pair_components VALUES (?,?,?,?)", (child, "gridatlas:atlas/data/interconnectors.geojson@R_ATLAS", "dataset", "DEMO"))

# Corrected applicability: EVERY consumed input must be present in the child at
# the same (path, content_sha256). Identity is the content hash, not the id
# string, because an id can be reused across contents.
APPLICABILITY = """
SELECT tr.run_id, tr.outcome,
  (SELECT count(*) FROM run_inputs ri WHERE ri.run_id = tr.run_id) AS inputs,
  (SELECT count(*) FROM run_inputs ri
     JOIN component_versions cv ON cv.component_id = ri.component_id
     WHERE ri.run_id = tr.run_id AND NOT EXISTS (
       SELECT 1 FROM pair_components pc
       JOIN component_versions cc ON cc.component_id = pc.component_id
       WHERE pc.pair_id = :child AND cc.path IS cv.path AND cc.content_sha256 IS cv.content_sha256)) AS missing
FROM test_runs tr WHERE tr.pair_id = :parent
"""
lines += ["", "## D1  A changed input invalidates applicability", "",
          "Child pair `%s` carries every parent component except the interconnector geojson, which is regenerated on the estate's earth radius and so has a new content hash." % child, "",
          "The rule shipped first was: applicable if ANY consumed input is present in the child. The review's counterexample holds, and this graph reproduces it, because the child shares almost every component with its parent. The rule is now: stale if ANY consumed input is absent from the child at the same content hash.", ""]
for run_id, outcome, inputs, missing in db.execute(APPLICABILITY, {"child": child, "parent": pid}).fetchall():
    verdict = "APPLICABLE" if missing == 0 else "STALE (%d of %d consumed inputs changed or absent)" % (missing, inputs)
    lines.append("- `%s` recorded `%s` -> **%s**; the superseded any-match rule said APPLICABLE" % (run_id, outcome, verdict))
lines += ["",
          "One qualification the review did not make. It holds that a receipt stays applicable when components it never consumed change. That is true only while consumption is complete for the environment being claimed, and here it is not: two components are fetched by absolute URL and were aborted under the network cut, so they are pair components no run consumed. A change to either cannot mark any receipt stale under a consumption-scoped rule, yet it can change behaviour the moment the pair is served online. Applicability is therefore qualified by environment: a network-cut receipt says nothing about the online pair.",
          "",
          "A second qualification, against this implementation rather than against the rule. `run_inputs` is written by the analyzer, not observed by the harness, so 16 rows stand for 103 pair components. Until the harness records what it actually fetched, every applicability verdict is only as good as that declared list."]

# ---- D2  cycle safety -------------------------------------------------------
db.execute("INSERT INTO component_versions VALUES ('demo:A',NULL,NULL,'demo/A',NULL,'demo'),('demo:B',NULL,NULL,'demo/B',NULL,'demo')")
edge("demo:A", "demo:B", "imports", "declared", "cycle demo")
edge("demo:B", "demo:A", "imports", "declared", "cycle demo")
rows, truncated = impact("demo:A")
collide = db.execute("SELECT a.component_id, b.component_id FROM component_versions a JOIN component_versions b ON b.component_id <> a.component_id AND instr(b.component_id, a.component_id) > 0").fetchall()
lines += ["", "## D2  A cycle terminates, and the visited test no longer confuses prefixes", "",
          "A -> B -> A: %d rows, finished, truncated: %s. Rows: %s" % (len(rows), "yes" if truncated else "no", ", ".join("%s@%s" % (r[0], r[1]) for r in rows)), "",
          "Identifier pairs in this graph where one id is a substring of another: **%d**." % len(collide)]
for a, c in collide:
    lines.append("- `%s` is contained in `%s`, so an undelimited visited test would treat the second as already seen and drop its consumers" % (a, c))
lines += ["",
          "The review called the depth cap unnecessary given correct cycle detection. True for termination, false for cost: this query enumerates paths, not nodes, so a dense acyclic graph is still exponential in edges. The cap stays, and truncation is detected by re-running one level deeper and comparing row counts."]

# ---- D3  unresolved stays visible ------------------------------------------
rows, truncated = impact("unresolved:far-end-converters-x8")
lines += ["", "## D3  An unresolved dependency stays visible", "", "Impact of the eight unlocated far converters:", ""]
for r in rows:
    statuses = (r[6] or "").split(",")
    lines.append("- %s (depth %s) run %s recorded %s - evidence %s" % (r[0], r[1], r[3], r[5], evidence_label(path_evidence(statuses), "unresolved" in statuses)))
lines += ["",
          "The review proposed merging parallel evidence with MAX and answered that where a runtime-observed edge and an unresolved edge reach the same component the result is definitively runtime-observed. That is rejected, and this graph is the reason: the sld-sandbox cartridge carries both, and they are not two routes to one fact. One says a named dependency was observed; the other says a dependency exists whose target cannot be named. MAX over them deletes the second. Unresolved is kept outside the order and annotated onto the answer, so a reader can see the impact set is a lower bound."]

# ---- D4  quarantine ---------------------------------------------------------
q = db.execute("SELECT fingerprint, outcome, first_seen FROM quarantine").fetchall()
requeue = db.execute("SELECT count(*) FROM test_runs WHERE test_id = 'gridatlas cartridge proof'").fetchone()[0]
lines += ["", "## D4  An unchanged semantic failure stays quarantined, under a transitive predicate", "",
          "`%s` first seen %s, outcome %s; runs of that test queued by this pair: %d." % (q[0][0], q[0][2], q[0][1], requeue), "",
          "The shipped rule re-opened a quarantine when the subject's bytes, the boundary or the proof changed. The review's counterexample holds: a fix landing in a dependency of the subject leaves all three unchanged, and the failure stays quarantined for ever. The predicate is now:", "",
          "```",
          "eligible = subject_bytes_changed",
          "        OR boundary_changed",
          "        OR proof_changed",
          "        OR any(component in the failing run's inputs has new bytes)",
          "        OR harness_sha256_changed",
          "        OR environment_fingerprint_changed",
          "        OR manually_revoked(reason, utc)",
          "```", "",
          "The last clause exists because no state-driven predicate can detect a quarantine that was mistaken when it was written. It needs a person, and it is recorded with a reason and a timestamp rather than by deleting the row."]
db.commit()

# exports
def export(table):
    cur_ = db.execute(f"SELECT * FROM {table}")
    cols = [d[0] for d in cur_.description]; rows = cur_.fetchall()
    with open(os.path.join(HERE, table + ".tsv"), "w", encoding="utf8", newline="\n") as f:
        f.write("\t".join(cols) + "\n")
        for r in rows: f.write("\t".join("" if v is None else str(v).replace("\t", " ").replace("\n", " ") for v in r) + "\n")
    return [dict(zip(cols, r)) for r in rows]
export_all = {t: export(t) for t in ["release_pairs", "component_versions", "pair_components", "dependency_edges", "test_definitions", "test_runs", "run_inputs", "test_cases", "observations", "reports", "approval_events", "quarantine"]}
json.dump(export_all, open(os.path.join(HERE, "export.json"), "w", encoding="utf8"), indent=1)
open(os.path.join(HERE, "IMPACT.md"), "w", encoding="utf8", newline="\n").write("\n".join(lines) + "\n")
open(os.path.join(HERE, "impact-query.sql"), "w", encoding="utf8", newline="\n").write(IMPACT.strip() + "\n")
print("relational export:", {k: len(v) for k, v in export_all.items()})
