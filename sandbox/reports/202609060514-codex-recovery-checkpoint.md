# Codex recovery checkpoint — 2026-09-06 05:14 UTC

The user authorized overnight implementation and existing-homepage Test Code
publication, at least 30 substantive versions. Continue until at least 06:00 UTC
(07:00 BST), with actual review rather than counted retries. Do not change antivirus
settings or retry the quarantined native CUA runtime. Normal Chrome/Playwright is
working. Original app owners remain separate; owner fixes are draft PRs, not merges.

## Delivery state

The durable acceptance ledger is Spiders `codex/build-plan/campaigns/20260906-next30.md`.
At this checkpoint **35 versions are accepted**, including the original 30,
0418 native PDF, 0432 legacy Cable repair, 0435 keyboard controls, 0441 winding,
and corrected 0503 tool recovery. Homepage links for all 35 were independently found.
The corrected host is at publication `d66f36c8`; Pages `34013169706` completed
successfully. Exact 32 served files plus eight host dependencies, 54 layout checks,
20 recovery checks and 120 polygon checks passed.

**0447 acceptance was revoked.** Its builder replaced the old base bootstrap but
omitted the parent 0441 layout initializer. Recovery and polygon tests passed while
menu/search/tool layout regressed. A full 54-check layout driver detects this;
the old 0447 fails waiting for the missing initializer. The new 0503 explicitly
reconstructs and attests the complete parent entrypoint. Historical 0447 bytes and
link remain with an acceptance-withdrawn note. No count for 0447 or its rejected
0459 child, even though their narrower CI checks were green.

0504 (undoable vertex removal) is published at `189c25b8` but awaits served acceptance
at this checkpoint. Source `e142b2bc61330f3756be20f5648e025004e59a80`, scoped CI
`34013085157` green. It is rebuilt from corrected 0503, not rejected 0459.
26 removal and 54 layout local checks pass; CI also checks recovery and polygons.

0509 (clear measurement controls) is committed and queued, not yet published.
Source `b7720356c33ada3871175e90bef304b9cc124438`, scoped CI `34013328981` green.
Existing Layers button moves into the measurement dock, returns to its original
location on close, and uses its original handler. The phone Layers panel fits
above the dock and its last option remains reachable. Optional diagnostic/version
badges yield while measurements are open. 64 checks at 320, 393, landscape 667 and
1440 pixels pass, plus 10 actual Print checks; CI additionally retains 54 layout,
26 removal, 20 recovery and 120 polygon checks. Failed local 0506 and 0508 remain
untracked and unpublished: 0506 let Layers cover its relocated close control;
0508 still had an overlapping version link. Neither is a version delivered.

## Source state and owner support

- Test Code: `C:/Users/vikra/testcode-controls-20260906`, branch
  `codex/20260906-atlas-controls`, app source/main `b7720356c33ada3871175e90bef304b9cc124438`.
  Preserve untracked candidates 0223/0224/0226/0227/0306/0417/0506/0508.
- Atlas source parts: `C:/Users/vikra/atlas-labels-20260906`, branch
  `codex/poly-labels-20260906`, `443b2683e5b5d02b1a0b6e94fef7ea4d50bc8178`.
  Latest engine `atlas/parts/202609060458-ventus-corev8engine-remove-vertex.js`;
  measurement module `atlas/modules/202609060509-measurement-clear-readouts.js`.
  Preserve `label-draft.json`. No owner current.json/main update in this lane.
- Owner draft PRs remain separate: GridAtlas PR16 budget, PR17 transmission links,
  PR18 required-cartridge contract; Cable PR1 legacy repair; GPU PR2 corpus validation.
  GPU PR2 `d8d15892bdae4e3793e8ea20ed1f6e01eb8097a1`, exact CI `34012866161` green.
  Ten synthetic CLI tests reject corrupt histogram/similarity readbacks. Actual
  seven-file GPU run selected Intel xe-lpg, with 1,792 bins and 49 similarities
  verified against CPU. It is not an RTX 5070 measurement.
- A second GPU draft is requested from branch `codex/gpu-benchmark-integrity-20260906`,
  source `34a84b51d7310b8cde9502579b699acd061ed3b0`. Six CLI regressions gate counts,
  timing and independent best-variant selection. Full operation timing now includes
  result readback and resident setup. Actual 1,048,589-byte Intel run returned all
  25 counts correctly (4,099). Historical raw results and both WGSL strings are
  unchanged. Await draft URL and exact CI before acceptance statements.

General estate CI `34013085158` is **not green**: owner-main GridAtlas composition
has a 443,448-character substation cartridge and four link-target failures. This is
separate from the Test Code pinned composition and the unpromoted owner PRs. Do not
hide this behind a passing scoped browser workflow.

## Evidence and continuation

Raw files are under `C:/Users/vikra/OneDrive/Desktop/offline-screenshots/recovery-20260906/`:
`poly0447-layout-negative`, `poly0503-layout`, `poly0503-tool-recovery`,
`poly0504-remove`, `poly0504-layout`, `poly0504-measurement-negative`,
`poly0509-measurement`, `poly0509-print`, and `gpu-{verification,benchmark}-*`.
Publication/CI keeper owns exact live receipts, Spiders acceptance ledger and
coordination append lane. Do not edit its pending homepage/ledger files concurrently.
Claude's latest substantive log text remains 03:43:20 UTC; later file writes did
not add a new instruction. Preserve Claude's Pipeline and grid-engine unfinished work.

Next: complete 0504/0509 publication acceptance, record GPU benchmark draft CI,
continue bounded engineering review until the authorized deadline, then refresh the
Git/CI tracker and write a final handover. The 96-phase review backlog remains
separate from delivery count; no inference that all 96 phases are completed.
