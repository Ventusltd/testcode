# GlobalGrid2050 Grid Machine runners

The paired build programme constructs PipelineNews and GridAtlas from exact commits in `tools/pair-inputs.json`. It consumes the pinned Ventus grid engine geodesy module for interconnector calculations and preserves source hashes and notices.

`tools/build-pair.py` creates `sandbox/gm02/<UTC timestamp>/` with both applications and `pair.json`. Primary keys use `GGPAIR-GM02-YYYYMMDDTHHMMSSZ`; the independent GM01 lane uses distinct keys. Final integration references both candidate keys, exact selected artifacts and its own evidence.

`tools/pair-gates.cjs` follows five actual PipelineNews MAP buttons: Harbour Farm 11386 (control), 13429, 13432, BritNed and Viking Link. A failed control invalidates candidate verdicts. Recording stores HTTP responses by method, URL and Range; offline replay fulfills recorded requests and blocks external misses. This is bounded runtime replay coverage, not proof of every possible dependency or all 7,680 MAP buttons. Reverse-direction and complete layer campaigns remain additional gates.

GitHub Actions independently fetches pinned inputs, builds, records, replays and packages passing applications for review. Failed runs retain receipts. No production deployment is authorized by this workflow. Preview publication is a subsequent step after reviewing exact receipts; the workflow does not claim that source/artifact availability is a deployed website.

The Dell build loop and ten-minute health alarm operate through systemd without AI polling. Toshiba evidence is under `/mnt/toshiba/GLOBALGRID_WORKER/runs/gridmachine-<timestamp>/`. Current state is `state/gridmachine-programme.json`; the health report is `reports/GRIDMACHINE-WATCH.json`. The owner has raised generated-storage policy to 900 GB with free-space headroom. Identical failure fingerprints quarantine rather than creating endless restamped failures.

Attribution: app and engine source provenance and available LICENSE/NOTICE files accompany each candidate. Browser tooling uses Microsoft Playwright and the Chromium project; their package/browser notices apply independently. No new third-party analytics libraries are required by these scripts. Missing upstream notice files remain missing; they are not treated as redistribution permission.

This programme is under active validation. A successful five-case receipt certifies only those assertions at those input versions. It does not certify offline coverage of all layers, all directions, production releases, or physical grid feasibility.
