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
