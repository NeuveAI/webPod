# Playback bars and click-wheel quadrants — PM acceptance memo

Status: **Ready for material-correction implementation; owner visual approval required**
Date: 2026-09-04

This memo scopes the next Now Playing fidelity pass. The owner's latest direction
explicitly supersedes three assumptions in earlier versions of this memo and any
older implementation/tests that encode them:

1. Determinate playback, indeterminate loading, and volume use one shared height;
   neither the historical `236x5` bar nor the accepted `9px`/`14px` split remains
   a target.
2. The current hard-banded fill is flat and squared. Authentic Aqua requires a
   cylindrical top/waist/bottom luminance profile, structured gel texture, and
   depth/shadow rather than a dark bottom border.
3. Cardinal click targets are whole 90-degree wheel sectors, not small circles
   around the printed labels.

The prior Aqua and playback-fidelity reviews are historical verdicts on superseded
candidates and must not be edited. This correction reopens the geometry and
material of all three bars, including loading stripe scale. It does not reopen
D005-01's removal of the queue-count row, volume timing/state semantics, click-wheel
behavior, provider sequencing, or the center-button view set.

## Owner material correction — binding supersession

The new primary Aqua raster is
`/var/folders/ft/7tsjkpcn20q5fx1q8dwv26x80000gn/T/codex-clipboard-52c992e9-f312-4746-b1d3-0582139c6471.png`.
At native size its striped and determinate controls have matching approximately
`52px` outer cross-sections. Both expose a recessed gray well and a materially
shaded interior. The determinate fill is pale at the top, reaches its darkest
blue waist near the vertical midpoint, and becomes pale again toward the bottom.
The loading ribs inherit the same cylindrical lighting instead of remaining two
flat diagonal colors.

The owner's newest rejected result is
`/var/folders/ft/7tsjkpcn20q5fx1q8dwv26x80000gn/T/codex-clipboard-db206314-ddef-4c7a-ba64-dd4b546a1e69.png`.
It improves fill curvature but surrounds the channel with a broad, visually
uniform gray frame. That frame is not an Aqua trough. In the primary reference,
the neutral pixels resolve into a molded assembly: separate exterior cast shadow,
outer highlight/lip, inner dark recess seam, and a graded empty channel. Each layer
has a different job and edge luminance.

The earlier candidate recorded in the prior comparison board remains an explicit
anti-reference in four ways:

- progress/loading are `9px` high while volume is `14px`;
- determinate/volume use one light pixel, one flat cyan body, and one hard dark
  bottom pixel rather than a continuous cylindrical profile;
- loading uses flat cobalt/light ribs with only single-pixel inset edges; and
- the progress fill's opaque navy last row reads as a bottom border, not optical
  depth or a soft cast/inset shadow.

All conflicting `9px` progress/loading, `7px` interior, `14px`-only volume,
three-stop hard-band, `14px` loading-repeat, **uniform `1px` rim**, and
`border: 1px solid` surround requirements below or in earlier evidence are void
for the next candidate. Geometry, material, and proof must follow this corrected
contract.

## Authority and evidence labels

1. The owner's latest direction in workstream 005.
2. The newly attached primary Aqua control raster named above.
3. The physical-device photographs in `/Users/vinicius/code/tmp/ipod-reference/`,
   especially `IMG_2280.HEIC` (TOOL, determinate progress) and `IMG_2281.HEIC`
   (TOOL, volume overlay).
4. Existing workstream-005 decisions and the non-conflicting direction, cadence,
   and reduced-motion clauses in `aqua-loading-criteria.md`.
5. Current implementation only as a baseline and anti-reference, never as visual
   authority.

Requirements below are labelled **Photo fact** when visible in the supplied stills
and **Implementation default** when the stills cannot establish the value. The
photos contain perspective, LCD subpixel structure, moire, and warm ambient colour;
sampled pixels are not literal CSS colour tokens. Subtle gradients are required to
reproduce the period material and override generic no-gradient advice.

There is no blocking ambiguity. The exact volume-overlay dwell is not recoverable
from a still photograph, so the measurable default below is intentionally tunable
after owner observation.

## Corrected remeasurement disposition

- **Raster fact:** the newly supplied Aqua specimen shows determinate and
  indeterminate controls at the same approximately `52px` outer height, with an
  approximately `47px` visibly shaded interior after the source's scaled rim.
