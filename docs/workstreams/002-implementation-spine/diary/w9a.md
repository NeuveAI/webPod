# Diary — W9a click-wheel control physics

Status on September 1, 2026: the device package now has transient, physically
lit click-wheel and Select travel. The first antagonistic review found four
Majors and one Minor. The current source closes the runtime and proof-API
findings; historical commit repair and owner-visible T1 capture remain explicit
owner actions rather than claims this lane can manufacture.

## What moved

`DeviceCanvas` now owns one `ControlPhysicsController` beside the established
orientation context. `Device` binds the existing flush wheel and Select patch
geometries to that controller; no replacement cylinders, sidewalls, pockets or
material tricks were introduced.

- Select moves 0.36 mm inward along each vertex's body-local rest normal while
  held. Release is a monotonic 96 ms return with no overshoot.
- Wheel contact moves at most 0.08 mm. Its compact thumb footprint is 5.5 mm
  across the plastic and 8 mm along the ring. The C2 displacement and its
  analytic tangent-plane normal gradient travel continuously with the pointer.
- The invisible annulus/disk remain fixed and own pointer capture. Visible
  deformation never participates in hit testing, so a moving mesh cannot move
  the target out from under the pointer.
- Direct hold feedback schedules no frame. Release schedules demand frames
  only until its physical duration ends. A separate 24-frame escape applies
  only while timestamps are non-advancing or non-finite, so healthy 15–360 Hz
  releases cannot be truncated. Reduced motion keeps direct press feedback and
  snaps a direct or already-running release home with one final invalidation.
- The existing arc callbacks still carry only angle/time into the composite
  runtime. Contact geometry is a sibling side effect and cannot change a
  detent. Select exposes optional typed start/end events for W9b without
  implementing audio here.
- Enter shows Select travel only when the event target is the semantic
  `role="application"` panel. Native controls and the preview stage do not
  animate it.

## Source and calibration honesty

The owner photographs `IMG_2239.HEIC` through `IMG_2249.HEIC` are the rest
authority: faceplate, wheel and Select read as nearly coplanar material inserts.
iFixit's 5G disassembly material confirms the wheel and centre button are
separate parts and that the plastic centre piece actuates a logic-board switch.
It does not publish travel dimensions. I found no defensible 5G travel figure,
so 0.08/0.36 mm and the thumb footprint are named visual calibration values,
not OEM claims.

The first browser calibration was mechanically correct but visually wrong on
white hardware: a 0.18 mm circular load under a 5.5 mm radius read as a bright
spot. The final calibration lowers wheel travel to 0.08 mm and uses a wider
tangential footprint. Under the real rig it reads as a broad travelling load;
Select remains 4.5 times deeper.

## Browser evidence correction

The first evidence pass was invalid. It added a synthetic
`controlEvidencePose` input and drove the controller directly, bypassing the
production `CompositeDevice` pointer lifecycle. The review correctly rejected
that as a proof-only API. The prop, component and query branch are now deleted,
and a static gate prevents those names from returning.

The sixteen old captures were also JPEG bytes with `.png` suffixes. They now
live under `evidence/w9a-rejected-synthetic/` with truthful `.jpg` extensions
and are indexed only as rejected calibration artifacts. They do not clear any
browser requirement.

Accepted visual proof must now start at the ordinary `/_spike/device` route and
use actual pointer down, hold, move and release through `CompositeDevice`. The
available browser connector could not attach to flagged Chrome T1; local Chrome
is 152.0.7977.65 and the connector returned `Browser is not available: chrome`.
The known T3 blank path was not used as proof. Exact provenance and the missing
capture checklist are recorded in `evidence/w9a-browser.md`.

No accepted pointer trace, release sequence or oblique macro is claimed in this
revision. That owner/reviewer-visible evidence remains open until a connected
Chrome T1 session is available with `CanvasDrawElement` enabled.

## What bit me

The visible wheel and its screen-print decal share one geometry. That turned
out to be the right ownership: moving the physical plastic also moves the ink,
instead of leaving labels floating over a depressed mesh.

