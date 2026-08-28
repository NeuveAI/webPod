# W5b decisions

## D1 — Reuse the existing browser toolchain without changing dependencies

Playwright and axe are already installed for `packages/panel`. W5b imports and
invokes that exact installation from its package-local location. Adding the
same tools to the root or web app would create a redundant ownership surface
and lockfile churn without changing runtime behavior.

## D2 — The baseline profile proves the experimental canvas API is absent

Every test starts by asserting that `requestPaint` is absent from
`HTMLCanvasElement.prototype`. This is stronger than naming a browser “stable”:
it proves the capability that separates the flagged profile from the baseline
is actually off in the process that produced the evidence.

## D3 — Browser paint evidence is authoritative; custom math fails closed

Axe's browser evaluation is the authority for composited paint. W5b retains
its incomplete records and also walks ancestor, gradient, and pseudo-element
paint. Unsupported images or blend modes are failures, never invented solid
colours. The custom model gates the title gradient where its composition is
closed and records other measurements as advisory instead of claiming false
precision over artwork and layered bloom.

## D4 — Text resize checks leaves and every clipping ancestor

The 272×204 display intentionally clips list viewports. Treating the list
container's scroll height as clipped text makes every correct bounded list a
failure. U11 measures text ranges, checks their own boxes and every clipping
ancestor, and exempts only rows wholly outside the intentional virtual-list
viewport. Partial clipping remains a failure.

## D5 — Product failures stay red

The earlier reduced-motion and light-secondary-text failures were repaired by
W3 in `1693761`. W5b did not edit source. Any future product failure remains
red and is reported rather than repaired from this lane.

## D7 — A mutation is evidence only after control, landing, and attribution

The mutation runner first requires a clean 10/10 run. Each plant then receives
a fresh strict-port server, asserts its changed browser state before emitting a
gate-specific `LANDED` marker, and must fail the selected test. A dirty control,
an unapplied edit, a missing test, and a guard miss are four distinct outcomes.

## D6 — Manual gates are output, not metadata

The runner always prints U14 as owner-only phone-in-hand validation and U15 as
reviewer-only structural inspection, even after Playwright exits non-zero.
Manual gates do not contribute a false automated success and are never omitted.
