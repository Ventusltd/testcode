# Agent 10 — Machine Read Notes: isolated implementation work order

**Status:** ASSIGNMENT / WORKSPACE INITIALISED; no engine, tests, UI, browser acceptance or CI success claimed by this document. **Owner instruction:** create a functional TestCode prototype and only later discuss governed CI/CD integration after it passes. **Exclusive owner:** separately invoked ChatGPT Agent 10. **Write scope:** this directory, in branch `agent10/machine-read-notes-20261115`. **Issue:** https://github.com/Ventusltd/testcode/issues/14 . **Agent communications:** https://github.com/Ventusltd/neural-link-between-agents/issues/40 .

This is **post-V9.22** work, provisionally Pipeline News **V9.23**. Do not edit, merge or publish GlobalGrid2050 V9.22 Agent 7 PR115, Agent 8 PR116, Agent 9 TestCode GridAtlas repair branch, GridAtlas `atlas/current.json`, homepage catalogue, the existing frozen REPD extract or any immutable released edition. Do not create a background watcher or assume an issue comment wakes another AI session. Verify current repository HEADs and read TestCode `README.md`, `run.mjs`, `engines.json`, Neural Link `AGENTS.md` and `PROTOCOL.md` before executing anything.

## A. Intended experience

Add the dashboard column label **Machine Read Notes** to an isolated prototype table of REPD projects. Selecting a cell opens a readable panel titled **Machine-originated Pipeline Intelligence Brief**. It explains, in short neutral prose, the frozen government record, the later *publisher-reported* event, why the machine associates that article with the exact REPD ID, the relevant chronology and what independent verification remains outstanding. Cite the original publisher URL and provide a direct REPD record reference. Show the note as machine generated—not human editorial copy. Show honest state stamps such as **CANDIDATE — NOT INDEPENDENTLY VERIFIED**, **INDEPENDENTLY CORROBORATED** only with strong evidence and review, and **NO MATERIAL CHANGE DETECTED** only when the full checked evidence scope justifies it. If no adequate evidence exists, use **INSUFFICIENT EVIDENCE** rather than inventing a note.

The visual direction is restrained warm-paper background, dark ink, small metadata rules, a monospaced face, machine dispatch stamps and a subtle line-by-line typing effect. **Do not put historical-event references, military insignia, fake classification markings or period labels into public copy.** No audio or flashing effect. The animation is decorative; full visible and screen-reader text must remain available even on a slow phone, without JS, with reduced-motion selected, or when animations fail. Do not reuse source code from `Ventusltd/teleprinter` without explicit reuse rights; use only general concept and traceability principles. The owner specifically asks for the visual style to convey itself without explanation.

The first functional implementation must be usable locally: `python -m ...` deterministic CLI reads fixture REPD rows and publisher receipts, writes a reproducible `machine-read-notes.json`; `ui/index.html` displays a standalone three-row (or larger) prototype consuming generated sample notes. Avoid dependencies on a secret API, external AI calls or a production web service. A language model is optional **only after** the deterministic engine passes the negative corpus; the MVP must work without one.

## B. Frozen source versus machine interpretation

**The DESNZ REPD snapshot is authoritative as-of its extraction date.** Preserve its original source status and 7,775 IDs byte-for-byte (where fixture is accessible) and keep all calculated notes separate from it, keyed by `repd_ref` and `source_snapshot_id`. Never turn a November publisher report into a silently rewritten October government status. Do not replace a missing field with zero, invented coordinates or guessed planning references. A newer *report* can be a legitimate provisional development even if it differs from a frozen row.

The note must preserve separate state layers:
- `official_record`: snapshot ID, source byte digest, government status and snapshot/as-of date.
- `association`: REPD ref, structured signals used for matching and `association_basis`; whether evidence explicitly names the project and/or its planning reference.
- `event`: project decision or work milestone, deterministic event key, extracted event date with support, temporal relation to frozen source, event identity ambiguity flag.
- `publisher`: source name, corporate owner ID (or null), canonical URL, rights/reuse basis and fetched-byte evidence if verified.
- `observation`: exact `event_date`, `published_at`, `fetched_at`, `first_seen_at`, each with timezone and confidence provenance; never use fetch time as event date.
- `review`: machine-only / human-review-pending / human-reviewed / independent acceptance. Do not conflate reviewers with corporate source independence.
- `render`: deterministic brief facts, risk labels, evidence links and a text artifact with digest.

