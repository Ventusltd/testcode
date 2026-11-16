# News ranking integration observation

This lab executes the pinned Python ranking producer and the actual existing
V9.25 renderer in a small Node VM DOM. It proves why simply merging the producer
does **not** deliver visible ranked headlines. Twelve checks passing means the
known incompatibilities were reproduced; `release_compatible` stays `false`.

Inputs are six explicitly hashed producer/package files from GlobalGrid2050
`c2b89326ab55424c4ea10ff5921d9c2bf31073dd`, and the existing renderer/schema from
`e2568fa9b818d39e28b106bbe49c3a53d0ad4fc2`. No product files are copied into this lab.
`pins.json` records committed LF-byte SHA256 values. Checked-out CRLF is normalised
for this text-source comparison. The fixtures are synthetic; their publisher
labels and example URLs are not source receipts.

Use Python 3.12 and Node 20 or later. Supply independently prepared checkouts:

```sh
python sandbox/news-ranking-integration/check.py \
  --producer-root "$PRODUCER_CHECKOUT" --consumer-root "$CONSUMER_CHECKOUT"
```

The tool performs no Git operations or downloads. Missing/mutated selected source
files fail before producer import. It blocks Python socket connection paths and
the renderer's fetch/timer entry points. Run in a clean Python process; this is a
bounded test harness, not an isolation boundary for hostile source code.

Observed results:

- Raw `editorial-priority.v1` is rejected by the current `pipeline-headlines.v1` consumer.
- Existing JSON schema disallows extra `editorial` item properties. This check
  inspects that explicit rule; it is not a complete JSON Schema validator.
- A naive v1 envelope passes the renderer's shallow acceptance but loses the
  government policy item and sorts an undated article first by collection time.
- The ranking producer instead keeps all four items and places the older
  government energy policy first. Unknown publication date receives no freshness
  points, publisher credit survives, and no ranking grants VERIFIED.
- Snapshot/failed-collection labels and text/unsafe-link behavior remain intact.

This is not Playwright, a real browser, live-source research, a full security
audit or deployment acceptance. The future candidate needs actual desktop/mobile
browser checks, exact headline-byte/sidecar binding, stale/missing/tampered sidecar
fallback, policy visibility, and unchanged collection-status semantics.

The recommended production integration recipe is recorded in Neural Link issue46.
COMMAND owns formal release composition; this lab changes no schedules, shared
gates, release folders or public pointers.
