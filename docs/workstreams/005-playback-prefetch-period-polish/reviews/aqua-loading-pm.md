# PM acceptance review — Aqua pending-playback remake

Date: 2026-09-04

## Verdict

**ACCEPT**

The corrected candidate meets the binding Aqua visual contract and is ready for
owner visual approval. It reads as a compact, recessed, saturated blue classic
Aqua indeterminate bar—not the rejected white/cyan capsule. The regenerated
production captures and green full-panel run close both Majors from the prior PM
pass, and the corrected right-falling diagonal now matches the primary raster.

This is PM acceptance, not owner approval. The owner's final visual decision
remains mandatory and cannot be replaced by tests or this review.

## Evidence reviewed

The regenerated equal-height comparison board was inspected first at original
detail. I then inspected every canonical dark/light t0, half-phase, and
reduced-motion capture; both required production CompositeDevice captures; and
the additional mobile/desktop list and pending-device captures. I also read the
regenerated computed-style JSON, pixel metrics, evidence manifest, reproducible
comparison-board HTML, designer diary, and decision log.

The primary raster and explicit anti-reference were reopened for direct visual
comparison. The primary source remained authoritative over generic design advice;
its layered Aqua material justifies the restrained gradients used here.

## Product judgment

- The active material is blue-first, not white/cyan-first.
- The one-pixel neutral perimeter, upper glint, and darker lower edge create a
  recessed five-pixel well without glow or capsule ends.
- At equal bar height, the remake's rib width, blue/light duty, and diagonal
  direction closely track the primary source. The anti-reference's broad pale
  wavelength is gone.