The other important boundary was `event.point`. Under R3F capture it is stale
after the pointer leaves the annulus. The input path now recomputes the current
ray-plane intersection every move and clamps only the deformation radius back
onto wheel plastic; the runtime still receives the true angular movement.

## Verification state

Corrective verification at the implementation boundary covers:

- mounted mouse/touch/pen, release/cancel/lost-capture/blur/unmount coverage
- four-angle locality, signed seam continuity, real normal updates, rotated
  local normals, exact rest arrays, Select > wheel travel, and bounded rAF
- frame-rate sweeps at 15, 30, 60, 120, 240 and 360 Hz, plus the distinct
  frozen-clock escape
- mutation plants for the live reduced-motion invalidation, healthy-clock
  stall reset, direct reduced-motion invalidation and proof-only API all went
  red

The exact final command results are in `evidence/w9a-gates.md`.

The review also proved that `2ec0861` cannot typecheck alone because its index
exports five input symbols introduced by `890b4f3`. Current source cannot alter
an existing commit object. `evidence/w9a-owner-history-rewrite.md` therefore
contains an owner-only local replay plan; no rewrite or force-push was executed
by this lane.

No audio code was touched by the W9a correction.

## Owner readability correction

The owner approved W9b audio and asked for the shallow wheel load to read more
clearly without increasing travel. The first implementation mistake was useful:
a full diffuse auxiliary light produced a pale contact disc on white hardware.
The production browser caught it before commit. A specular-only response removed
the disc but was too weak front-on. The final response uses the real difference
between each live displaced normal and an immutable rest normal to admit only
the source-facing grazing slope into Three's physical direct-light BRDF.

Travel remains 0.08 mm. The response is material-local to the wheel, begins at
1° of real normal deflection, reaches full strength at 1.35°, and peaks at 0.06
linear irradiance. A temporary zero-intensity production run confirmed that the
dark held lobe in oblique views is the existing W9 geometry under the approved
key/fill rig, not an auxiliary spotlight. The correction adds a restrained edge
cue rather than making a deeper or brighter front-facing dent.

Unlike the earlier synthetic evidence attempt, this correction was exercised
through the ordinary `/_spike/device` route with real Chrome mouse down, move
and up events. Moving from the right to bottom wheel positions changed the
screen selection through the existing composite/state path while the material
response followed the same contact. No query parameter or proof API was added.
The exact browser provenance, image index, deterministic lifecycle assertions
and mutation plants are recorded in `evidence/w9a-readability.md`.

The connected in-app browser still renders the known blank T3 canvas and was
not counted as proof. A separately launched local Chrome 152 session with
`CanvasDrawElement` enabled rendered T1 and produced the accepted correction
captures. No audio path was read or changed by this correction.

## Readability antagonistic re-review

The review found that the accepted correction was continuous only in its mesh
deformation, not in its optical source. I had sampled the nearest vertex, which
turned a continuously moving thumb into a source that plateaued for 2.07° and
jumped 3.448 pixels. The source now comes directly from the actual contact and
the same analytic curved-shell functions that build the production face. A
36,001-sample, 0.01° sweep over the production 128 × 24 topology moves on every
sample, remains between 0.012872 and 0.012888 model pixels per step, and closes
the signed seam to 1.78e-14 model pixels.

The review also correctly rejected my shader test. Checking that my source did
not spell `directDiffuse` proved nothing while it deliberately called
`RE_Direct`, whose implementation adds Lambert diffuse. The revised shader
never calls it. It writes a neutral, bounded edge return only to Three's direct
specular accumulator, gated by the magnitude of the real live/rest normal
difference. Replacing that difference with plain `geometryNormal` now fails the
focused suite.

The production browser exposed a second cause that code reading had missed.
The warm/dark oval remained with response irradiance forced to zero. The
0.05-pixel gap floor was physically intersecting the 0.42-pixel wheel travel.
Deforming that existing floor with the same field removed the broad oval while
preserving its exact rest separation. The final 0.06 specular edge return is
small enough to avoid a spotlight disc but makes the real 0.08 mm depression
read on black and white at front and quarter angles.