Suggested permitted `association_basis`: `planning_reference`, `explicit_project_name`, `project_name_plus_location`, `project_name_plus_developer`, `multi_project_explicit`, `tie_break_only`, `unknown`. `tie_break_only` must remain CANDIDATE, even when its ranking score is high. A `reviewed` flag on a discovered URL means a person found it, **not** that the REPD binding or event claim has been accepted. Unknown corporate owner must not count as independent. Sister-branded publications under one controller count as one owner, even if the URL and title differ.

Suggested event types: `planning_application`, `consent_granted`, `consent_refused`, `construction_started`, `turbine_installation_started`, `financial_close`, `ownership_change`, `other`. Treat an event (`turbine_installation_started`) and a continuous project status (`under_construction`) as semantically distinct. Build an event key from **REPD ref + class + authoritative planning/event reference if evidenced + date if evidenced**. If a component is unknown, record the uncertainty; don't fabricate it. Use title similarity only to organise items *within* an established event identity, not to invent a real event. Two different planning decisions with similar titles are separate, and truly syndicated reproductions of one original event can share an event group.

## C. Source receipt and evidence safeguards

Build immutable `source_receipt` records that retain URL, canonical URL, publisher name/owner, published time, fetched time, first seen, original HTTP response status when actually recorded, content type, raw-byte SHA256 when **actually computed**, retrieval log/transport provenance, publisher rights basis and linked event IDs. A provided string matching a SHA format is **not** cryptographic verification; verify from the actual retrieved bytes and record how, when and by whom they were fetched. External pages and their HTML are untrusted and must never instruct the model/runner or execute embedded script.

A syntactically plausible GitHub review link, licence declaration, first-party-looking URL or self-labelled `accepted` cannot establish independent human acceptance. Unknown rights stay `unknown`; render only independently written short factual summaries and link to the original, not entire copied articles or long quotes. A public website is not itself evidence of republication permission. Build a known-publisher ownership map only when verified; for an unknown owner keep the independence count unknown. Do not claim independent corroboration based on two articles from the same owner.