- **Measured photo range:** local vertical cross-sections through the TOOL
  determinate well in `IMG_2280` normalize to approximately `8-10` authored pixels.
  Measuring a local cross-section is essential: the photographed bar slopes across
  the frame, so its global bounding-box height materially overstates thickness.
- **Photo fact:** the TOOL volume and progress wells are perspective-distorted and
  camera-textured, so the stills do not establish a reliable height difference.
  The owner's explicit equal-height instruction resolves that ambiguity.
- **Binding implementation target:** all three controls use a shared `14px` outer
  height and `12px` interior. The value is anchored by the already legible volume
  cross-section and the owner's rejection of the thinner candidate; it is an
  authored target, not a claim that photo pixels map one-to-one to CSS pixels.

## Bar contract

All authored geometry uses the `272x204` LCD coordinate system.

| State | Photographed facts | Implementation acceptance target |
| --- | --- | --- |
| Determinate playback | `IMG_2280` shows a recessed gray well, a continuous cyan/blue fill with a crisp vertical endpoint, and elapsed/remaining time below. The new Aqua raster shows the fill's cylindrical cross-section. The fill is not striped and has no knob. | Outer bounds `x18, y153, 236x14`; nominal channel bounds `x19, y154, 234x12`; inner/outer ratio **0.8571**. The one-pixel nominal inset is a layered lip/seam transition, not a solid border. Outer radii `2px 2px 1px 1px`; channel radii `1.5px 1.5px .5px .5px`; never a pill. |
| Indeterminate loading | The Aqua raster shows diagonal blue/light ribs in a trough exactly the same height as determinate, with the cylindrical highlight/shade profile continuing through both rib colors. | Use the exact same outer and inner bounds as determinate. Keep `45deg` right-falling `\` ribs. At the new height use a `22px` projected repeat, `15.56px` gradient-space repeat, `7.78px` blue stop, and `50/50` duty. Translate exactly `22px` over the unchanged calm `3.2s` linear loop. Reduced motion freezes the full shaded material at `11px` half phase. |
| Volume | `IMG_2281` replaces the complete progress/time treatment with a determinate well between quiet/loud speaker icons; metadata and artwork do not move. The owner requires its well to be the same height as progress/loading. | Left icon `x18..31`, `4px` gap, trough `x35, y153, 202x14`, `4px` gap, right icon `x241..254`; nominal channel `x36, y154, 200x12`. Use the identical molded lip, recess seam, empty-channel, corner, shadow, and cylindrical fill construction as progress/loading. |

### Material cross-sections

- **Observable raster fact — molded trough:** the neutral surround is not one
  border. From outside inward it resolves into (1) a cast shadow separated from
  the object, (2) a light-catching outer lip strongest on top/left, (3) a darker
  inner seam that makes the channel recede, and (4) the empty-channel gradient.
  The lower/right lip is darker than the upper/left lip, and the top corners read
  rounder/brighter than the tighter lower corners. A uniform frame destroys this
  molded hierarchy even when its average gray is numerically close.
- **Binding molded-trough layers:** keep the `14px` outer box and `12px` nominal
  channel, but construct the surround from independently inspectable layers:
  `--wp-aqua-lip-top: #f3f6f8`, `--wp-aqua-lip-side: #b9c1c8`,
  `--wp-aqua-lip-bottom: #7c8791`, and
  `--wp-aqua-recess-seam: #596570`. The lip is a one-pixel-equivalent molded
  gradient around the contour; the seam is an inset shadow/ring immediately
  inside it. `border: 1px solid` may not be the sole surround and no single RGB
  value may occupy all four edges.
- **Binding empty channel:** use a continuous concave neutral material with stops
  `--wp-aqua-channel-top: #b7bec5` at `0%`,
  `--wp-aqua-channel-upper: #d0d6db` at `18%`,
  `--wp-aqua-channel-mid: #e0e4e7` at `58%`,
  `--wp-aqua-channel-lower: #e7eaec` at `84%`, and
  `--wp-aqua-channel-bottom: #cbd1d6` at `100%`. It must remain visibly graded
  through the unfilled portion; a flat white/gray channel is a rejection.