Evidence now includes all twelve black/white × front/quarter rest/hold/release
frames, a real held 1° seam sequence, a full active pointer trace and a two-
second production idle trace. Every rest/release pair is byte-identical. The
idle trace contains zero animation-frame requests, callbacks, begin/draw frames
or paints. The browser recording command could not encode WebM because this
host has no `ffmpeg`; the explicit sampled sequence is the accepted temporal
alternative and is indexed with that limitation rather than a false recording
claim.

Detach/rebind now has an independent cleanup gate. Deleting only the current
binding's `readability.clear()` fails exactly that test; stale detach remains
unable to clear a replacement. No audio source was touched.

## Material-BRDF correction

The next review caught a category error in my use of Three's output names. I
had put a bounded RGB mask into `reflectedLight.directSpecular` and called it a
specular response. It still ignored the wheel's roughness, Fresnel, clearcoat
and view direction, so the temporal frames showed a smooth-moving halo rather
than a material glint. Smoothness had fixed the first defect while making the
second easier to see.

The installed Three 0.185.1 shader already contains the right contract. The
wheel card now computes only incident irradiance, including physical incidence,
then passes it to `BRDF_GGX_Multiscatter`; clearcoat uses
`BRDF_GGX_Clearcoat`. The black 0.44-roughness / 0.08-clearcoat wheel and white
0.8-roughness / 0.035-clearcoat wheel therefore answer differently without a
colourway branch or independent tuning.

The browser calibration changed source shape, not travel. A low lifted source
8 mm along the tangent and a narrow 8°–18° cone turn the old pool into a small
asymmetric crescent. The apparent peak source number is 40 in Three's linear
scene units, but it reaches output only after incidence, cone, squared range,
slope and physical BRDF attenuation. The 18° cone covers about 2.65 mm at the
contact plane. The 0.08 mm deformation and all demand-rendering lifecycles are
unchanged.

The first substring test had another fail-open shape: a correct guarded line
could coexist with an unguarded second line. The runtime installer now counts
every optical output assignment relative to the input shader and requires the
two exact GGX/clearcoat statements. Nine in-test plants remove individual
gates/BRDFs or add raw direct-specular/emissive energy; all are rejected.

Final evidence was recaptured through ordinary `CompositeDevice` pointer input
in flagged Chrome, across both colourways and front/quarter views, plus a
thirteen-frame signed-seam sequence. I also captured black/white Select
rest/hold/release in front and quarter views through the same production path.
Key-only and fill-only Select macros remain open: the existing light-isolation
query renders `DeviceCanvas` in the production-surface diagnostic branch and
therefore bypasses the production pointer chain. I did not add a proof API to
manufacture them.

## Owner depth-axis correction

The owner identified the defect more directly than the preceding shader
reviews: the ring looked warped because it was warped. `deformWheelSurface`
subtracted `normal.x * depth` and `normal.y * depth` from every affected
vertex. On a crowned front shell those components are non-zero, so a nominal
press also pinched and expanded the ring laterally as contact travelled.

I replaced that vector displacement with one scalar body-local Z field. The
implementation rewrites X/Y from immutable rest arrays on every frame, lowers
only Z, and derives normals from the exact field gradient plus the existing
shell slope. I also made the visible inner and outer radii fixed boundaries;
the support narrows as the pointer approaches either seam instead of pulling a
gap around the ring. Travel remains 0.08 mm.

I removed the entire grazing-response shader and its custom material. Even
after it had become BRDF-correct, it was still an extra travelling optical
shape and could make a shallow depression read as an oval stamp. Production
now uses the ordinary black/white polycarbonate materials and the existing
world-space key/fill rig.

The focused suite sweeps 72 angles at three production contact radii, every
3,225 wheel vertex, release samples, both circular boundaries and an
independent finite-difference normal oracle. Three deliberate plants restore
lateral normal motion, release the fixed boundaries, and delete the height
gradient; they fail four, one, and one tests respectively.

