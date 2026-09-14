# Numbered code relationships

This experimental read-only viewer loads a normalized, pinned Stars database export. Every retained line and family primary key is preserved, including historical records and lines outside extracted families. The graph and its accessible buttons open the same relationships; pagination exposes all recorded entries. Source links use full Git commit identifiers. Exact numbered line bytes are decoded as text and checked against their SHA-256 before display.

The source snapshot is Stars `5ed441256c44a27bb8140722919d8e07edb8f8f5`, database SHA-256 `9ddf5684b72f72ddfa3b5022150f323a5960fa9740233332ce786a5a3c8ef5c1`. It contains 249,018 line keys, 15,601 retained family keys, 5,506 source tablets, 41,984 pinned source occurrences, 772 block/group records and 47 repositories. These are retained-history counts, not the current live export's family denominator.

Data totals 122,192,400 bytes in 258 files; the largest data file is 579,987 bytes. Full hash and reciprocal-relationship proof is in PROOF.json. Run `node verify.mjs data` to repeat it. A missing input fails.

Dependency relationships are lexical candidates, not verified runtime calls. No historical supersession mapping is invented. Source occurrences do not prove a website deployment. The database is the coverage boundary; private repositories, other languages and code absent from the registry are not implied to be covered. The current prototype browses a complete type index on demand; very large indexes can take longer to load. Editing and command execution are absent from this interface.

Browser validation: desktop 1440 px completed the family-to-line-to-source-to-GitHub-to-back journey at 15:29:31 UTC. After correcting source-title wrapping, emulated touch at 430 px completed the same journey at 15:32:02 UTC with zero page errors and 430 px document width. BROWSER.json records the final mobile result; browser-1440.png and browser-430.png retain screenshots. Initial mobile failures and the correction are documented in the shared Dropbox log.
