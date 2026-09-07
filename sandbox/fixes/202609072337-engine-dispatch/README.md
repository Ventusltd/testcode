# 202609072337 · v9.148 · every arrival names the engine that answered it

The cable-engine rule made observable, and the root promotion that puts it in
front of a reader.

## The rule

A class selects the **question**. It never selects whether a question is
**answered**. An earlier version gated measurement on technology and offshore
projects were withheld entirely; that branch was removed deliberately. This
version makes the rule checkable instead of merely stated.

## What was wrong

Eleven separate paths could end an arrival with nothing published at all: an
interconnector handover, a stale epoch, a cancelled owner, a register miss, a
failed identity check, unusable coordinates, an absent substation payload, a
superseded selection, a caught error, an invalidated arrival, and a
substation-origin selection. A reader could not tell a map that had answered
from a map that had given up, and neither could a test.

## What changed

Every arrival now leaves `arrival_engine` on the published surface:

```
{ engine: 'onshore' | 'offshore' | 'interconnector',
  answered: true | false,
  reason: null | 'NO_USABLE_COORDINATES' | 'NEAREST_BEYOND_40_KM' | ...,
  fallback_from: null | 'declared_connection_point' }
```

Six edits: the surface carries it from boot, a writer and classifier own it,
the measured path records the answer including the true nearest beyond the
search budget, the interconnector handover records itself as answered rather
than silent, unusable coordinates say so instead of returning quietly, and
clearing a selection clears the answer with it.

**Offshore is named honestly.** An export cable lands at a declared onshore
point. Until that declaration exists, offshore is answered by the onshore
engine, and that is now labelled a fallback rather than passed off as the
answer.

## Root promoted the same night

Root had served `202609060259` all day: a different cartridge set, eleven
versions behind on the sld-sandbox, and predating the change that reports a
true distance when nothing lies inside the search budget. Every defect
reported that day was seen on it. Root now serves `202609071232`, every
cartridge verified against its recorded hash before the pointer moved, carrying
its evidence in the file. `root-current.json` here is the promoted pointer as
published.

## Predecessors, all still published and untouched

`202609071232` (v9.146) · `202609072329` (v9.147, card arrives minimised)
