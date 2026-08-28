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

## D3 — Axe incompletes are resolved, not silently counted as passes

Axe cannot infer contrast through the title gradient or the Now Playing pseudo
element. W5b retains those incomplete records in `w5b-u7-contrast.json`, then
independently composites computed foreground/background colours and applies
the literal 4.5:1 body / 3:1 large-text thresholds. Zero axe violations alone
is not accepted as U7 evidence.

## D4 — Text resize checks leaves, not intentional viewport containers

The 272×204 display intentionally clips list viewports. Treating the list
container's scroll height as clipped text makes every correct bounded list a
failure. U11 therefore inspects visible elements with direct text nodes and
fails only when a rendered text leaf overflows or actively ellipsizes at 200%.

## D5 — Product failures stay red

The reduced-motion specificity defect and 4.3851:1 light secondary text are
real product failures. W5b records them and exits non-zero. The dispatch
forbids source edits, so this lane does not weaken the assertions, add
exceptions, or repair panel CSS.

## D6 — Manual gates are output, not metadata

The runner always prints U14 as owner-only phone-in-hand validation and U15 as
reviewer-only structural inspection, even after Playwright exits non-zero.
Manual gates do not contribute a false automated success and are never omitted.
