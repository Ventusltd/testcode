# testcode — the line that runs through everything

> "The test code engine becomes the line that runs through everything logically
> that needs compute" — the architect, 2026-09-05.

One place that knows what is checked in this estate, what is not, and which
checks can be trusted when the network is what has changed.

## The ordering rule, which is the whole design

    1. offline    run on the machine, no socket.  If any fails, stop.
    2. network    only after 1 is green.
    3. publish    only after 2.  Nothing here publishes.

It is enforced by `run.mjs` rather than described by it: the network phase does
not execute while an offline gate is red, and the runner says so in words rather
than skipping quietly.

> "workflows that auto run on github BUT ONLY AFTER they have been proven to
> work offline on the machine first"

That is why the default of `node run.mjs` is offline-only. Asking for the
network is an explicit `--with-network`.

## Why it exists

On 2026-09-05 the MAP button in Pipeline News was measured pointing at
`https://globalgrid2050.com/repd_grid_atlasv8/` — a page that serves perfectly
well and carries **no engine at all**: no cartridge, no `current.json`, no
nearest-substation path. 21,045 bytes with zero engine markers, against 20
cartridge references in the v9 shell. Every MAP click landed somewhere inert.

Nothing caught it, and nothing could have. It was not a broken link — a link
checker would have called it green. It was a link to something that answers and
does nothing, and no gate in the estate knew the difference.

That is the class of fault this repository exists for: **the check that nobody
wrote, because the failure looked like success.**

## Usage

    node run.mjs                  offline gates only (the default)
    node run.mjs --with-network   offline first, then network, only if green
    node run.mjs --list           what is registered, and what is not green

    node drivers/menu-map.mjs     map every menu on every surface, offline

Each gate runs in its own child process, so one failure cannot hide the state of
every gate after it. A report that stops at the first problem is how a second
problem survives to production.

## What is registered

`engines.json` is the registry. It records, for each gate, the one fact that
decides where it may run — whether it needs a network — and, where a gate is
**not** green, why.

`cvaa` is registered and is **not** passing: `tools/selftest.mjs` crashes on a
Windows path fault, `replay.mjs` crashes when `e.stdout` is null, and the
`disk-is-not-what-ships` antibody never sees `.gitattributes`, so it is false on
all nine repos. It is listed anyway. **A registry that lists only the gates that
pass is the same lie as a suite that cannot fail.**

## The menus driver

`drivers/menu-map.mjs` maps every menu on every surface from the **composed
bytes** in the local clones — never the network, never a part that might not
have been composed — and emits `menu-map.json`.

Menus are where this estate has repeatedly lost things: a control moved into a
collapsed panel and read as "branding has been lost"; an attribution box that
overlapped the EDIT panel's own controls; a File menu that listed 11 of 44
engine nodes because it filtered on one node type.

The driver caught its own version of that on first run. It read `../gridatlas`,
which on this machine is parked on a candidate branch at an older generation,
and reported that the engine rows were missing. They were not missing; they were
absent from the composition that clone happened to be sitting on. It now prefers
a checkout on `main` and reports the branch and generation it read, because **a
measurement that does not name the bytes it read is not a measurement.**

It also records the surfaces that have **no** menu yet — Pipeline News, the
homepage, the federation map. Those are open gaps, not passing states.

## What this repository does not do

It does not rewrite anyone's code. The engine publishes the deep-link contract
(`ventus-grid-engine/deeplink/receivers.json`) and this runs the audit; the fix
lands in the consumer's own repository under its own governance.

The cure for a link that silently went nowhere must not be a workflow that
silently rewrites links across the estate.

## Rules inherited from the estate

- Proofs read composed bytes, never parts.
- Make a proof fail before trusting it.
- A skip is not a pass. A missing input must fail, never skip.
- Report measurements, never grade them.
- A check built only from cases the code already passes cannot fail.
