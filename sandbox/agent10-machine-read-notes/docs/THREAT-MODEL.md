# Threat model

**Assets:** frozen DESNZ REPD identifiers/status; verifiable original URLs/content bytes; project-event identity; correct publication/collection timeline; licence rights; review attestation; accessible visible notes.

**Untrusted surfaces:** article title/body, source HTML, URL redirect, claim of publisher ownership, prefilled `review_state`, artificial 64-character SHA, embedded licence, synthetic fixture text, model-generated summaries, and GitHub discussion comments. An item available publicly is *not* permission to republish it.

**Controls:** no remote code execution, no article JavaScript parsing; HTTPS-only canonical references with redirection gate; actual base64-byte SHA recomputation (not authentication); no external validator bypass; no score-only REPD binding; unknown ownership and rights always remain unknown; only restricted machine templates with exact post-render equality; no self-signed trusted acceptance; no source snapshot mutation; 4 typed independent clocks; `textContent` DOM construction; source-name/title markup rejection; static accessible fallback; 44px keyboard/touch controls; reduced-motion CSS; fail-closed absence.

**Remaining gaps:** captured bytes supplied by the collector are not yet independently authenticated to a remote publisher; trusted ownership/review/rights registries need a separate secured chain. No actual official 7,775-row extract in this fixture. No live network fetch, WebKit or physical iPhone proof solely from unit tests. The example URLs are reserved placeholders; use no publication. Do not present candidate notes as facts.
