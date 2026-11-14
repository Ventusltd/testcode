# TestCode v2 candidate — independent top-200 solar news proof

**Scope:** draft QA only, never an automatic publisher. Source: the October 2026
REPD top-200 solar project selection in `Ventusltd/globalgrid2050`.
Owner's rule remains **offline first → network only after offline PASS → publish
through separately approved release gates**. This tool implements only the first.

## Source and invocation

Take exact immutable input bytes from the intended repository commits:

- `automation/news/signals/top200_solar.json`
- `project-signals-data/dist/project_signals.json` (current)
- Prior signed `dist/project_signals.json` if checking a refresh

Run:

```sh
node drivers/solar-news-proof.mjs \
  --top200 ./top200_solar.json \
  --candidate ./project_signals.json \
  --previous ./previous_project_signals.json \
  --out ./solar-news-proof.json
node --test examples/test_solar_news_proof.mjs
```

The resulting report records SHA256 of **each input byte stream**, source
measurements, explicit errors/warnings, and a deterministic exit status.
A generated_at increment without a fresh fetched article link is blocked.
Cross-project article URLs are **warnings**, not automatically deleted; a single
multi-site event may legitimately concern multiple REPD IDs.

## Boundaries and follow-up

Structural success is **not** article verification, publisher-licence clearance,
independent REPD alias resolution, grid availability, or production acceptance.
The upstream `confidence: confirmed` field is **not** independently proven
by this driver. An upstream source must eventually supply per-link immutable
receipt IDs, first_seen, source identity, exact fetched URL and licence basis.

This new driver is **deliberately not registered** in existing `engines.json`:
the independent owner/auditor must first check negative fixtures and an actual
pinned candidate plus its previous snapshot. Only after proof can it become a
required estate-wide gate. Do not mutate original Q3 or operative V9.20.
Reviewer handoff: neural-link issue #22, Claude/N3 and ChatGPT Agent 2.
