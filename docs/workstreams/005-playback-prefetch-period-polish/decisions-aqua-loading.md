# Aqua loading remake decisions

These choices are reversible tuning decisions inside the binding thresholds in
`aqua-loading-criteria.md`. The owner reference remains authoritative.

## DAQ-01 — reference-scale stripe geometry

- Chosen projected horizontal repeat: `7.75px` (`1.55×` the authored `5px`
  bar height).
- CSS gradient-line repeat at `45deg`: `5.48px`; `5.48 / sin(45deg)` is
  `7.75px` to browser precision.
- Blue stop: `2.85px`, or `52%` of the repeat; the light interval is `48%`.
- Why: this is the acceptance contract's preferred normalized measurement and
  eliminates the broad wavelength visible in the anti-reference. CSS `45deg`
  makes constant-color bands fall right (`\\`) as y increases, matching the
  primary raster; `135deg` was the mirrored right-rising (`/`) interpretation.

## DAQ-02 — calm, exact-loop cadence

- Chosen duration: `3.2s` per repeat, linear.
- Chosen displacement: exactly `7.75px`, the projected repeat.
- Why: `3.2s` is the preferred contract cadence and makes the loop
  phase-identical without a snap at the boundary.

## DAQ-03 — cobalt Aqua palette and depth

- Active ribs: `#5278cc`; light ribs: `#c2d2ee`.
- Duty: `52/48`, so the cobalt remains the dominant identity without removing
  the period white-blue contrast.
- Depth: one inset upper glint and one darker lower edge; no blur, glow, bloom,
  or glossy full-height wash.
- Why: the pair produces a measured `90.63` luma swing and `122` peak `B-R`
  delta in the canonical dark capture while avoiding the anti-reference's pale
  cyan cast.

## DAQ-04 — rim and reduced-motion frame

- Track radius: `1px`; continuous theme-aware neutral border: `1px`.
- Reduced motion: animation computes to `none`; the stripe sheet is held at
  half-phase (`3.875px`) with material and semantics intact.
- Why: the period reference reads as a recessed, subtly softened rectangle,
  and a half-phase frame is a deterministic representative still.
