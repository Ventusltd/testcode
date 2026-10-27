# Independent Build F archive-integrity challenge — 27 October 2026, 01:00 UTC

**Lane:** ChatGPT Testcode-only; **no change** to Claude's GridAtlas overlay, production pointer, Lightning archive, or release. This report is for **Claude variant F**, generation \`202610270047\`, pinned GridAtlas SHA \`8089372fc156ac6339e0a11a88491e557e504d43\`. Build E is already published separately at main SHA \`1c19b76838758ef08ed9c8c4902a798a8762ece6\`, generation \`202610270024\`; original live pointer remains \`202609241334\`.

Source: \`atlas/modules/202610270047-uk-lightning-overlay.js\` (blob \`86861a69151480db4306bd911ad54fb82d46aabd\`), lines 54–58, 69–88, 101–114. New test: \`drivers/gridatlas-lightning-integrity.test.mjs\`. Independent input: synthetic index, scan windows, two genuine-format but **SYNTHETIC** optical Feature objects, byte-count and SHA256, Node VM. No live archive or browser is claimed.

## Fail-first findings

**I01 — SHA-256 verification can be silently bypassed when WebCrypto is unavailable.** \`sh\` computes \`s=(window.crypto||0).subtle\`, and its mismatch array includes \`s&&digest…\`. With \`window.crypto\` absent, a shard with the **wrong SHA-256** but matching feature count and bytes is **accepted**. Reproduced with the exact Build F source in an isolated JavaScript harness: result \`ACCEPTED_WITHOUT_CRYPTO\` for \`sha256='0'.repeat(64)\`, \`count=1\`, matching \`bytes=289\`. Security impact is conditional (GitHub Pages HTTPS normally provides WebCrypto), but the integrity contract should fail closed rather than silently downgrade. Proposed Claude-owned fix: if \`crypto.subtle.digest\` is unavailable, report **UNVERIFIED / UNKNOWN**, do not show data as SHA-verified or \`EMPTY-COVERED\`. Do not fake a digest or weaken the test.

**I03 — second index/shard mismatch hides the integrity error.** \`lw\` retries the index once, but on the second mismatch rewrites \`f.error\` to \`archive updating, retrying next refresh\` (line 81), discarding \`index mismatch: count, bytes, sha256\`. Independent harness observed **two** index fetches, **two** bad shard fetches, \`PARTIAL\` (good), but warning contained only \`archive updating, retrying next refresh\` (no mismatch or SHA/count evidence). This is a diagnostic transparency regression; it should retain the specific integrity failure and a retry notice. Proposed Claude-owned fix: preserve \`index mismatch: …\` in \`f.error\`, add a separate \`retry exhausted\` or \`archive updating\` status, keep \`PARTIAL\` and never imply confirmed zero.

**Positive controls:** I02 wrong digest with WebCrypto present should reject; I04 first bad shard then valid shard after index refetch should recover with two actual optical Feature records and no failures. These prevent false alarms from a test harness that simply rejects all data.

## Reproduce and adjudicate

1. Check out **exact** \`8089372fc156ac6339e0a11a88491e557e504d43\` into \`../gridatlas\`; check out this Testcode reviewer branch separately.
2. \`GRIDATLAS_ROOT=../gridatlas LIGHTNING_GEN=202610270047 node --test drivers/gridatlas-lightning-integrity.test.mjs\`
3. Expected until Claude fixes: **I01 FAIL, I02 PASS, I03 FAIL, I04 PASS**. The Testcode PR is intentionally **RED** while these fail-first conditions remain. Independently verify real CI logs rather than assuming.
4. Preserve original eight H01–H08 regression tests and nine immutable-byte tests; don't weaken those. The old candidate negative control must remain RED.
5. After a new Claude immutable generation, pin its exact SHA and generation in a fresh reviewer test commit; rerun the entire suite. Do not modify the old Build E preview.

**Limitations:** Node VM synthetic network; no Chromium/WebKit, iPhone, real live EUMETSAT archive, CDN skew, or V1–V15 owner acceptance. This is a source-backed independent challenge, not a production-release veto signature.
