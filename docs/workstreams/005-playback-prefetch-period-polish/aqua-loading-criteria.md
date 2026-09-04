# Aqua pending-playback visual acceptance contract

Status: **Ready for design-engineer implementation; owner visual approval required**

This contract corrects the pending-playback progress material only. It does not
reopen the Now Playing layout, playback state machine, or navigation behavior.
The implementation is not acceptable merely because it contains diagonal stripes.
It must read as the compact, recessed, saturated blue Aqua indeterminate bar in
the supplied period reference.

## Authority order

1. The owner's latest explicit correction: the current result is not like the
   Aqua loading bar, and an earlier attempt was far too fast.
2. Primary visual source:
   `/var/folders/ft/7tsjkpcn20q5fx1q8dwv26x80000gn/T/codex-clipboard-975f040d-8ab9-4e31-8b80-2a8905d7fe9e.png`.
3. The real-device geometry and period sources recorded in
   `research/material-sources.md`.
4. Current Apple guidance for honest loading semantics and accessibility only.
5. Existing implementation and tests. They describe the rejected state and are
   not evidence of visual correctness.

The owner-supplied current render at
`/var/folders/ft/7tsjkpcn20q5fx1q8dwv26x80000gn/T/codex-clipboard-ee36f585-0b7e-4875-8759-d7ca59c5dab6.png`
is an explicit anti-reference. Generic design advice is supporting evidence only.
In particular, generic “no gradient” rules do not apply: layered, subtle gradients
are intrinsic to the Aqua gel and recessed-well material shown by the primary
reference.

## What is factually wrong with the current render

The current screenshot preserves the correct overall track bounds, but the
material inside those bounds is wrong:

- It reads as a glowing white/cyan capsule. The reference reads as a thin recessed
  gray well containing a saturated blue gel fill.
- Its `3px` radius on a `5px`-high track makes fully pill-shaped end caps. The
  reference has nearly square, only subtly softened corners and a visible rim.
- The pale bands dominate the surface. The reference's blue bands are materially
  darker, more saturated, and higher contrast against the light bands.
- The stripe wavelength is too broad. Source-raster centerline autocorrelation
  measures about `31px` per repeat over a roughly `20px`-high reference bar
  (`1.55×` bar height). The rejected render measures about `77px` per repeat over
  a roughly `23px`-high bar (`3.35×` bar height): more than twice the reference
  proportion.
- The active material paints over the visual identity of the well. The reference
  retains a dark external boundary and inset separation around the moving fill.
- The current CSS translates the sheet `12px`, while a `12px` repeating gradient
  at `135deg` has a roughly `17px` horizontal repeat. Those distances do not form
  one seamless visual cycle and can produce a phase jump.
- Existing tests prove only that a repeating gradient exists and its duration is
  at least `1.8s`. They do not constrain saturation, contrast, stripe scale,
  end-cap shape, rim visibility, or cycle continuity, so they can approve the
  rejected visual.

As a diagnostic comparison, pixels classified as visibly blue in the supplied
reference crop average approximately `rgb(136 158 222)`; the rejected crop
averages approximately `rgb(169 198 221)`. The current result therefore has a
similar blue channel but lifts red and green enough to become washed-out cyan.
These sampled values are raster evidence, not literal CSS tokens.

## Target visual contract

All geometry below is in the authored `272×204` LCD coordinate system.

### Geometry and construction

| Property | Acceptance target |
| --- | --- |
| Outer track | Preserve `x18, y157, 236×5` exactly. |
| Corner character | Subtly softened rectangle; effective radius `0.5–1px`, never a capsule. |
| Outer boundary | Continuous neutral/dark rim on all four sides; it remains visible while loading. |
| Active material | Contained inside the rim; it must not cover or glow beyond the track boundary. |
| Cross-section | A light upper glint, blue body, and darker lower edge create shallow Aqua gel depth within the five-pixel height. |
| Added UI | None. No shelf, copy, spinner, card, chip, or layout displacement. |

