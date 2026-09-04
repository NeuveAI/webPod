# PM acceptance review — Aqua cylinder and molded-trough correction

Date: 2026-09-05

## Verdict

**ACCEPT**

The corrected rendered product satisfies DPF-10, D005-12, D005-13, and the
adaptive-shadow/loop-closure corrections in the PM contract. It is no longer the
owner-rejected flat cyan fill inside a uniform gray rectangle. Progress, loading,
and volume now read as one classic Aqua control family: a cylindrical blue
material inside a separately molded recessed trough.

There are **zero unresolved Critical, Major, or Minor findings**. One non-blocking
evidence finding was corrected before this verdict: the evidence README now
reports the final sampled ranges and the correction diary records the frozen
implementation and verification run. The result is ready for the owner's separate
live visual approval. PM acceptance does not replace that owner gate.

## Sources and evidence reviewed

I re-read the current workstream scope, playback-fidelity scope and dispatch, the
corrected PM memo, DPF-10, and D005-12/13. I inspected the owner's complete Aqua
raster and the flat uniform-frame crop as positive and negative authorities,
respectively.

I inspected `evidence/playback-fidelity/outer-trough-comparison.png` at original
detail, followed by the individual source/rejection/candidate close-ups, asymmetric
corner crops, canonical dark/light progress, loading and volume captures, and the
current geometry, computed-style, cylinder-cross-section and outer-trough JSON.
I also inspected the current CSS and the executable pixel producer rather than
accepting its summary table on trust.

The previously reported evidence blockers were rechecked after correction:

- transition width is now derived from rendered pixels independently at the left
  and right edges; the prior hard-coded `4` was removed;
- corner masks are now asserted for upper-corner rolloff, lower-corner occupancy,
  and two-stage shadow falloff; and
- the refreshed equal-scale board now places aligned vertical and horizontal
  slices beneath the positive source, rejected crop, and every `0/35/100`,
  loading, and volume candidate crop.

My proportionate executable rerun of the affected Aqua and mounted panel tests was
**24 passed, 0 failed, 199 expectations**.

The frozen engineer record additionally reports the full panel browser suite
**21/21**, production-device capture suite **2/2**, focused panel unit suite
**59/59**, `git diff --check` pass, and the final repo gates with **11/11**
typecheck projects, lint pass, **1340 tests / 0 failures / 78987 expectations**,
and **16/16 automated gates**. U14/U15 remain correctly identified as manual
owner/device checks rather than automated visual proof.

## Findings

### Critical

None.

### Major

None.

### Minor

None.

## Acceptance disposition

