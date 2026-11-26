"""Synthetic producer-compatible fixtures: no network or source execution."""
import hashlib
import shutil
import sqlite3
import struct
import tempfile
import unittest
from pathlib import Path
from ingest import application_hints, delta, digest, packed_ids

DDL = '''
CREATE TABLE line(n INTEGER PRIMARY KEY,sha BLOB UNIQUE NOT NULL,text BLOB NOT NULL);
CREATE TABLE tablet(n INTEGER PRIMARY KEY,git_blob TEXT UNIQUE NOT NULL,lang TEXT,lines BLOB NOT NULL,issue TEXT);
CREATE TABLE family(n INTEGER PRIMARY KEY,sha BLOB UNIQUE NOT NULL,lang TEXT NOT NULL);
CREATE TABLE element(n INTEGER PRIMARY KEY,sha BLOB UNIQUE NOT NULL,family INTEGER NOT NULL,kind TEXT,needs TEXT,standalone INTEGER);
CREATE TABLE tablet_element(tablet INTEGER NOT NULL,element INTEGER NOT NULL,first INTEGER NOT NULL,last INTEGER NOT NULL,col0 INTEGER,col1 INTEGER,name TEXT,PRIMARY KEY(tablet,element,first));
CREATE TABLE occurrence(repo TEXT NOT NULL,commit_sha TEXT NOT NULL,path TEXT NOT NULL,tablet INTEGER NOT NULL,seen_utc TEXT NOT NULL,PRIMARY KEY(repo,commit_sha,path));
CREATE TABLE scan(repo TEXT PRIMARY KEY,commit_sha TEXT,branch TEXT,scanned_utc TEXT,files INTEGER,skipped INTEGER,issue TEXT);
'''
STAMP = '2026-11-26T00:00:00Z'
A, B, C = 'a'*40, 'b'*40, 'c'*40
K = 'Ventusltd/kuiper-belt'
G = 'Ventusltd/gridatlas'
L = 'Ventusltd/lidar'
O = 'Ventusltd/other'


def add_line(db, n, raw):
    db.execute('INSERT INTO line VALUES(?,?,?)', (n,hashlib.sha256(raw).digest(),raw))


def tablet(db, n, ids):
    raw = b''.join(db.execute('SELECT text FROM line WHERE n=?',(i,)).fetchone()[0] for i in ids)
    blob = hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest()
    db.execute('INSERT INTO tablet VALUES(?,?,?,?,NULL)',(n,blob,'js',struct.pack('<'+'I'*len(ids),*ids)))


def occurrence(db, repo, commit, path, t):
    db.execute('INSERT INTO occurrence VALUES(?,?,?,?,?)',(repo,commit,path,t,STAMP))


def scan(db, repo, commit, issue=None):
    db.execute('INSERT OR REPLACE INTO scan VALUES(?,?,?,?,?,?,?)',(repo,commit,'main',STAMP,1,0,issue))


def family(db, f, e, body):
    h = hashlib.sha256(body).digest()
    db.execute('INSERT INTO family VALUES(?,?,?)',(f,h,'js'))
    db.execute('INSERT INTO element VALUES(?,?,?,?,?,?)',(e,h,f,'function','[]',1))


class Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.a = Path(self.temp.name)/'a.sqlite'; self.b = Path(self.temp.name)/'b.sqlite'
        with sqlite3.connect(self.a) as db:
            db.executescript(DDL)
            add_line(db,1,b'function f(){\n'); add_line(db,3,b'}\n')
            tablet(db,1,[1,3]); family(db,1,1,b'original')
            db.execute("INSERT INTO tablet_element VALUES(1,1,1,2,0,1,'f')")
            occurrence(db,K,A,'see-through/model.js',1); scan(db,K,A)
            occurrence(db,G,A,'atlas/vicinity.js',1); scan(db,G,A)
        shutil.copyfile(self.a,self.b)
        with sqlite3.connect(self.b) as db:
            add_line(db,4,b'  return 42;\r\n'); add_line(db,5,b'old terrain line')
            tablet(db,2,[1,4,4,3]); tablet(db,3,[5]); family(db,2,2,b'updated')
            db.execute("INSERT INTO tablet_element VALUES(2,2,1,4,0,1,'f')")
            db.execute("INSERT INTO tablet_element VALUES(2,2,2,3,0,1,'nested alias')")
            occurrence(db,K,B,'see-through/model.js',2); scan(db,K,B)
            occurrence(db,G,B,'atlas/vicinity.js',2); scan(db,G,B)
            occurrence(db,L,A,'src/old.py',3); scan(db,L,C)
            occurrence(db,O,B,'misc.js',2); scan(db,O,B)

    def run_delta(self):
        return delta(self.a,self.b,digest(self.a),digest(self.b))

    def edit(self, sql, args=()):
        with sqlite3.connect(self.b) as db: db.execute(sql,args)

    def test_delta_identity_priority_and_history(self):
        r = self.run_delta()
        self.assertEqual(r['new_unique_lines'],2)
        self.assertEqual([x['line_id'] for x in r['new_lines']],[4,5])
        self.assertEqual(r['new_lines'][0]['application_hints'],['See Through','Kuiper','Vicinity','GridAtlas'])
        self.assertEqual(r['new_lines'][1]['application_hints'],['LiDAR'])
        self.assertEqual([x['priority'] for x in r['changed_active_files']],[0,0,1])
        self.assertEqual(r['historical_candidates'][0]['commit_sha'],A)
        self.assertEqual(r['changed_active_files'][0]['elements'][0]['unique_line_ids'],[1,3,4])
        self.assertEqual(r['changed_active_files'][0]['elements'][1]['unique_line_ids'],[4])
        self.assertEqual(r['unmapped_new_line_ids'],[])
        self.assertIsNone(r['translated_unique_lines']); self.assertIsNone(r['changed_active_files'][0]['vedic_id'])
        self.assertFalse(r['changed_active_files'][0]['runtime_verified'])
        self.assertEqual(r['new_families'][0]['family_id'],2)

    def test_noop(self):
        r=delta(self.a,self.a,digest(self.a),digest(self.a))
        self.assertEqual(r['new_unique_lines'],0); self.assertEqual(r['changed_active_files'],[])

    def test_snapshot_pin(self):
        with self.assertRaisesRegex(ValueError,'digest mismatch'): delta(self.a,self.b,'0'*64,digest(self.b))

    def test_reassigned_line(self):
        self.edit('UPDATE line SET text=? WHERE n=1',(b'changed',))
        with self.assertRaisesRegex(ValueError,'identity changed'): self.run_delta()

    def test_gap_reuse(self):
        self.edit('INSERT INTO line VALUES(?,?,?)',(2,hashlib.sha256(b'gap').digest(),b'gap'))
        with self.assertRaisesRegex(ValueError,'gap reused'): self.run_delta()

    def test_bad_new_line_hash(self):
        self.edit('UPDATE line SET sha=? WHERE n=4',(b'wrong',))
        with self.assertRaisesRegex(ValueError,'line digest'): self.run_delta()

    def test_malformed_tablet(self):
        self.edit('UPDATE tablet SET lines=? WHERE n=2',(b'x',))
        with self.assertRaisesRegex(ValueError,'malformed'): self.run_delta()

    def test_missing_line(self):
        self.edit('UPDATE tablet SET lines=? WHERE n=2',(struct.pack('<I',999),))
        with self.assertRaisesRegex(ValueError,'missing permanent'): self.run_delta()

    def test_reconstruction_drift(self):
        self.edit('UPDATE tablet SET lines=? WHERE n=2',(struct.pack('<II',3,4),))
        with self.assertRaisesRegex(ValueError,'reconstruction mismatch'): self.run_delta()

    def test_membership_range(self):
        self.edit('UPDATE tablet_element SET last=999 WHERE tablet=2 AND first=1')
        with self.assertRaisesRegex(ValueError,'invalid element'): self.run_delta()

    def test_history_rewrite(self):
        self.edit('DELETE FROM occurrence WHERE repo=? AND commit_sha=?',(K,A))
        with self.assertRaisesRegex(ValueError,'historical provenance'): self.run_delta()

    def test_failed_scan_not_removal(self):
        self.edit('UPDATE scan SET commit_sha=?,issue=? WHERE repo=?',(C,'failed',K))
        r=self.run_delta(); self.assertEqual(r['scan_issues'][0]['repo'],K)
        self.assertFalse(any(x['repo']==K for x in r['removed_from_successful_scans']))

    def test_unmapped_explicit(self):
        self.edit('INSERT INTO line VALUES(?,?,?)',(6,hashlib.sha256(b'orphan').digest(),b'orphan'))
        self.assertEqual(self.run_delta()['unmapped_new_line_ids'],[6])

    def test_priority_rules(self):
        for repo,path,tag in [(K,'see-through/3d.js','See Through'),(K,'editions/a.js','Kuiper'),('Ventusltd/energy-transition-simulator','world/animate.js','Solar Design Studio'),(L,'src/slope_tiles.py','LiDAR'),('Ventusltd/ventus-grid-engine','engine/v9-geodesy.js','Ventus Grid Engine'),(G,'atlas/vicinity.js','Vicinity'),(G,'atlas/substation-intelligence.js','Substation locations'),(G,'atlas/index.html','GridAtlas'),('Ventusltd/gis-sld-sandbox','src/finance.js','GIS SLD Financial Sandbox'),('Ventusltd/globalgrid2050','solar-bess-topology-v7/gis-sld-financial-sandbox/index.html','GIS SLD Financial Sandbox')]:
            self.assertIn(tag,application_hints(repo,path))
        self.assertEqual(application_hints(O,'misc.js'),[])

    def test_zero_id(self):
        with self.assertRaisesRegex(ValueError,'zero'): packed_ids(b'\0'*4)

if __name__=='__main__': unittest.main()
