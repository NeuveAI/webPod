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

## D8 — The isolated server proves which source bytes it is serving

The Playwright configuration fingerprints the browser application, package
sources, manifests, lockfile, Vite configuration, and fingerprint helper before
it starts the strict-port server. The expected digest is passed into that new
process. A development-only health endpoint recomputes the digest from current
working-tree bytes on every request, and every test compares expected, served,
and file count before exercising a gate. This detects stale servers and source
changes during a run; it does not confuse `HEAD` with the dirty bytes Vite can
actually compile. The `SOURCE` plant returns a mismatched health digest and
makes U1 red.

## D9 — Reduced transparency is an exhaustive paint invariant

U4 inventories every visible element and pseudo-element in all 48
state/screen/colourway combinations. Under `prefers-reduced-transparency`, any
backdrop filter, translucent background colour, or translucent gradient stop is
a failure. Title bars and Now Playing metadata scrims must become opaque while
remaining within 0.005 relative luminance of the unreduced composition. Product
CSS therefore supplies explicit solid title, metadata, and divider tokens and
removes the artwork bloom and shadow. A translucent title/metadata plant proves
the inventory is not vacuous.

## D10 — A contrast failure is never advisory

U7 accepts zero visible text failures. Axe runs in the browser, while the
supplementary evaluator resolves ancestor, gradient, opacity, and pseudo-element
paint and fails closed when it cannot bound a surface. The title-side artist and
battery glyph are named coverage requirements in both colourways because those
were the four failures the earlier gate accepted. The corrected tertiary tokens
are `#8b939e` on dark and `#52647a` on light; the recorded minimum for every
visible leaf is at least its 4.5:1 body-text or 3:1 large-text threshold.

## D11 — Density and raster scale are separate U11 obligations

At both 130% and 200% Dynamic Type, U11 asserts airy density and a raster scale
of exactly 1.25. At 200% it additionally measures the stage at no less than
340×255 CSS pixels and retains the leaf/ancestor clipping sweep. A plant that
forces the custom property back to 1 turns U11 red even if density remains airy.

## D12 — Nested native controls keep native keyboard semantics

The panel application handles wheel keys only when the panel surface itself is
the event target. Enter and Space from the S13 Love button therefore remain
browser-native rather than bubbling into the panel's centre-button handler.
U12 tabs through both colourways, checks focus visibility, and requires both
Enter and Space to activate each button. Removing either button from tab order
turns the gate red; there is no optional-action branch.

## D13 — The production announcer is one leased driver per document

`PanelSurface` acquires `startAnnouncer` in an effect. A document-keyed,
reference-counted lease starts one driver for the two colourways and stops it
after the final cleanup, including React Strict Mode setup/cleanup cycles. U13
drives thirty real wheel events through the production handler, waits for one
observed quiet period, and requires exactly one sequence-stamped live-region
publication whose text names the settled final row. Independent plants prove
that duplicate publications and stale first-detent content both turn it red.

## D14 — Gradient stops are not a contrast bound

Checking only declared gradient stops is unsound: `#767676` text clears 4.5:1
against both `#000` and `#fff`, while the continuous gradient between them
contains the text colour and therefore reaches 1:1. U7 now represents every
adjacent pair of resolved RGBA stops as a channel-and-alpha bounding box,
propagates those boxes conservatively through opacity and compositing, and
compares foreground and background luminance intervals. Overlapping intervals
return a 1:1 lower bound. The `U7_INTERPOLATION` plant records endpoint ratios
4.623 and 4.542, then proves the interior bound makes only U7 red.
