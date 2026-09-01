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
