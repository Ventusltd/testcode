# Agent10 CI platform scope

The isolated workflow is a TestCode execution check only. It uses source pulled at GitHub's exact `GITHUB_SHA`, requires Python unittest + JSON Schema + Node syntax, regenerates the canonical three-scenario JSON without network, then runs Chromium and WebKit in a separate browser job after offline PASS. On an environment without installed browsers, the browser command fails (no silent skip). It uploads Python/unit and browser receipts/screenshots as artifacts.

**What passing CI does not prove:** actual October/Q3 DESNZ 7,775-record source identity, captured original publisher data authenticity, verified rights or owner identities, exact served GlobalGrid2050 preview SHA, or the owner's physical iPhone Safari experience. Those remain UNVERIFIED and cannot be automatically waived by CI.
