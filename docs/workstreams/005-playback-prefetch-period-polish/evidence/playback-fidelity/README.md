# Playback fidelity evidence manifest

Generated 2026-09-04 from the existing user-facing panel fixture and production
CompositeDevice routes. No proof-only product route was added.

## Canonical LCD matrix

- Determinate, dark: `progress-dark-0.png`, `progress-dark-35.png`,
  `progress-dark-100.png`
- Determinate, light: `progress-light-0.png`, `progress-light-35.png`,
  `progress-light-100.png`
- Volume, dark: `volume-dark-0.png`, `volume-dark-50.png`,
  `volume-dark-100.png`, `volume-dark-reduced.png`
- Volume, light: `volume-light-0.png`, `volume-light-50.png`,
  `volume-light-100.png`, `volume-light-reduced.png`
- Loading, dark: `loading-dark-t0.png`, `loading-dark-1600.png`,
  `loading-dark-3200.png`, `loading-dark-reduced.png`
- Loading, light: `loading-light-t0.png`, `loading-light-1600.png`,
  `loading-light-3200.png`, `loading-light-reduced.png`

## Production-device matrix

- Loading: `loading-device-mobile-390x844.png`,
  `loading-device-desktop-1440x900.png`
- Determinate: `progress-device-mobile-390x844.png`,
  `progress-device-desktop-1440x900.png`
- Volume: `volume-device-mobile-390x844.png`,
  `volume-device-desktop-1440x900.png`
- Route framing controls: `production-device-list-mobile-390x844.png`,
  `production-device-list-desktop-1440x900.png`

Each production capture contains the complete physical device inside the named
viewport; no LCD-only crop is presented as production evidence.

## Owner-corrected Aqua source and comparison

- Full source conversions: `reference-IMG_2280.png`, `reference-IMG_2281.png`
- Source LCD crops: `reference-IMG_2280-lcd.png`, `reference-IMG_2281-lcd.png`
- Owner Aqua raster and crops: `reference-owner-aqua-full.png`,
  `reference-owner-aqua-controls.png`,
  `reference-owner-aqua-progress-detail.png`,
  `reference-owner-aqua-loading-detail.png`, and the normalized source crops.
- Owner-rejected flat-frame anti-reference: `rejected-flat-trough-detail.png` and
  `rejected-flat-trough-normalized.png`.
- Final candidate close-ups: `candidate-progress-0-closeup.png`,
  `candidate-progress-35-closeup.png`, `candidate-progress-100-closeup.png`,
  `candidate-loading-closeup.png`, `candidate-volume-50-closeup.png`, and the two
  asymmetric corner crops.
- Equal-LCD-height board: `reference-board.html`, `reference-board.png`
- Dedicated molded-trough board: `outer-trough-comparison.html`,
  `outer-trough-comparison.png`

The main board normalizes photographed and candidate LCDs to `408px` display
height. Both boards normalize the Aqua trough to `28px` raster height once, then
use `4x` nearest-neighbor enlargement. The trough board includes the primary
determinate and striped source, owner-rejected result, corrected `0/35/100`,
loading, volume, more than 40% empty channel at the mixed state, rendered vertical
and horizontal slices, numeric plots, and asymmetric corner insets.

## Computed and behavioral proof

- `bar-pixel-geometry-manifest.json`: normative outer/inner geometry, ratios,
  fill endpoints, Aqua period/duty/direction, and unchanged upper anchors.
- `progress-geometry.json`: rendered `0/35/100` determinate geometry and material.
- `volume-geometry.json`: rendered `0/50/100` volume geometry, exact fill
  endpoints `36/136/236`, zero-duration volume fill swap, and stable anchors.
- `loading-computed.json`: rendered normal/reduced animation and material values.
- `aqua-cylinder-cross-sections.json`: screenshot-derived row RGB/luminance for
  progress, volume, loading-blue, and loading-light; fill deltas, darkest row,
  discontinuity, normalized profile equality, and exact phase continuity.
- `aqua-outer-trough-cross-sections.json`: independently sampled empty-channel
  vertical/horizontal profiles, perimeter values, corner masks, local background,
  two-stage cast falloff, theme-resolved alpha tokens, seam contrast, channel
  range/bins/smoothness, and transition widths.
- `volume-timing-trace.json`: `32ms` input-to-visible in the final capture run,
  accepted-input dwell reset,
  `1499ms` visible/`1500ms` hidden, and clamped no-op non-reset.
- `quadrant-boundary-no-double-action-trace.json`: annulus ownership, diagonal
  boundaries, mounted `36.999/37/37.001` radial ownership, `10px` tap,
  `10.01px` takeover, oblique mouse/touch/pen projection, and no double action.

The executable producers are `packages/panel/e2e/panel.e2e.ts` and
`apps/web/tests/lcd-fidelity.e2e.ts`; click-wheel trace claims are covered by the
device and composite integration cases named in the trace.

## Final quiet-host browser recheck

The two host-budget-limited cases later passed together, and the complete panel
browser suite then passed **20/20**. See `quiet-host-recheck.md` for the commands
and timings. No implementation change was needed.

## Owner material correction results

- All three controls now measure `14px` outer / `12px` nominal channel at authored
  scale (`28px/24px` in canonical evidence), at the shared `y153..167` band.
- Progress/volume fill profiles are pixel-identical at the sampled cross-section;
  top-minus-waist is `81.12`, bottom-minus-waist `63.55`, darkest row fraction
  `0.5208`, and maximum isolated row discontinuity `9.42`.
- Loading blue/light ribs both curve: top-minus-waist `42.54/40.06`,
  bottom-minus-waist `41.33/37.84`; half phase is exactly `11px` authored and full
  phase closes pixel-identically with maximum RGB-channel delta `0` across the
  `464x24` stable interior.
- Empty channel range is `24.35` across four eight-point bins with maximum adjacent
  jump `5.93`. The four perimeter samples produce three distinct values over a
  `112.13` range; left/right seam contrasts are `125.06/100.13`; maximum horizontal
  drift is `1.00` per 40 device pixels. Measured left/right/max transition widths
  are `4/4/4px` and the corner occupancy assertions pass.
- The dark two-stage cast peak is `8.28..8.58` and the light peak is
  `32.53..34.07` luminance points across progress/volume captures; each fades
  independently through relative rows `28..31`, satisfying the theme-aware PM
  adjudication.