Flagged Chrome then exercised the ordinary `/_spike/device` route using a real
mouse down/hold/up lifecycle. Twelve black/white × front/quarter
rest/hold/release PNGs were captured. Every released image is byte-identical to
its matching rest image. No query-controlled physics state or proof API was
added.

## Owner visual rejection follow-up — isotropic depth basin

The strict W9A-13 mesh tests were green, but the owner was right to reject the
render. The committed white quarter hold still showed a broad multi-band
diagonal stamp. With the auxiliary shader already absent, the remaining cause
was the scalar field itself: its 5.5 mm radial × 8 mm tangential support made
the true normal gradient strongly directional, and the 45° softbox made that
directionality obvious.

I changed only the tangential support to 5.5 mm. Depth remains 0.08 mm and the
field is still `(1-q²)³`; no light, material, shader, release timing, hit plane
or tessellation changed. A new production-mesh gate measures radial versus
tangential support and an independent scalar oracle samples equal distances in
both directions. Restoring the rejected 8 mm value fails two focused tests.

The first browser run used a worktree snapshot only for visual calibration.
After the source and test commits, I reran the ordinary production pointer path
from exact commit `7baedf9f7039911e619de8fabed71d4fa3197f88` and tree
`b30cd16bd5691f99fbeb2ea92fe9382e872e9118`. The immutable white quarter
response fell from 3,355 to 2,278 changed pixels, from 67 × 100 px to 54 × 70
px, and from 1.744 to 1.393 principal aspect. All four release captures are
byte-identical to rest.

The first full gate run caught a documentation path literal in the browser
test's implementation source. I replaced the path lookup with the rejected
pair's immutable hashes and measured baseline. The final full gate run is 16
automated pass, zero automated fail; U14/U15 remain the standing manual gates.

## Owner correction — rigid click-wheel assembly

The owner rejected the localized basin itself: it still looked like the wheel
surface was warping under a thumb. I initially treated “only Z changes” as the
physical invariant, but that was incomplete. A spatially varying Z field is a
flexible surface. The actual control has to move as one rigid plastic part.

I removed the wheel height field, footprint, gradient-normal rewrite, boundary
contraction, contact clamp and pointer-move physics update. The wheel gap floor,
visible ring and legend decal now share one group. `pressWheel()` translates
that group from rest by 0.03 mm along device-local negative Z and changes no
geometry. Select remains an independently deforming part.

The replacement tests inspect every vertex in the production ring and backing,
prove their position and normal arrays remain exact, prove the live matrix is
identity plus one local-Z translation, recheck both circular radii, and rotate
the parent to show travel follows the device rather than world Z. Release,
reduced-motion live transition, detach/rebind, 15–360 Hz timing and frozen-clock
escape retain their prior gates. The mounted input test proves a captured move
still reaches navigation while physical press count remains one.

Four scratch-tree plants were run against committed source: restore 0.08 mm,
add lateral X travel, add control rotation (normal transform), and re-press on
pointer move. Each produced two focused failures. Package/device, composite
runtime/audio integration, full typecheck, lint, tests, build and automated
gates are green.

The final browser run served immutable commit
`ee920aa6fb62ec8eeba97540ba7f3a43c4bcce2d` and tree
`ef93e2bb35cd393b25c4b44a59c0fbe3243cd59d`. Ordinary Chrome pointer
down/hold/up produced all twelve black/white × front/quarter
rest/held/released frames. Every release hash equals rest; held frames differ
without the former travelling oval or changing silhouette.

## Owner correction — contact-following rigid wheel rock

The owner corrected the remaining physical model: the click wheel does not
translate as one slab. The rigid disc rocks by a tiny amount toward the live
thumb angle around its centre pivot. I replaced the whole-wheel translation
with a quaternion-only rigid transform. Pointer down supplies the initial
body-local angle and captured pointer movement updates only the tilt axis;
navigation, detents and audio remain in their existing runtimes.