- **Binding shadow geometry and colourway tokens (PM correction):** preserve one
  physical two-stage cast-shadow shape in every colourway—near stage
  `0 1px 1px` and far stage `0 2px 2px`, both neutral black—but do **not** reuse
  one alpha pair over differently luminous LCDs. Use semantic context tokens:
  `--wp-aqua-shadow-near: rgb(0 0 0 / 26%)` and
  `--wp-aqua-shadow-far: rgb(0 0 0 / 12%)` on the dark LCD; override only those
  two tokens to `rgb(0 0 0 / 10%)` and `rgb(0 0 0 / 5%)`, respectively, on the
  light LCD. The resolved LCD colourway, not the OS preference in isolation,
  selects the pair. This correction supersedes the earlier shared `26%/12%`
  wording: that pair measured about `8` luminance points of peak darkening on the
  dark LCD but about `79` on the light LCD, so it could not satisfy the binding
  `8-35` range in both contexts.
  Neither shadow may consume channel height or be painted as an opaque last row.
  Lip, seam, channel, fill, radii, offsets, and blur remain invariant; only the
  exterior cast-shadow opacity adapts to its backdrop. The lower recess may use
  `inset 0 -1px 1px rgb(43 54 65 / 24%)`; it must be perceptually attached to the
  trough, not to the blue fill.
- **Observable raster fact — cylindrical fill:** the filled Aqua cross-section is
  pale/highlighted at the top, darkens continuously to a blue waist around the
  midpoint, then lightens again toward the bottom. In the supplied raster's
  interior, representative medians progress approximately from `#d8e7fc` at the
  top through `#79aef3` at the waist to `#b8dbfb` at the bottom. Those sampled
  values establish relationships, not literal device-independent color.
- **Binding fill tokens and stops:** begin with
  `--wp-aqua-fill-top: #d8e9fc`,
  `--wp-aqua-fill-upper: #b2d3fa`,
  `--wp-aqua-fill-waist: #69aaee`,
  `--wp-aqua-fill-lower: #91c4f7`, and
  `--wp-aqua-fill-bottom: #c1e1fb` in one continuous vertical material at
  `0/22/52/78/100%`. Add a restrained one-pixel-equivalent upper specular overlay
  (`rgb(255 255 255 / 32%)`) and a diffuse lower inset shadow
  (`rgb(37 75 120 / 16%)`, blur `1px`); do not encode either as a hard color band.
  Top and bottom must each be visibly lighter than the waist in captured pixels.
  These fill tokens and their stop positions are shared unchanged by dark and
  light colourways; the surrounding LCD palette may change, not the Aqua object.
- **Binding loading texture:** compose the `45deg` blue/light ribs underneath the
  exact same vertical cylinder lighting used by determinate and volume. Starting
  rib colors are `#6eaaf0` and `#f4f8ff`; the cylinder overlay must modulate both
  colors, so neither rib remains flat from top to bottom. Texture means these
  coherent ribs plus cross-sectional gloss—not grain, noise, blur, bloom, or a
  modern translucent overlay.
- **Binding loop-closure clarification:** seamless rendered phase closure outranks
  any inferred preference for a transform-only implementation. Keep the pseudo,
  trough, clipping mask, endcaps, seam, and cylindrical/specular lighting
  stationary; animating only the repeating rib layer's `background-position` by
  one exact `22px` projected period over `3200ms` linear is accepted when it makes
  the stable interior pixel-identical at t0/t3200. A translating pseudo whose
  rounded or specular edge enters the stable channel at loop closure fails even if
  its transform delta is numerically `22px`. Reduced motion must remove the
  animation and retain the same representative `11px` half-phase. This is a
  rendered-behavior contract, not permission to alter cadence, rib geometry,
  direction, lighting, or clipping.
- No fill may glow or paint outside its molded channel. No capsule ends, blur,
  bloom, knob,
  texture noise, modern glass, label, percentage text, or second bar.
- Determinate width is `clamp(value, min, max)` normalized to `0-100%`; `0%` shows
  the empty recessed well and `100%` reaches the inner right edge without covering
  the perimeter. Intermediate endpoints remain crisp and vertical; only the well's
  outer clipping shapes the left/full-width corners.

### Measurable material acceptance

At the canonical `2x` capture scale every progress, loading, and volume trough must
measure `28px` outer height with a `24px` nominal channel and a `2px` geometric
inset on each side. That inset describes bounds only; it must not render as a
uniform two-device-pixel border.

