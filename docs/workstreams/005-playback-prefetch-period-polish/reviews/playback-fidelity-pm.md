# PM acceptance review — playback fidelity pass

Date: 2026-09-04

## Verdict

**ACCEPT**

The corrected candidate satisfies the measurable playback-fidelity contract with
**zero unresolved Critical, Major, or Minor findings**. The two Majors from the
prior PM review are closed: the volume matrix now contains exact settled
`0/50/100` fills and the wheel evidence now exercises mounted oblique
mouse/touch/pen input plus the exact `r=37` seam through named executable cases.

The result is ready for the owner's separate visual and phone-in-hand approval.
That owner gate remains pending and is not treated as a product defect or as a
reason to reject this PM acceptance.

## Evidence and verification

I re-read the current scope, dispatch, corrected PM memo, decisions, implementation
diary, evidence manifest, computed JSON, relevant implementation/tests, and the
independent review. I inspected the regenerated equal-height comparison board at
original detail first, then all canonical loading/progress/volume states and all
six `390x844`/`1440x900` production-device captures.

Independent pixel sampling of each `544x408` canonical volume capture found the
following blue widths across the `400px` rendered interior:

| Artifact | Expected | Measured |
| --- | ---: | ---: |
| `volume-dark-0.png` | 0px | **0px** |
| `volume-dark-50.png` | 200px | **200px** |
| `volume-dark-100.png` | 400px | **400px** |
| `volume-light-0.png` | 0px | **0px** |
| `volume-light-50.png` | 200px | **200px** |
| `volume-light-100.png` | 400px | **400px** |

The six corrected captures were written at `22:42:48–22:42:53`; the comparison
board was regenerated afterward at `22:47:27`. `volume-geometry.json` and the
bar manifest independently report authored endpoints `36/136/236` and computed
volume fill transition duration `0s`.

My proportionate executable rerun produced:

- State, panel Aqua/integration, device unit/integration, and composite integration:
  **103 passed, 0 failed, 546 expectations**. The device suite's planted callback
  errors printed expected recovery diagnostics while those tests passed.
- State, device, composite, and panel package typechecks: **passed**.
- `git diff --check`: **passed**.

The diary additionally records successful focused fidelity Playwright (`4/4`),
production-device Playwright (`4/4` on the independent private-temp run), lint,
build, and `bun run gates` with **16/16 automated gates**, **1340 tests**, and
**0 failures**.

## Findings

### Critical

None.

### Major

None.

### Minor

None.

## Closure of the previous PM findings

### M1 — corrected and closed

`.wp-volume-progress i` now has `transition: none`, while the ordinary playback
fill retains its separate `120ms` transition. The rendered `0/50/100` files show
empty, exact-half, and full interiors in both colourways, the JSON records the
actual widths/endpoints, and `reference-board.png` visibly uses the corrected 50%
capture. No transition-in-flight artifact remains.

### M2 — corrected and closed

`quadrant-boundary-no-double-action-trace.json` now names and summarizes the
executable mounted cases. The current device integration suite drives projected
coordinates through the real three-quarter orientation for mouse, touch, and pen,
covers all four sector centers and eight diagonal/radial extremes, and proves an
oblique movement takeover with no cardinal action. A separate mounted case proves
Select-only ownership at `r=36.999` and exactly `r=37`, and Next-only ownership
at `r=37.001`.

## Acceptance-threshold disposition