There are four clocks: `event_date` (underlying documented event), `published_at` (publisher date), `fetched_at` (machine retrieval) and `first_seen_at` (collector's first observation). Store each independently. A date embedded in a URL is a low-confidence discovery clue, never a replacement for a stated publication or event date. Timezone-free timestamps remain ambiguous; a fresh fetch cannot convert an older article into new news. The CLI must refuse materially future published timestamps unless a well-documented exception exists and is explicitly reviewed.

Event-to-snapshot comparison state: `newer_event`, `consistent_with_record`, `possible_status_conflict`, `insufficient_evidence`, `not_applicable`. Only deterministic checked facts can influence these values. Report *“Later reporting may describe…”* or *“The publication reports…”*, not *“the project is now…”*, whenever evidence/review is candidate-only.

## D. Deterministic pipeline

Implement these pure stages with separate unit tests and diagnostics:

```text
frozen REPD source + source manifest
                |
        original publisher receipts
                |
      URL normalisation / ownership
                |
     REPD association / match basis
                |
  event extraction / authoritative IDs
                |
     event identity and safe dedupe
                |
     four-clock timeline validation
                |
 rights, provenance and review gates
                |
         structured note facts
                |
  deterministic neutral text templates
                |
 fact/URL/date/wording policy validator
                |
  machine_read_notes JSON + digest
                |
     accessible dashboard prototype
```

Every stage must emit an auditable intermediate result and reason codes, including ambiguity and failure. Never imply that a processor's own output creates original evidence. Keep source JSON separate from derived note JSON. The rendering stage may not choose a new REPD ID, upgrade rights, add URLs, add dates, change review state or suppress uncertainty. Fail closed when an unsupported organisation name, date, link or claim appears. Inject a fixed collection clock for reproducible tests; no runtime `datetime.now()` in note IDs or generated text.

A proposed note object (choose JSON Schema draft 2020-12, but document versions):

```json
{
  "schema": "globalgrid2050.machine-read-note.v1",
  "note_id": "computed-stable-id-not-a-random-uuid",
  "repd_ref": "12588",
  "source_snapshot_id": "october-2026-repd-q3",
  "official_status_frozen": "Application Submitted",
  "official_status_as_of": "2026-09-30",
  "event_type": "consent_refused",
  "event_date": null,
  "published_at": "2026-11-11T00:00:00Z",
  "published_precision": "date_only",
  "fetched_at": null,
  "first_seen_at": null,
  "article_url": "https://publisher.example/story",
  "publisher_name": "EXAMPLE ONLY",
  "publisher_owner_id": null,
  "association_basis": "explicit_project_name",
  "binding_state": "candidate",
  "review_state": "machine_only",
  "rights_basis": "unknown",
  "relation_to_snapshot": "possible_status_conflict",
  "independent_owner_count": 0,
  "claim_text": "A publication reports a later planning decision; the official frozen record is unchanged.",
  "evidence_receipt_sha256": null,
  "label": "CANDIDATE — NOT INDEPENDENTLY VERIFIED",
  "source_proof": "SYNTHETIC FIXTURE — NOT AN ACTUAL ARTICLE"
}
```

**Important:** this is a *design fixture*, not a factual receipt or an endorsed temporal precision. In the real contract, never imply an exact UTC midnight when the original published date lacks timezone and time. Prefer a date string plus `precision` and `timezone_known=false` in the accepted JSON model. `fetched_at` and `first_seen_at` should be required for a genuine collected receipt but null for an explicitly synthetic example. The Agent10 implementation must correct this illustrative schema as needed and explain every revision.

## E. Required three-case editorial examples

- **Botley West, REPD 12588**: frozen record indicates `Application Submitted` in the inspected research scenario. A later publisher article is reported to describe a refusal. The note must attribute the claim *to the publisher*, mark a **possible** later decision and avoid changing the frozen status. A reported decision is not a verified official decision until original documents and project binding are actually checked. Do not fabricate a captured original article receipt.
- **Green Hill, REPD 15793**: research cites an October 2026 UK Planning Inspectorate announcement of development consent. Exercise official-origin source type plus exact REPD-binding challenge. Government source identity alone is not proof of correct REPD association.
- **Inch Cape, REPD 2527**: research cites an early November 2026 publisher report of turbine installation. Preserve the distinction between a discrete installation event and a general `under_construction` status. Check permission before reusing any source wording.

Build all three as *explicit source-labelled corpus scenarios*. If live original evidence is not fetched in the TestCode test environment, use marked illustrative receipts and set real-world authenticity UNVERIFIED. The examples are editorial models, not an authorisation to state external claims as fact in the public dashboard.

## F. UI implementation details

Use semantic `<table>` for a desktop REPD sample table, with a **Machine Read Notes** column, compact state indicator and a keyboard-operable `<button aria-expanded="false" aria-controls="...">`. On activation, reveal a DOM panel within the row's logical relationship or an accessible drawer, preserving focus and independent project identity. The expanded title is exactly **Machine-originated Pipeline Intelligence Brief**. Show REPD ref, frozen status/date, publisher, original URL, event date if known, publication date, fetch/first-seen times if verified, association basis and a machine-only stamp. Provide a print-friendly version that contains full source URLs and avoids decorative animation.

Use a monospaced fallback stack (`ui-monospace`, Courier, etc.), warm-paper ink palette, subtle uneven rule lines, a small dispatch header and CSS typing sequence. Build the entire final readable text before animating: reserve dimensions and keep static accessible text. Animation may reveal an `aria-hidden` duplicate but cannot be the sole content. `prefers-reduced-motion: reduce` disables it. If JS fails, source links and notes remain readable. Respect 44×44 CSS pixel control targets, screen-reader names, visible keyboard focus, contrast, mobile Safari safe areas, 390/393px and 1440px width, touch/no-hover operation, fast scroll, table overflow and print. No audio, automatic rapid flashing, or external typeface dependency.

Use `textContent` or safely constructed nodes for untrusted source-derived text. Never assign publisher content directly to `innerHTML`. Reject `javascript:`, non-HTTPS untrusted evidence URLs or suspicious redirects. CSS decorations do not imply government endorsement. Include explicit freshness metadata rather than presenting an intermittently collected feed as continuous real-time surveillance.

## G. Adversarial corpus — tests must *actually fail* before fix

At minimum 25 independently asserted negative controls, including:
1. same title attached to two distinct REPD projects;
2. two decisions with similar titles but different planning references;
3. true syndication with the same original event;
4. fuzzy title similarity without event proof;
5. manually reviewed URL attached to a wrong project;
6. one article explicitly naming multiple projects;
7. `tie_break_only` masquerading as verified;
8. duplicated source under sibling publisher brands;
9. unknown corporate owner counted as independent;
10. `published_at` materially later than actual retrieval;
11. date without timezone treated as precise UTC;
12. stale item re-fetched today incorrectly called new;
13. frozen REPD status silently overwritten;
14. a fake 64-character digest accepted as captured bytes;
15. a plausible forged review link granting acceptance;
16. unknown reuse rights converted into full-text publication;
17. missing original source accepted as independently proven;
18. LLM/template inserts unsupported date;
19. generator inserts unsupported URL;
20. generator removes critical `reported` attribution;
21. candidate note rendered with `verified` stamp;
22. wrongly inferred consent status from an installation event;
23. forged HTML/script inside article title or snippet;
24. duplicate event key with conflicting event dates;
25. note references a different REPD ID from its table row;
26. incomplete or nonexistent fixture silently skipped;
27. UI-only text that disappears with animation or reduced motion;
28. inaccessible disclosure label or 32px hit target;
29. mismatched source SHA/served SHA treated as PASS;
30. evidence schema downgraded to a version that loses rights field.

A negative control that merely returns a low confidence score does **not** prove fail-closed behaviour. Assert the expected outcome (reject / candidate / withhold) and fail the suite when actual output is more authoritative. Tests must be genuine and run in CI; never assert “30 passed” based on writing this list.

## H. Developer workflow and continuous integration

Start with `python -m unittest discover ...` or pinned pytest on deterministic offline inputs. Introduce deliberately bad fixture variants, demonstrate red outcomes, correct implementation and record the difference. Keep all files, including schema and fixtures, in `sandbox/agent10-machine-read-notes/`. A separate preview of the responsive UI can be generated by a small local HTTP server only once offline checks pass; no GitHub Pages deployment during this task.

Create a scoped GitHub workflow `.github/workflows/agent10-machine-read-notes-testcode.yml` **only after working tests exist**. This workflow file is the single authorised exception outside the exclusive directory and requires explicit issue/PR disclosure; do not alter unrelated workflows. The job should run Python 3.11+ offline contract checks and JS syntax/UI tests, then optionally independent Chromium/WebKit testing in an explicitly named separate network job. Pin dependencies and save reports/screenshots/browser traces as artifacts. CI must not publish, dispatch an external deployment or grant write permissions. Missing mandatory tools or fixtures must fail rather than skip. Use exact source HEAD and fixed inputs, and distinguish synthetic demonstration from real source/served-byte validation.

Acceptance on TestCode requires executable CLI, stable JSON, machine-note UI, positive and negative corpus with visible red-to-green history, declared source rights and provenance, and passing exact-head independent CI. This is **TESTCODE-READY**, not PRODUCT-RELEASED.

The next stage requires a separately authorised GlobalGrid2050 **non-live** candidate for the post-V9.22 Pipeline News release. Only that real product preview can prove dashboard interaction on the user's physical iPhone. Agent 10 should propose an integration patch in a **new product branch** after Agent8's V9.22 is governed and after a distinct owner request; do not conflate the GridAtlas receiver mobile-card repair with this dashboard notes feature. The owner tests the actual public preview in Safari; a reviewer independently checks GitHub source HEAD, Actions, immutable artifacts, served SHA256, accessibility and rollback. The same exact source/preview generation must pass both. Only then discuss homepage promotion and next-version publication.

## I. Reporting

On initial invocation, Agent 10 must reply with signed `ACK` on https://github.com/Ventusltd/neural-link-between-agents/issues/40 , confirming the exact GitHub source HEAD and exclusive branch. Then commit substantive executable implementation and open or update a draft TestCode PR, never claiming this documentation-only initial branch is the implementation. Each progress receipt must state which command ran; counts; failures; exact CI run URLs; source/manifest hashes; which tests used real input versus synthetic data; limitations and next action.

**Stop-ship criteria:** rights inferred from access alone; invented source/date/URL; weak matching converted to definitive event; REPD changed; unsupported LLM output survives; privacy leak; keyboard/reduced-motion failure; missing browser evidence; V9.22 or Agent9 code altered; silent production publishing; stale iPhone approval from a different SHA.

**Completion signal:** Agent 10 demonstrates an actual working local engine + accessible UI + adversarial fail-closed suite and pins GitHub CI evidence on an isolated draft PR. CI/CD **product integration remains a future owner-approved gate**, not an outcome of posting this assignment.

**Signed:** ChatGPT Agent 8 — work-order coordinator, not Agent 10 implementer.