| Requirement | Result | Evidence and PM judgment |
| --- | --- | --- |
| Shared control height | **Pass** | Progress, loading, and volume are all `14px` outer / `12px` channel (`28/24px` at canonical `2x`) in the shared `y153..167` band. Progress/loading are `236px` wide and volume is `202px` wide as specified. |
| Cylindrical determinate fill | **Pass** | Progress and volume have identical sampled profiles: top-minus-waist `81.12`, bottom-minus-waist `63.55`, darkest row at `52.08%`, and maximum isolated discontinuity `9.42`. The fill is pale at both poles and blue at the waist, not a flat slab or hard bottom rule. |
| Cylindrical loading ribs | **Pass** | Blue and light ribs both curve through the same lighting: top-minus-waist `42.54/40.06`, bottom-minus-waist `41.33/37.84`, with the waist at `52.08%`. The board shows the lighting across both rib colours rather than flat diagonal paint. |
| Loading cadence and closure | **Pass** | The stationary molded object advances rib phase only: `45deg`, `50/50`, `22px` projected period, `11px` half-phase, and `3200ms` linear. Stable-interior t0/t3200 maximum channel delta is `0`; the rounded/specular edge no longer enters the channel. Reduced motion freezes the complete material at `11px`. |
| Four-part molded trough | **Pass** | Original-detail comparison shows distinct exterior cast shadow, bright/asymmetric outer lip, dark inset seam, and concave empty channel. CSS uses `border: 0` with separate background/shadow layers; no uniform `1px solid` surround remains. |
| Empty-channel material | **Pass** | Current raster range is `24.35` across four eight-point bins; maximum adjacent jump is `5.93`; lower-seam darkening is `13.07`; perimeter diversity is three values over `112.13`; horizontal drift is at most `1.00/40px`. The empty portion remains visibly graded in the `0%`, `35%`, and volume crops. |
| Horizontal edge transitions | **Pass** | Measured left/right transition widths are independently `4px` at `2x`, within the `4px` maximum. Left/right seam contrasts exceed `100` luminance points and the left highlight exceeds the right return by `58.42`; the surround cannot be mistaken for one repeated gray frame. |
| Endcaps and corners | **Pass** | The board and asserted masks show `4px` top / `2px` bottom outer radii and `3px` top / `1px` bottom channel radii at `2x`. The brighter upper corner rolls into a tighter darker lower return, while shadow pixels continue below the object. Neither end reads as a pill or square cutout. |
| No dark bottom border | **Pass** | The fill's lower quarter lightens again; the darker lower lip remains part of the trough and the softer cast occupies separate exterior rows. No opaque fill-coloured last row or attached black rule appears in the close-ups. |
| Honest dark/light cast | **Pass** | Geometry stays `0 1px 1px` plus `0 2px 2px`; resolved alphas are dark `26%/12%` and light `10%/5%`. Latest sampled peaks are `8.58` and `34.07`, both inside `8–35`, and fade through rows `28..31`. The light theme no longer receives the rejected ~`79`-point over-darkening. |
| Positive/negative source comparison | **Pass** | The refreshed board gives the complete Aqua raster authority, identifies the flat uniform frame as the anti-reference, preserves more than 40% empty channel in the mixed crop, uses equal height/zoom, and includes per-crop vertical/horizontal slices. |
| Screen hierarchy and restraint | **Pass** | In canonical dark/light screens, the thicker control is legible but remains subordinate to artwork and metadata. No glow, capsule, modern glass overlay, label, spinner, shelf, or secondary bar was introduced. |

## Rendered-product assessment

The strongest correction is the trough itself. The source's construction is now
legible in the candidate from outside inward: soft background shadow, luminous
upper lip, darker recess seam, shaped neutral channel, then blue gel. The
anti-reference collapses those roles into one gray rectangle; the candidate does
not. The asymmetric lower return gives depth without recreating the rejected dark
bottom rule.

The material survives both LCD palettes. On dark, the cast is quiet but measurable;
on light, it is visible without becoming a heavy outline. The fill and ribs share
one top/waist/bottom curvature, so switching between pending and determinate reads
as a state change within the same physical control rather than a component swap.

## Quality facets

Scores are `1–5` for the current rendered candidate and evidence packet.

| Facet | Score | Target | Disposition |
| --- | ---: | ---: | --- |
| Period authenticity | **5** | 5 | The result is directly traceable to the owner's classic Aqua raster rather than a modern flat interpretation. |
| Material depth | **5** | 4+ | Cylinder, lip, seam, concavity, return edge, and detached cast remain individually legible. |
| Trough articulation | **5** | 4+ | Empty and filled portions read as one molded object with asymmetric edges, not a border-wrapped bar. |
| Loading fidelity | **5** | 5 | Rib direction, duty, scale, cross-lighting, calm cadence, exact closure, and reduced-motion frame are coherent. |
| Screen cohesion | **5** | 5 | All three states share geometry/material and preserve the established Now Playing hierarchy. |
| Crafted restraint | **5** | 4+ | Depth comes from source-specific microstructure without glow, pills, copy, or decorative excess. |
| Evidence integrity | **5** | 4+ | Pixel-derived transitions, asserted corners, per-crop slices, exact loop closure, manifest, README, and correction diary now agree. |

## Owner approval

**Ready; pending owner action.** Present the refreshed molded-trough comparison
board first, then the canonical light/dark screens and one live `3.2s` loading
cycle. The owner still owns the subjective judgment of whether the gloss and
dimensional weight feel right on the physical phone; that pending approval is not
a PM rejection condition.