| Requirement | Result | PM disposition |
| --- | --- | --- |
| Shared taller playback/loading bar | **Pass** | Both states render `x18, y155, 236x9`, with a `1px` rim, `234x7` interior, `0.7778` ratio, and squared-soft `1px` radius. |
| Calm faithful Aqua loading ribs | **Pass** | The rendered material matches the primary Aqua source's right-falling `45deg` ribs, blue-first `52/48` duty, `14px` projected repeat, and exact-repeat `3.2s` linear drift. It is contained by the neutral rim and avoids glow/capsule treatment. |
| Reduced-motion loading | **Pass** | Computed animation is `none`; the full striped material remains visible at the representative half phase. |
| Determinate gel treatment | **Pass** | Dark/light `0/35/100` frames show the neutral recessed well, one-pixel upper glint, saturated continuous body, darker lower edge, crisp endpoint, and visible perimeter at full. |
| Volume geometry and material | **Pass** | The replacement row spans `x18..254`; its trough is `202x14` with `200x12` interior, `0.8571` ratio, restrained Aqua depth, and `13px` decorative speaker endpoints. |
| Exact volume values/direct swap | **Pass** | Both themes visibly and computationally resolve to exact `0/50/100`; the volume fill has `0s` transition and no entrance/exit decoration. |
| Human-only visibility and dwell | **Pass** | Evidence records `32ms` input-to-visible, renewal on accepted value changes, visibility through `1499ms`, dismissal at `1500ms`, and no renewal for a clamped no-op. Agent/programmatic changes do not summon or extend it. |
| Rejection, priority, and dismissal semantics | **Pass** | Provider rejection reconciles the shown value without premature hiding. Pending/failure outrank volume; Menu/root, nonstandard modes, track loss, and track occurrence changes dismiss it. |
| Occurrence-aware synchronous dismissal | **Pass** | The occurrence key includes provider, catalogue identity, local key, and queue index. Render eligibility compares that identity synchronously, so a ready-to-ready change cannot paint stale feedback before the cleanup effect. The mounted regression covers both a different track and a duplicate same-track occurrence with no pending/null intermediary. |
| Stable upper layout | **Pass** | Titlebar `(0,0,272,21)`, artwork `(18,58,86,86)`, and metadata `(116,58,138,75)` remain fixed across progress, loading, and volume. No queue-count row or competing status shelf returned. |
| Full 90-degree quadrants | **Pass** | Every point in `37 < r <= 103` maps to one sector. Exact `45/135/225/315` boundaries belong to Bottom/Left/Top/Right; there are no label disks or diagonal dead zones. |
| Center and radial seams | **Pass** | Center owns `r <= 37`, the annulus begins strictly above it, `r=103` remains active, and points above the outer radius are inactive. Mounted seam proof confirms single ownership at `36.999/37/37.001`. |
| Tap/rotation arbitration | **Pass** | A same-sector `10px` release emits one cardinal action; `10.01px`, sector crossing, drag-off, cancel, blur, or lost capture cancels the candidate and allows rotation without double action. |
| Pointer/camera coverage | **Pass** | Mounted front and three-quarter paths cover mouse, touch, and pen, including interiors, diagonal edges, radial extremes, and movement takeover. |
| Accessibility and semantics | **Pass** | Volume exposes exactly one named progressbar with min/max/value; speakers remain decorative. Loading keeps an honest indeterminate progressbar, keyboard parity/focus behavior remains covered, and no duplicate action/control is introduced. |
| Scrub-reset regression | **Pass** | A pending scrub intent now outranks passive provider-clock reconciliation until consumed. The mounted center-mode test observes the wheel value advance immediately, preserves `previewing`, and commits that exact value; it passed in the focused rerun and the recorded browser runs. |
| Playback/loading regression safety | **Pass** | The focused panel suite retains selected-track, pending-until-clock-advance, rapid-selection, stale/rejected attempt, and queue-occurrence behaviors; loading priority remains intact. |
| Required visual evidence | **Pass** | Canonical dark/light/reduced matrices, full-device mobile/desktop captures, current JSON, and the equal-height source/candidate board are complete and mutually consistent. |

## Rendered-product assessment

The `9px` controls have the visual weight visible in the photographs while staying
subordinate to artwork and metadata. The indeterminate bar reads as a restrained
classic Aqua control: narrow squared trough, neutral bevel, alternating cobalt and
light ribs, and no modern glow. Determinate playback and the thicker volume row use
the same shallow gel language without becoming pill-shaped. Exact endpoint states
are now visually trustworthy. The complete mobile and desktop captures frame the
physical device cleanly and preserve hierarchy at both scales.

## Quality facets

Scores are `1–5` for the current rendered candidate and its acceptance packet.

| Facet | Score | Target | Disposition |
| --- | ---: | ---: | --- |
| Period authenticity | **5** | 5 | Loading, playback, and volume read as one source-led Aqua family. |
| Material depth | **4** | 4+ | Rim, glint, body, lower edge, and recessed well survive both canonical and device scale. |
| Screen cohesion | **5** | 5 | Every lower-band state belongs to the fixed iPod composition without displacing the upper layout. |
| Crafted restraint | **5** | 4+ | No glow, pill, copy slab, second bar, or decorative motion competes with playback. |
| Input confidence | **5** | 5 | Full sectors, exact seams, three pointer types, oblique projection, and rotation takeover are executable. |
| Evidence integrity | **5** | 4+ | Rendered pixels, computed geometry, trace claims, executable case names, and timestamps agree. |

## Full-panel browser host-budget disposition

The latest full panel Playwright run is transparently **18 passed, 2 failed** under
severe host contention: a 48-screenshot all-state case exceeded its existing 30s
stabilization budget, and the deliberately CPU-throttled frame benchmark measured
about `78–85ms` against `<20ms`. The implementer and independent reviewer reproduced
only this pair while unrelated processes saturated the host. All affected fidelity,
accessibility, playback, and production-device cases passed in focused runs, and no
failed assertion targets behavior changed by this pass.

This is recorded as a quiet-host verification follow-up, not hidden or represented
as an all-green full-browser run. Under the requested acceptance policy it is not a
Critical/Major functional finding and does not overturn the product verdict.

## Owner approval

**Ready; pending owner action.** The owner still needs to observe one live `3.2s`
loading cycle, the `1500ms` volume replacement, and phone-in-hand quadrant feel,
including U14 thumb occlusion and U15 unsupported-control inspection. PM acceptance
does not waive that subjective and physical gate.