For a vertical sample through an **unfilled** portion of the trough:

- the nominal channel must occupy `24/28 = 85.71%` of outer height, within
  `84-87%` after rasterization; lip-plus-seam structure above and below may each
  occupy no more than `4` device pixels, and the lower structure may not be more
  than `2` pixels thicker than the upper structure;
- rows immediately below the object (`y=28..31` relative to its top) must show a
  separate soft cast shadow in **each** colourway: peak background darkening
  `8-35` luminance points at `y=28..29`, fading toward the untouched background by
  `y=31`; it may not replace the object's bottom rows. Computed style must resolve
  to the dark `26%/12%` or light `10%/5%` token pair above with the same
  `1px/1px` and `2px/2px` offsets/blur. A shared alpha pair, a single-stage shadow,
  or a light-LCD peak above `35` fails even if the bar itself is unchanged;
- the two-device-pixel top lip must be at least `28` luminance points lighter than
  the recessed seam immediately below it;
- the recessed top seam must be at least `18` points darker than the mean of the
  next four channel rows;
- the empty channel must span at least `18` luminance points from its darkest to
  lightest interior row and contain at least four distinct eight-point luminance
  bins; a nearly white or single-gray slab fails;
- adjacent empty-channel rows may not jump by more than `16` points except at the
  explicitly identified seam, proving the channel is graded rather than banded;
- the lower seam may darken by `10-38` points relative to the row above, but the
  bottom lip and exterior shadow must remain separately measurable; and
- top-center, left-center, right-center, and bottom-center edge samples must contain
  at least three distinct luminance values with a range of at least `24`. One
  repeated gray around the perimeter is an automatic rejection.

For a horizontal sample through the vertical center of an **unfilled** portion:

- background → lip → dark seam → channel must complete within `4` device pixels
  (`2` authored pixels) at each end; a broad frame is rejected;
- the inner seam on each side must be at least `14` luminance points darker than
  the adjacent channel sample;
- the outer left highlight must be at least `8` points lighter than the right/lower
  return edge; and
- after excluding the two end transitions, the empty channel may vary vertically
  but may not drift more than `6` luminance points horizontally across any
  `40-device-pixel` run.

At `2x`, corner masks must prove the specified asymmetric shape: `4px` top-corner
radii and `2px` bottom-corner radii on the outer contour, with `3px` top and `1px`
bottom radii on the channel. Top corner highlights must not continue unchanged
around the lower corners; lower corners roll into the darker return edge and cast
shadow.

For a filled vertical sample away from an endpoint:

- the top-quarter median luminance must exceed the waist median by at least `18`;
- the bottom-quarter median luminance must exceed the waist median by at least `10`;
- the darkest median row must fall between `40%` and `62%` of interior height;
- no single bottom row may be more than `24` luminance points darker than both of
  its immediate neighbors; such a discontinuity is the rejected dark border;
- a `1px` authored shadow may appear below the outer trough, but it must be
  semi-transparent/soft and visually separate from the fill; and
- determinate and volume samples at the same value must have the same normalized
  vertical color profile within `8` RGB units per channel, excluding width and
  background-compositing differences.

For loading, sample one blue rib and one light rib at top/waist/bottom. Both must
show the same top-to-waist darkening and waist-to-bottom lightening. The t0 and
half-phase images must differ by exactly `11px` horizontally at authored scale,
and the `3200ms` frame must be pixel-identical to t0 inside the stable interior
after excluding the two endpoint antialiasing columns.

## Volume-overlay behavior

### What the photograph establishes

`IMG_2281` establishes a replacement state, not an additional control: title bar,
artwork, title, artist, and album stay fixed; the standard progress bar and both
time labels disappear; the icon-plus-volume row occupies their bottom band.
The photograph does not establish duration, entrance animation, or exit animation.

### Inferred default

- Show the volume overlay in the same rendered frame as the first accepted
  human-origin volume change; browser evidence must measure input-to-visible at
  **<=50ms**.
- Keep it visible while accepted detents/steps continue and restart the dwell after
  every value-changing input. Hide it **1500ms** after the last accepted change;
  **1250-1750ms** is the acceptable owner-tuning range.
- Use a direct state swap with no slide, scale, or decorative fade. Reduced motion
  therefore changes no overlay timing and introduces no transition.