At production raster scale the material may use device pixels for crispness, but
normalizing its measured bounds back to the authored coordinate system must
produce the values above.

### Material and color

- Blue must be the dominant identity. White is a highlight/gap, not the base
  material.
- Use a period-appropriate cornflower/cobalt blue, not pale cyan. At the canonical
  dark-panel capture, the stripe centerline should have a luminance swing of at
  least `80` on the `0–255` sRGB luminance scale and a peak `B-R` channel delta of
  at least `95`. The primary raster is approximately `116–217` in centerline
  luminance with peak `B-R` around `120`; tolerances accommodate browser rastering.
- Preserve a neutral gray/dark well edge distinct from both the blue stripe and
  the white highlight.
- Gradients are required where they reproduce the reference's gel highlight,
  body, lower shading, and recessed rim. Avoid bloom, neon glow, blur, and a large
  glossy white wash.
- Dark and light colourways may tune the neutral rim for contrast, but the active
  blue material must remain recognizably the same object.

### Stripe geometry

- Stripes run on the same right-falling diagonal as the primary source, visually
  about `45deg`.
- The projected horizontal repeat must be `1.35–1.80×` the rendered bar height;
  preferred is `1.55×`. At `5px` logical height this is `6.75–9px`, preferred
  about `7.75px`.
- Dark-blue band and light-gap duty should each occupy roughly half a repeat
  (`40–60%` each). Avoid a broad white field with occasional cyan marks.
- The repeat must remain crisp enough to read as discrete barber-pole ribs at the
  production device scale, without jagged single-pixel noise.

### Cadence and motion

- One animation loop translates exactly one projected horizontal stripe repeat,
  so frame `100%` is visually phase-identical to frame `0%`. No snap or reverse
  is visible at the loop boundary.
- Preferred duration is `3.2s` per repeat; acceptable tuning range is
  `2.8–3.6s`. Anything below `2.8s` fails the owner's explicit “far too fast”
  feedback.
- Motion is constant and quiet: linear drift, no pulse, bounce, acceleration,
  opacity flashing, or whole-bar sweep.
- The bar should communicate ongoing work when observed for one second, but it
  must not compete with artwork or metadata.

## Behaviors that must remain true

- The indeterminate material appears only while playback presentation is
  genuinely pending/starting and the progressbar remains labelled
  `Loading playback` without a determinate ARIA value.
- Authoritative duration/progress replaces the same track with determinate fill;
  no second bar is introduced.
- Artwork, metadata, titlebar, times, and all Now Playing coordinates remain
  stable across pending → determinate.
- The transport indicator and playback state machine retain their current
  semantics; this visual correction must not delay or prolong pending state.
- Failure and permission behavior remain compact and unchanged.
- Dark/light geometry remains identical.

## Reduced motion

Under `prefers-reduced-motion: reduce`, the Aqua bar stays visible at a
deterministic, representative frame with the same rim, blue saturation, stripe
scale, and loading semantics. Its animation must compute to `none`; reduced
motion must not turn the bar into an empty track, determinate fill, or flat cyan
capsule.

## Verifiability matrix

| Requirement | Class | Required proof |
| --- | --- | --- |
| `236×5` bounds and stable Now Playing layout | Easy to verify | Playwright bounding-box assertions at canonical scale. |
| Pending-only state and ARIA semantics | Easy to verify | Existing state-machine/unit tests plus browser DOM assertions. |
| Corner radius, visible rim, contained fill | Easy to verify | Computed-style assertions and magnified screenshot inspection. |
| Stripe period, duty, angle, and seamless displacement | Easy/proxy-verifiable | Computed background parameters plus pixel/autocorrelation measurement from the capture. |
| `2.8–3.6s` linear loop and reduced-motion freeze | Easy to verify | Computed animation assertions at normal and reduced motion. |
| Saturation and luminance separation | Proxy-verifiable | Pixel samples from an interior centerline, compared with the stated tolerances and primary reference. |
| Period-authentic Aqua resemblance | Human judgment | Side-by-side owner review at canonical and production scale; the primary image wins. |
| Restraint within the complete Now Playing screen | Human judgment | Full-screen screenshot review, not an isolated CSS swatch. |

