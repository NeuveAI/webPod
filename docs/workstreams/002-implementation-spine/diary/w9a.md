# Diary — W9a click-wheel control physics

Status on September 1, 2026: the device package now has transient, physically
lit click-wheel and Select travel. The implementation is ready for independent
3D review; W9b audio remains a separate lane.

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
  only until rest and has a 24-frame hostile-scheduler cap. Reduced motion
  keeps direct press feedback and snaps the release home.
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

## Browser evidence

The in-app browser resolves the full `CompositeDevice` to T3 on this machine,
so it cannot display the T1 HTML-in-canvas product path. I did not falsify the
tier. Instead, the existing production-surface capture branch gained a typed,
development-only `controlEvidencePose` input. It holds the exact production
geometries at rest, Select press, and four wheel angles without adding a second
interaction implementation.

Sixteen captures under the unchanged W8 rig are in
`evidence/w9a-browser/`: white key-only, fill-only and combined at rest,
Select press, wheel 0°, and wheel 90°; plus the equivalent combined black
states. Pointer lifecycle itself is covered by the mounted R3F tests.

## What bit me

The visible wheel and its screen-print decal share one geometry. That turned
out to be the right ownership: moving the physical plastic also moves the ink,
instead of leaving labels floating over a depressed mesh.

The other important boundary was `event.point`. Under R3F capture it is stale
after the pointer leaves the annulus. The input path now recomputes the current
ray-plane intersection every move and clamps only the deformation radius back
onto wheel plastic; the runtime still receives the true angular movement.

## Verification state

Final verification at the implementation boundary is green:

- `bun run typecheck`: 11/11 projects clean
- `bun run lint`: exit 0
- `bun test`: 1,072 pass, 0 fail across 66 files
- `bun run build`: client and SSR production builds complete
- `bun run gates`: 16 automated pass, 0 automated fail; U14 and U15 remain
  the standing owner/reviewer manual checks
- mounted mouse/touch/pen, release/cancel/lost-capture/blur/unmount coverage
- four-angle locality, signed seam continuity, real normal updates, rotated
  local normals, exact rest arrays, Select > wheel travel, and bounded rAF
- mutation plants for travel, GPU normal invalidation, frame cap, moving
  contact, and Select release all went red

The production build retains its pre-existing warning for the 1.23 MB Three.js
chunk. `git diff --check` is clean on every W9a path; its repo-wide invocation
reports only two trailing spaces in W8's concurrently modified
`volumetric-device-browser.txt`. No audio code was touched.