- Apply the same feedback for physical click-wheel rotation and its keyboard/mouse
  accessibility equivalents when the actor is human. Provider- or agent-originated
  volume synchronization must not summon the overlay.
- At `0` or `100`, further input that cannot change the value does not reset the
  timer. A provider rejection immediately restores the authoritative volume value
  in the still-visible overlay; the existing dwell then completes.
- Leaving standard Now Playing, selecting another track, pressing Menu, entering a
  center-button secondary view, or losing the track dismisses the overlay
  immediately.
- Pending/starting and terminal-failure presentation outrank the overlay. Pending
  keeps the accepted Aqua loading bar visible; failure keeps the compact failure
  treatment. Do not hide an honest playback state behind volume feedback.
- While visible, expose one `role="progressbar"` named `Volume`, with min `0`, max
  `100`, and the shown authoritative/optimistic value. Speaker glyphs are
  decorative. Do not add visible accessibility copy to the LCD.

## Playback-view layout disposition

- **Photo fact:** `IMG_2280` and `IMG_2281` keep the artwork/metadata cluster at the
  same coordinates through progress-to-volume replacement. The bottom control is
  a separate band and does not squeeze or vertically recenter metadata.
- **Implementation target:** preserve the current accepted anchors: `21px`
  titlebar; body inset `18px`; `86x86px` artwork; metadata beginning at `x116`;
  time labels spanning `x18..254` below the control. All three troughs share
  `y153..167` and `14px` outer height; progress/loading remain `236px` wide while
  volume remains `202px` wide between its speakers. Keep the time baseline and all
  upper-content anchors fixed.
- **Photo fact, overridden:** the photographs show an `x of y` row. D005-01 remains
  authoritative, so no queue-count row returns and the accepted no-count vertical
  composition remains intact.
- **Photo fact, out of this slice:** `IMG_2274` and `IMG_2275` show full-artwork and
  rating center-button views. This memo neither removes nor reorders existing
  center-button modes; a still image does not establish their complete cycle.
- Standard playback has no scrub marker. Preserve the marker only in the explicit
  scrub secondary view visible in `IMG_2273`.

## Click-wheel clickable regions

The owner's whole-quadrant direction is authoritative. The current radius-`26`
label disks and diagonal rotation gaps are explicit anti-requirements. All
coordinates are wheel-local model pixels around `(0,0)`, with clockwise angle
`theta=0deg` on the right.

| Region | Required semantic | Required pointer hit region |
| --- | --- | --- |
| Top | Menu/back; accepted hold `>=600ms` retains return-to-root | Whole annular sector `225 <= theta < 315deg` |
| Right | Next / fast-forward transport | Whole annular sector `315 <= theta < 360deg` plus `0 <= theta < 45deg` |
| Bottom | Play/Pause transport | Whole annular sector `45 <= theta < 135deg` |
| Left | Previous / rewind transport | Whole annular sector `135 <= theta < 225deg` |
| Center | Select / advance center-button playback view | Entire visible center disk, `r <= 37` |

Each cardinal sector occupies the full annulus `37 < r <= 103`; the center owns the
shared `r=37` boundary and points outside `r=103` are inactive. Half-open angular
intervals make every diagonal deterministic: exactly `45deg` belongs to Bottom,
`135deg` to Left, `225deg` to Top, and `315deg` to Right. There are no unmapped
diagonal wedges. Glyph outlines, camera angle, colourway, and CSS scale must not
narrow a sector. Mouse, touch, and pen resolve through the same transformed
model-space regions.

- A stationary/short tap anywhere in a sector that releases in the same sector with
  no more than `10` model pixels of travel emits exactly one button press on
  release, including taps adjacent to a diagonal boundary.
- Movement beyond `10px`, crossing into another sector, drag-off, cancel, blur, or
  lost capture cancels the cardinal candidate. Continued annular movement is then
  treated as wheel rotation. The gesture must never emit both a cardinal action and
  a volume detent.
- A stationary tap on either side of a diagonal boundary maps to the owning sector
  above. There are no diagonal rotation-only gaps; rotation is distinguished by
  movement, not by reserving spatial holes between cardinal targets.
