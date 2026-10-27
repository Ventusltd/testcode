# Build G independent fail-first archive semantic and digest review — 27 October 2026, 01:58 UTC

**Scope:** ChatGPT/Testcode only. No overlay, history, candidate, main, pointer or deployment writes. G is **not** published. Build E remains published only as an immutable preview; live original generation is \`202609241334\`.

**Exact challenged GridAtlas source:** \`31e009d1acbe2d00e82fc6c5e0fdbadb7c6c1b3c\`, immutable overlay generation \`202610270113\`, file \`atlas/modules/202610270113-uk-lightning-overlay.js\`. Independent Testcode commit \`ffd9e70c41eac0ee4b1249ad19c97af2919e8318\`.

**Actual GitHub Actions:** [run 40435693914](https://github.com/Ventusltd/testcode/actions/runs/40435693914), 27 October 2026 at 01:58 UTC. Immutable tests **9/9 PASS**; existing H01–H08 **8/8 PASS**; previous I01–I04 **4/4 PASS**; newly introduced G05/G06 **0/2 PASS, 2 FAIL**, expected fail-first. Known-bad original candidate negative control also RED as intended. No actual iPhone, real EUMETSAT history shards or browser validation claimed.

## G05 — semantic data loss can be falsely presented as EMPTY-COVERED (confirmed synthetic FAIL)

A **synthetic** archive day has two records, valid source JSON and valid SHA-256/bytes/count, a fully covered UTC 24h scan window, but both features have the wrong \`observation_kind\`. The overlay correctly rejects them as malformed (\`r.ev.bad === 2\`, \`r.ev.length === 0\`). However \`cf()\` does not consult the rejected-feature count: it returns **\`EMPTY-COVERED\`**, and the status formatter can therefore display **“NO FLASHES DETECTED · SEARCHED 100%”**. A file with declared observations but no valid parseable observations is *not* evidence of zero optical flashes.

**Required behaviour:** semantic-invalid counts must prevent a covered-empty conclusion, be prominently labelled PARTIAL/UNKNOWN/FAIL with actual reason and count, and avoid presenting all index observations as displayed/verified. Do not replace invalid features with fake points.

## G06 — missing digest + missing WebCrypto accepted as READY·DETAIL (confirmed synthetic FAIL)

A **synthetic** index day has valid byte count and feature count but lacks \`sha256\`; the environment lacks \`window.crypto.subtle\`. The \`sh()\` path uses \`s&&...\` to compare digest and \`if(!s&&t.sha256)\` to fail closed. With **both absent**, neither check runs. Result: the day is accepted, and \`cf()\` returns **\`READY·DETAIL\`** with 2 unverified points.

**Required behaviour:** enforce a correctly formatted mandatory digest in index rows/parts before accepting any day, and always fail closed when verification cannot be performed. Preserve earlier I01/I03 fixes and sealed-shard integrity semantics. An absent digest is not permission to skip verification.

These tests deliberately challenge future archive failure states, not current live historical coverage. They do not imply an actual archive has been tampered with, or any real asset was struck. Source flashes are optical observations, **not confirmed cloud-to-ground strikes**.

## Next gate

Claude should make fixes only on a **new immutable generation**, not edit E, F, G, main or the published archive. Independent reviewer re-pins the exact SHA and reruns I01–I04 and G05/G06, then checks existing 9+8 gates, browser T8/T8b, owner real iPhone V1–V15 and history provenance. **No release authority** follows from synthetic green tests.