Automated checks are necessary but not sufficient for the final two rows.

## Required screenshot matrix

Capture the full Now Playing screen, not only a cropped bar:

| Colourway | Motion preference | Time sample | Required artifact |
| --- | --- | --- | --- |
| Dark | normal | loop start | `aqua-loading-dark-t0.png` |
| Dark | normal | half loop | `aqua-loading-dark-half.png` |
| Light | normal | loop start | `aqua-loading-light-t0.png` |
| Light | normal | half loop | `aqua-loading-light-half.png` |
| Dark | reduced | deterministic frozen frame | `aqua-loading-dark-reduced.png` |
| Light | reduced | deterministic frozen frame | `aqua-loading-light-reduced.png` |
| Production device | normal | loop start, `390×844` viewport | `aqua-loading-device-mobile.png` |
| Production device | normal | loop start, `1440×900` viewport | `aqua-loading-device-desktop.png` |

Also provide one review board containing: primary reference crop, current
anti-reference crop, and the new canonical dark/light crops at equal **bar-height**
scale. Equalizing bar height is mandatory; comparing raw screenshot widths hides
the stripe-period defect.

## Explicit rejection conditions

Reject the candidate if any one is true:

- It still reads first as white/cyan, fluorescent, glowing, glass-tube, or capsule.
- Effective corner radius exceeds `1.25px` on the authored `5px` track.
- The outer rim disappears under the active fill or any pixel paints outside it.
- Projected stripe repeat falls outside `1.35–1.80×` bar height, or blue/light duty
  falls outside `40–60%` without primary-reference evidence.
- Centerline luminance swing is below `80`, or peak `B-R` is below `95`, in the
  canonical dark capture.
- A loop takes less than `2.8s`, visibly snaps at its boundary, pulses, reverses,
  or sweeps the entire bar.
- Reduced motion hides or materially flattens the loading treatment.
- Pending state adds text or changes any non-progress geometry.
- Tests assert only the presence of a gradient/animation without the visual
  proportions and material constraints above.
- A side-by-side equal-height review does not immediately resemble the primary
  Aqua source to the owner. Human rejection overrides a structurally passing test.

## Quality facets

Scores are `1–5`. Current scores refer to the owner-rejected screenshot; motion is
provisional because a still image cannot directly prove cadence.

| Facet | Meaning here | Current | Target |
| --- | --- | ---: | ---: |
| Period authenticity | Reads as classic Aqua rather than contemporary cyan decoration | 1 | 5 |
| Material depth | Recessed rim and shallow blue gel are legible at five pixels | 2 | 4+ |
| Stripe proportion | Angle, repeat, duty, and continuity match the source | 1 | 5 |
| Calm motion | Clearly active without urgency or distraction | 2 (provisional) | 4+ |
| Screen cohesion | Belongs to the physical iPod Now Playing composition | 2 | 5 |
| Crafted restraint | Every pixel contributes; no glow or ornamental excess | 2 | 4+ |

No facet may score below `4` at owner review, and Period authenticity, Stripe
proportion, and Screen cohesion must score `5`.

## Definition of done

1. The design engineer implements the contract without changing playback or
   Now Playing geometry.
2. Unit/material tests reject capsule radius, broad wavelength, low saturation,
   mismatched animation displacement, too-fast duration, and reduced-motion loss.
3. Browser tests prove geometry, computed motion, state semantics, dark/light
   parity, and reduced-motion behavior.
4. The complete screenshot matrix and equal-height comparison board are produced.
5. Typecheck, lint, focused panel tests, panel Playwright, full repo gates, build,
   and `git diff --check` pass under the repo's `bun`/`bunx` law.
6. An independent visual reviewer reports zero Critical or Major findings against
   this contract.
7. The owner approves the equal-height comparison. Automated checks cannot waive
   this final visual acceptance.