- Keyboard parity remains: `Escape`/`Backspace` = Menu, `PageUp` = Previous,
  `PageDown` = Next, Space = Play/Pause, and `Enter` = Center. Modified shortcuts
  using Alt/Ctrl/Meta are ignored.
- On standard Now Playing: wheel rotation adjusts volume; Menu navigates back;
  Center advances the playback view; Previous/Next call provider transport; and
  Play/Pause toggles provider transport. A cardinal click must never be mistaken
  for a volume detent.

## Required observable proof

### Rendered evidence

1. Canonical `272x204` dark and light screenshots of the new `14px` determinate
   playback at `0%`, approximately `35%`, and `100%`; include the complete LCD.
2. Canonical dark and light volume screenshots at `0`, `50`, and `100`. At the same
   capture scale, overlay horizontal guide lines proving its outer and inner y
   coordinates match progress/loading exactly. Also include a board comparing the
   new Aqua raster, `IMG_2280`, `IMG_2281`, determinate, loading, and volume at
   equal bar height and equal LCD height where applicable.
3. Production CompositeDevice screenshots at `390x844` and `1440x900` for standard
   progress and the active volume overlay. Both must show the full physical device.
4. Regenerate the complete pending/loading matrix because its geometry and stripe
   scale necessarily change. Include normal t0/half-loop and reduced-motion dark and
   light captures, plus both production device sizes and an equal-height comparison
   to the supplied Aqua source. Evidence must show `14px` outer, `12px` interior,
   `22px` projected repeat, `50/50` duty, full cylindrical modulation of both rib
   colors, and the unchanged `3.2s` calm loop.
5. A pixel/geometry manifest recording outer and nominal-channel bounds,
   inner/outer ratios, lip/seam/shadow extents, asymmetric outer/channel radii,
   fill endpoint at the three values, and unchanged artwork, metadata, and
   titlebar boxes. A single `rimWidth` field is insufficient.
6. A cross-section artifact for determinate, loading-blue, loading-light, volume,
   and empty well. Record row-by-row RGB/luminance at canonical `2x`, darkest-row
   position, top/waist/bottom deltas, and the bottom-discontinuity check. The
   artifact must be generated from the screenshots, not restate CSS tokens. For
   both LCD colourways it must also record the untouched local background and the
   `y=28..31` exterior rows, report background-minus-row luminance, and identify
   the near and far shadow stages separately.

### Visual acceptance matrix

| Surface | Required states | Required review |
| --- | --- | --- |
| Canonical dark LCD | progress `0/35/100`; loading `t0/1600/3200/reduced`; volume `0/50/100` | Shared `28px` outer/`24px` nominal-channel raster height, molded lip/seam/channel/shadow layers, cylindrical fill profiles, exact endpoints, rib phase continuity, no opaque bottom line or uniform frame; computed exterior-shadow tokens resolve to `26%/12%` and the sampled peak is `8-35`. |
| Canonical light LCD | same matrix | Same geometry/profile thresholds; computed exterior-shadow tokens resolve to `10%/5%`, the sampled peak is independently `8-35`, and Aqua material remains recognizable without becoming washed out against the light screen. |
| Equal-height detail board | new Aqua raster beside progress, loading, volume, and empty well | Bars shown at identical outer height; top/waist/bottom lighting and corner construction must be directly comparable without interpolation or unequal scaling. |
| Production mobile `390x844` | progress, loading, volume | Complete device visible; material bands and rib texture survive device scaling and do not collapse into flat cyan/white lines. |
| Production desktop `1440x900` | progress, loading, volume | Complete device visible; shadow reads as depth below the well, not a dark border attached to the fill. |
| Reduced motion | loading plus volume/progress value state | Loading is frozen but fully shaded; determinate/volume retain material and exact endpoints without decorative motion. |

Automatic geometry/profile checks are necessary but not sufficient. A PM/design
reviewer must inspect the rendered board at original detail and explicitly compare
it with the primary raster; a CSS-number-only review is invalid.

### Required molded-trough comparison board

Produce a new close-up board dedicated to the trough, not only the blue fill:

1. Crop the primary raster's determinate control, primary raster's striped control,
   the owner's newest rejected result, and the new candidate at `0%`, `35%`, and
   `100%`. The `35%` crop must retain at least `40%` empty channel so filled and
   unfilled construction are judged in one continuous object.
