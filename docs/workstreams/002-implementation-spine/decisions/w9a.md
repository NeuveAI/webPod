# Decisions — W9a click-wheel control physics

## W9A-01 · Rest geometry remains the immutable source

Each bound control stores byte copies of its existing position and normal
attributes. Every held pose is recomputed from those copies, never accumulated
from the previous move, and every terminal path restores them exactly. This
prevents drift, makes the signed-angle seam continuous, and preserves the W8
flush/OEM gates at rest.

## W9A-02 · Wheel travel is a compact body-local height field

The wheel displacement is `w=(1-q²)³` inside an elliptical thumb footprint and
zero outside it. Vertices move inward along their own analytic rest normals.
Normals use the exact gradient of the same height field projected onto each
local tangent plane. The existing world-space lights therefore reveal real
geometry; there is no UV mask, shader uniform, screen-space spot or view vector.

The ellipse is wider along the wheel tangent than across the plastic. This
matches the shape of a thumb load and avoids the circular spotlight found in
the first browser calibration.

## W9A-03 · Travel values are visual calibration, not OEM measurements

The rest state is owner-measured. The mechanism is corroborated by the iFixit
5G wheel/button disassembly, but neither Apple nor the repair material supplies
a travel dimension. The shipped limits are therefore explicitly bounded
calibration: wheel 0.08 mm, Select 0.36 mm, footprint 5.5 × 8 mm, release
120/96 ms. Literal tests make any later retune an explicit decision.

References:

- <https://www.ifixit.com/Guide/iPod+5th+Generation+(Video)+Click+Wheel++Replacement/614>
- <https://documents.cdn.ifixit.com/pdf/ifixit/guide_611_en.pdf>

## W9A-04 · Interaction geometry stays static

The input annulus and new Select disk stay on the established
`clickWheelInputZ` plane. Pointer capture, ray reprojection, selection
prevention and orientation gating remain there. The visible patches deform
behind that plane, which preserves hit stability and keeps visual travel from
changing navigation.

## W9A-05 · Visual contact and navigation are parallel consumers

The same live ray produces two outputs:

- the unchanged absolute angle sample for the composite/state detent runtime
- a body-local contact point for the device-only deformation controller

The controller has no store, screen, acceleration, coast or detent dependency.
Sub-detent motion can move the visual thumb load but cannot navigate or emit
feedback. Optional Select start/end types are the only cross-lane seam for W9b.

## W9A-06 · Demand rendering is event-driven and release-bounded

Holding a control writes geometry once and calls R3F `invalidate`; it does not
start a loop. Only a changing release requests browser frames. The monotonic
cubic return stops by elapsed time or 24 frames, whichever comes first. A
reduced-motion release restores immediately while preserving the direct held
pose.

## W9A-07 · Keyboard travel follows semantic Select ownership

Enter animates Select only when the keyboard event originates on the panel's
`role="application"` root. The device package does not perform selection or
navigation. Keyup, blur, visibility loss and unmount all release the visual
travel. This gives keyboard parity without making arbitrary Enter presses look
like hardware input.

## W9A-08 · A typed capture pose is the minimal evidence exception

The in-app browser resolves `CompositeDevice` to T3, while the direct
production-surface route can render the physical model. `DeviceCanvas` now
accepts the development-only `controlEvidencePose`; the spike route validates
the finite query union and passes it only in production-surface capture mode.
This is the one app-file exception to `packages/device/**`, and it exists so
key/fill/combined held states are deterministic and reproducible rather than
timed screenshots of synthetic pointer events.