The wheel ring and ink now sit in a group whose origin is the flush wheel
centre. The fixed under-floor and separate Select are outside it. The group
position and scale remain exact while one bounded local rotation changes. No
position or normal attribute is written. A complete production-tessellation
test proves every pairwise vertex distance survives the live transform, and a
2° sweep proves the contact radius is always the low side while the opposite
radius is high and the perpendicular radius stays neutral.

The first immutable 0.018 mm route capture exposed a collision that the rigid
matrix tests could not: the low side exceeded the existing 0.05-model-unit
hairline clearance, allowing the fixed floor to clip through as a diagonal
wedge. That capture was rejected and overwritten before evidence commit. I
reduced the bounded low-side rim travel to 0.006 mm and added an executable
clearance gate. The final immutable black/white front/quarter captures have no
wedge, changing silhouette, travelling stamp or auxiliary optical response.
Every released capture is byte-identical to rest.

## Exhausted list boundaries — accepted movement owns feedback

The boundary defect sat between two individually reasonable layers. The input
reducer measured real detents and budgeted their click/haptic feedback before
the screen machine clamped row movement. The store then returned and published
that raw budget even when the highlight and window had not moved. Audio was
correctly consuming the authoritative feedback atom; the atom itself was not
yet authoritative about list acceptance.

I moved the final decision into the one store path shared by driven detents and
coasts. It applies the requested rows through the screen machine, measures the
actual highlight delta, and reconciles detents, rows, clicker ticks, haptic
pulses, rate and acceleration before publishing anything. A fully rejected
outward attempt returns zero accepted movement and publishes no bump, feedback
event or announcement. Intentional `moveHighlightActionAtom`, transport and
root-Menu boundary bumps remain unchanged.

A rejected or partially clamped event also clears residual travel, direction,
speed and acceleration history while retaining the active path and its paid
dead zone. That combination stops flick/coast momentum at the edge without
making the first valid reversing detent feel delayed. Coasts required one extra
piece of provenance: a frame can cross acceleration tiers, so it now carries a
small per-detent row trace. The store truncates that exact prefix instead of
guessing accepted clicks from the frame's final multiplier.

The tests cover first/last boundaries on short, one-viewport and 100-row lists,
repeated outward attempts, touch reversal, immediate keyboard announcements,
accelerated partial clamps, mixed-tier coasts and coast termination in both
directions. The composite audio test drives the real store binding and proves
four raw outward attempts create zero voices while the first inward detent
creates exactly one.

Modern Web Guidance returned only unrelated scroll-snap/carousel guidance. The
configured `agent-context` global/Jotai reference files were absent, so the
implementation was grounded in the repository's actual Jotai store, reducer,
screen and audio contracts.

## Owner correction — flat LCD reveal and axial Select press

The owner identified two residual false-depth cues. Three's front-shell
extrusion applied the outer body bevel to the LCD hole too, so the face grew a
reflective screen lip that the real assembly does not have. Select press also
deformed every vertex along its curved normal, changing X/Y and surface shape
instead of moving the separate plastic part into the device.

The display fix retains the outer shell roll and collapses only the screen
hole's generated bevel back onto the authored rounded-rectangle contour. A
full-depth, unlit black reveal now covers the opening wall; the transparent
cover sheet is planar and contributes no visible side perimeter. The T1 DOM
screen and its dimensions are unchanged.

Select now binds the actual mesh rather than its geometry. Pressing translates
that mesh by a restrained 0.12 mm along device-local negative Z. Geometry,
normals, material, X/Y, quaternion and scale remain immutable; release restores
the exact rest transform. Wheel tilt, pointer capture, navigation and SFX paths
were not changed.

Owner photographs plus Apple and iFixit references supplied the necessary
front, quarter and assembly evidence. No relevant angle remained missing. The
final immutable browser run served commit
`16cbf4a2705417f19c375b97b6819eb13f4d777e`, tree
`c487ae746f64cfa6c5f464d0b6faa174db2f7860`, and captured black/white ×
front/quarter × rest/held/released through the ordinary pointer path. Every
release image is byte-identical to rest.