2. Normalize each crop once to a `28px` outer height using a documented high-quality
   resample, then show that equal-scale row at `4x` nearest-neighbor enlargement.
   Do not give the candidate more pixels or a different zoom than the source.
3. Below every crop, show aligned vertical slices through fill and empty channel and
   horizontal slices through the unfilled centerline. Label exterior background,
   cast shadow, outer lip, recess seam, empty channel, and fill; do not merge them
   under a single “border” label.
4. Include numeric plots/tables for the horizontal and vertical thresholds above.
   Empty-channel darkest/lightest range, seam contrast, edge sample diversity,
   transition width, and shadow falloff have equal pass/fail status to fill
   top/waist/bottom deltas.
5. Place an enlarged corner inset for top-left and bottom-left beside the same
   candidate corners. The inset must make the `4px`/`2px` outer-radius asymmetry,
   `3px`/`1px` channel-radius asymmetry, highlight return, and detached cast shadow
   visible without smoothing them away.

The board is rejected if it shows only a filled crop, crops out the empty portion,
labels a uniform gray surround as Aqua, uses unequal scale, or relies on CSS token
text without sampled rendered pixels.

### Verifiability classification

- **Directly observable:** equal `14px` outer and `12px` nominal-channel heights;
  separate lip/seam/shadow extents; asymmetric corner radii and edge luminance;
  empty-channel gradient; value endpoints; top/waist/bottom luminance ordering;
  darkest-row position; absence of an opaque bottom line or uniform gray frame;
  loading direction, rib period/duty, phase displacement, loop closure, and
  reduced-motion freeze.
- **Proxy-verifiable:** whether the same material profile survives browser
  compositing, both colourways, and production device scaling. Screenshot
  cross-sections plus original-detail inspection are the required proxy.
- **Owner-subjective:** whether gloss intensity, blue character, rib texture, and
  the balance between dimensionality and visual quietness feel authentically Aqua
  in motion and on the phone. The owner may require token tuning even when every
  numeric threshold passes.
- **Blocking ambiguity:** none. The shared height and material direction are now
  explicit. Only final aesthetic approval remains human-owned.

### Behavioral evidence

1. A deterministic-clock browser trace proving: accepted human volume input ->
   overlay visible within `50ms`; continued changes reset the timer; overlay remains
   at `1499ms`; standard progress/times return at `1500ms` (or the documented tuned
   value within the accepted range) with no layout shift.
2. Tests for clockwise/counter-clockwise changes, `0/100` clamping, provider
   rejection rollback, programmatic/agent update suppression, mode/navigation
   dismissal, and pending/failure priority.
3. Normal and reduced-motion computed-style evidence: determinate/volume width
   changes have no motion under reduced motion; loading remains frozen and visible;
   the volume dwell is unchanged.
4. Coordinate-driven mouse, touch, and pen tests for the center and the interior,
   radial extremes, corners, and near-diagonal edges of all four full sectors at
   front and oblique camera angles. Every stationary/short tap emits exactly one
   owning action.
5. Boundary tests at `r=37`, just above `r=37`, `r=103`, just beyond `r=103`, and
   immediately below/at/above `45`, `135`, `225`, and `315deg`; `10px` slop,
   cross-sector, cancellation, and lost-capture tests; keyboard parity tests; and
   an interaction trace proving short sector taps do not alter volume while moved
   annular gestures do.
6. Accessibility evidence for the transient Volume progressbar, the existing
   Loading playback progressbar, focus restoration after physical input, and no
   duplicate announcements or controls.

## Definition of done

- All measurable geometry, material, timing, input-region, state-priority, and
  accessibility requirements above pass focused unit and browser tests.
- Complete canonical and production screenshots are reviewed against the photos,
  with zero Critical or Major PM/design findings.
- Existing playback-selection, pending-state, and transport tests remain green;
  Aqua geometry/stripe tests are deliberately updated to the owner's shared `14px`
  target, molded lip/seam/channel/shadow trough, and cylindrical material. The
  horizontal/vertical cross-section artifact and required close-up board pass every
  threshold above, and full repo gates pass under the repository's `bun`/`bunx`
  law.
- The owner observes the volume swap/dwell live and approves its visual weight and
  timing, and explicitly confirms the three bars now read as the same-height
  cylindrical Aqua control. Automated evidence cannot waive that final fidelity
  judgment.