- Direction is independently confirmed: in the primary raster, a blue band moves
  right as the sampled row moves downward (the apparent `-22px` correlation shift
  is `+9px` modulo its `31px` repeat). The remake likewise moves right by `+4`
  device pixels over its sampled interior. Both therefore form the same
  right-falling `\` diagonal; the earlier mirrored `/` candidate is gone.
- In complete dark and light Now Playing screens, the bar remains subordinate to
  artwork and metadata while visibly communicating pending playback.
- Reduced-motion captures retain the same material at a deterministic phase.
- Mobile and desktop evidence now shows the complete production CompositeDevice,
  including the full LCD and physical iPod context, with no fixture labels or
  clipped edges.

The remake is necessarily crisper than the scaled documentation screenshot, but
it retains the source's geometry, blue material hierarchy, and visual rhythm. No
remaining difference crosses a rejection threshold.

## Acceptance-threshold disposition

| Contract requirement | Disposition | Evidence/reason |
| --- | --- | --- |
| Outer track `x18, y157, 236×5` | **Pass** | `aqua-loading-computed.json` records exact authored bounds; full-screen evidence preserves the composition. |
| Effective radius `0.5–1px`, hard maximum `1.25px` | **Pass** | Computed radius is `1px`; rendered ends are square-soft, not pill-shaped. |
| Continuous neutral/dark rim | **Pass** | Visible on all sides in equal-height, canonical, and device captures; computed border is `1px` on each side. |
| Active material contained inside rim | **Pass** | Computed active interior is `3px` high inside the rim; no external paint or glow is visible. |
| Upper glint, blue body, darker lower edge | **Pass** | Shallow Aqua depth remains legible without turning into a glass tube. |
| No added loading UI or displacement | **Pass** | No shelf, text, spinner, card, or altered Now Playing geometry appears. |
| Blue-dominant cobalt/cornflower identity | **Pass** | `#5278cc` ribs dominate; white/light blue is a gap/highlight rather than the base. |
| Centerline luminance swing `≥80` | **Pass** | Regenerated pixel evidence records `90.634` (`117.986–208.62`). |
| Peak `B-R ≥95` | **Pass** | Regenerated metric is `122`. |
| Neutral rim distinct from material | **Pass** | Gray perimeter remains visually separate in both colourways. |
| Reference-driven gradient depth; no glow/blur | **Pass** | Rendered material uses only the depth needed for the source-like gel and rim. |
| Dark/light identity and geometry parity | **Pass** | Canonical captures show the same material and bounds in both palettes. |
| Reference-matching right-falling diagonal | **Pass** | Regenerated board visually matches the primary `\` direction; computed gradient is `45deg`; independent row-phase comparison agrees. |
| Horizontal repeat `6.75–9px`, preferred `7.75px` | **Pass** | Authored repeat is `7.75px`; pixel autocorrelation resolves to `8` logical px. |
| Blue/light duty each `40–60%` | **Pass** | Recorded split is `52/48`, matching the visual balance of the source. |
| Crisp ribs without jagged noise | **Pass** | Ribs remain discrete and coherent in canonical and production-device captures. |
| Exact one-repeat displacement | **Pass by strong proxy** | Authored repeat and displacement are both `7.75px`; t0/half captures and computed values agree, making the loop phase-identical. |
| Duration `2.8–3.6s`, preferred `3.2s` | **Pass** | Computed duration is `3.2s`, linear, infinite. |
| Quiet drift; no pulse/reverse/sweep | **Pass by proxy** | Motion is a single linear one-repeat transform. Still evidence cannot show perceived cadence, so the owner should observe one live loop. |
| Reduced motion remains visible and computes to `none` | **Pass** | Dark/light reduced captures retain the stripe; JSON records `animationName: none` and half-phase transform. |
| Pending-only semantics and accessible label | **Pass** | Focused Aqua browser case passes state, ARIA, geometry, and material assertions. |
| Pending → determinate preserves the same track/layout | **Pass / preserved** | Playback/presentation logic and Now Playing geometry were not changed. |
| Complete canonical screenshot matrix | **Pass** | All six dark/light/phase/reduced captures are present and reviewable. |
| Complete production-device screenshot matrix | **Pass** | `aqua-loading-device-mobile.png` and `aqua-loading-device-desktop.png` now show the fully framed production iPod at `390×844` and `1440×900`. |
| Full panel Playwright gate | **Pass** | Final post-direction-correction run: **18/18 passed in 24.8s**, fingerprint recorded in the manifest. |
| Production-device browser proof | **Pass** | **2/2 passed in 6.8s** through the real `/_spike/device` Panel + CompositeDevice route. |
| Typecheck, lint, build, repo gates, diff check | **Pass as recorded** | 11/11 typecheck; lint/build pass; 16/16 automated gates; 1329 tests; clean diff check. |

## Explicit rejection-condition audit

| Rejection condition | Result |
| --- | --- |
| Reads as white/cyan, fluorescent, glowing, glass-tube, or capsule | **Absent** |
| Radius exceeds `1.25px` | **Absent** (`1px`) |
| Rim disappears or material paints outside it | **Absent** |
| Repeat or duty falls outside contract | **Absent** (`7.75px`, `52/48`) |
| Luminance or blue-channel separation falls below threshold | **Absent** (`90.634`, `122`) |
| Loop is too fast, mismatched, pulsing, reversing, or sweeping | **Absent by computed evidence** (`3.2s`, linear, exact repeat) |
| Reduced motion hides or flattens the loading state | **Absent** |
| Pending state adds text or alters non-progress geometry | **Absent** |
| Tests check only that a gradient exists | **Absent**; material, proportions, geometry, direction, motion, semantics, and reduced motion are asserted. |
| Equal-height comparison does not resemble primary Aqua source | **Absent**; the remake is an immediate period-Aqua match at the required scale. |

## Findings

**0 Critical · 0 Major · 0 Minor**

Prior M1 is closed: both device captures are complete, unclipped production
CompositeDevice views. Prior M2 is closed: the full panel suite now passes 18/18.
The independently identified mirrored-diagonal Major is also closed: all current
rendered and computed artifacts use the reference-matching `45deg` `\` direction.

## Quality facets

Scores are `1–5` and apply to the corrected rendered product.

| Facet | Rejected render | Corrected remake | Target | Disposition |
| --- | ---: | ---: | ---: | --- |
| Period authenticity | 1 | **5** | 5 | Meets; immediately belongs to the classic Aqua family. |
| Material depth | 2 | **4** | 4+ | Meets; recessed rim and shallow gel survive the five-pixel constraint. |
| Stripe proportion | 1 | **5** | 5 | Meets; repeat, duty, and corrected direction match the reference. |
| Calm motion | 2 provisional | **4 provisional** | 4+ | Meets by computed proxy; owner should watch one live loop. |
| Screen cohesion | 2 | **5** | 5 | Meets in canonical and complete production-device contexts. |
| Crafted restraint | 2 | **5** | 4+ | Exceeds; every treatment is confined to the existing track. |

## Owner-approval readiness

**Ready for owner visual approval.** Present the equal-height comparison board
first, then the complete mobile and desktop production-device captures, and
finally one live `3.2s` loop so the owner can judge cadence. The owner may still
reject or retune the material; this PM acceptance does not waive that decision.
