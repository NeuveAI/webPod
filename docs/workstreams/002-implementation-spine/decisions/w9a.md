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
start a loop. Only a changing release requests browser frames. A healthy clock
stops the monotonic cubic return by elapsed physical time; frame count never
truncates it. The 24-frame escape counts only consecutive non-advancing or
non-finite timestamps and resets as soon as time advances. This preserves a
hostile/frozen-clock safety exit without changing 15–360 Hz motion.

Switching reduced motion on during an active release restores both controls,
invalidates that restored GPU state exactly once, and then cancels the obsolete
scheduled callback. Reduced motion therefore preserves direct feedback without
leaving a stale depressed demand-rendered frame.

## W9A-07 · Keyboard travel follows semantic Select ownership

Enter animates Select only when the keyboard event originates on the panel's
`role="application"` root. The device package does not perform selection or
navigation. Keyup, blur, visibility loss and unmount all release the visual
travel. This gives keyboard parity without making arbitrary Enter presses look
like hardware input.

## W9A-08 · Visual proof has no synthetic control seam

The first pass's typed evidence pose was not a valid exception to the binding
scope. It bypassed `CompositeDevice` and the pointer event chain under review.
It is deleted. `DeviceCanvas`, `ControlPhysicsScope` and the spike route expose
no pose injection, reset hook or query-string control state for proof.

Accepted visual evidence must use the existing real route and actual pointer
down, hold, move and release lifecycle. If a browser environment cannot render
T1, the result is an explicit evidence blocker—not permission to substitute a
synthetic pose or the known blank T3 path.

## W9A-09 · Historical coherence requires owner replay

Commit `2ec0861` exports five symbols before their definitions land in
`890b4f3`; an archive typecheck reproduces exactly those five errors. The
current source is repaired and archive-green, but Git commit objects are
immutable. No additive commit can make `2ec0861` standalone-green.

Repo law reserves history rewriting and force-pushing to the owner. The lane
therefore records a guarded local replay in
`evidence/w9a-owner-history-rewrite.md` and stops. Until the owner runs and
verifies it, historical standalone coherence remains open.

## W9A-10 · Readability is a wheel-material grazing response, not more travel

Owner acceptance keeps the W9 physical calibration intact: the wheel still
moves at most 0.08 mm inside the same 5.5 × 8 mm compact thumb footprint. The
readability correction is instead a weak body-local product-light card whose
position and target follow the live deformed contact point.

An ordinary Three scene light cannot provide the required isolation: scene
lights are collected for the render pass and would also reach the faceplate,
Select and screen surround. The response therefore lives only in the wheel's
physical material and enters Three's direct physical BRDF there. The wheel
geometry carries an immutable rest-normal attribute; the response is admitted
only on the displaced slope facing the grazing source. That makes the real
normal delta—not a UV, camera direction, screen coordinate or painted mask—the
readability signal, while preventing a flat diffuse spotlight on white plastic.

The bounded calibration is 7.5 mm tangent offset, 1.2 mm surface lift, 16 mm
range, 20°/42° cone, 1°/1.35° displaced-slope window and 0.06 peak linear
irradiance. Intensity is exactly zero at rest. The existing pointer invalidation
and 120 ms release frames update the uniforms; the response owns no frame loop.
Reduced motion preserves direct held feedback and clears it on release without
requesting a release animation.

## W9A-11 · Continuous source and slope-only specular supersede W9A-10

W9A-10's travel boundary remains binding, but its sampling and optical
mechanism are rejected. A nearest production vertex is not the contact: it
held the source still for up to 2.07° and then moved it 3.448 model pixels.
The controller now samples the analytic front-shell point and normal at the
actual body-local contact. At the compact height field's centre the deformation
gradient is zero, so the live source point is that analytic point displaced by
the current depth along its normalized rest normal. Tessellation no longer
enters the source calculation.

`RE_Direct` is also rejected because Three's physical direct-light function
adds Lambert diffuse as well as specular. The wheel-only shader now contributes
only to `reflectedLight.directSpecular`, and only where
`length(liveNormal - restNormal)` crosses the literal 0.65°–0.9° slope window.
The contact-local cone and range still bound the response spatially. There is
no diffuse accumulator, ordinary scene light, UV mask, view-space source or
flat-normal admission path. The reviewer's exact plain-`geometryNormal` plant
is a failing test.

The final visual calibration is 4 mm tangent offset, 5 mm surface lift, 12 mm
range, 20°/42° cone and 0.06 peak neutral linear edge return. These are bounded
visual values, not OEM measurements. Travel remains exactly 0.08 mm.

Production diagnosis also found that the former broad dark centre survived at
zero auxiliary irradiance: the static wheel-gap floor was only 0.05 model
pixels behind a wheel moving about 0.42 model pixels, so it intersected the
depressed patch. The existing floor now receives the same analytic local
deformation as the ring. It remains at the established 0.05-pixel separation
at rest and adds no new geometry, recess or render-order fake.

## W9A-12 · The contact card is incident energy evaluated by the wheel BRDF

W9A-11's raw write to `reflectedLight.directSpecular` is rejected. An
accumulator name does not turn an RGB mask into specular reflection. The
contact source now supplies only cone/range/slope-gated incident irradiance.
Three 0.185.1 evaluates that energy through `BRDF_GGX_Multiscatter`, which
invokes `BRDF_GGX(lightDir, viewDir, normal, material)`, and through its
separate `BRDF_GGX_Clearcoat` lobe. Roughness, Fresnel, the view direction,
multi-scattering compensation and each colourway's actual clearcoat therefore
remain owned by the installed physical material. No diffuse or emissive path
exists.

The source remains body-local but is now genuinely grazing: 8 mm along the
wheel tangent and 1.5 mm above the surface. Its 8°/18° cone reaches only about
2.65 mm at the contact plane, less than the 5.5 mm radial deformation support.
The source's explicit peak of 40 linear scene-irradiance units is attenuated by
incidence, that narrow cone, squared range falloff, the 0.65°–0.9° live/rest
normal gate and the material BRDF. It is a visual calibration, not a physical
lamp measurement. Production captures show an asymmetric edge crescent rather
than the former broad pool. Wheel travel remains exactly 0.08 mm.

The shader patch validates itself at compile installation. The marked block
must contain exactly the base GGX and clearcoat accumulator writes, both in
their exact gated forms; the patched shader must add exactly two optical output
writes relative to its input. Any extra raw accumulator, emissive write,
missing cone/range/slope/incidence factor or missing material BRDF fails closed.

## W9A-13 · Owner correction: wheel motion is a scalar local-Z height field

The owner rejected the W9A-10 through W9A-12 result because motion along the
crowned rest normal changed local X/Y and read as a travelling lateral warp.
That rejection supersedes those sections' wheel deformation and auxiliary
optical mechanism. Their review history remains above; none is production law.

The wheel's immutable front-plane X/Y coordinates now define its shape. For
every held and releasing sample, each vertex copies rest X and Y exactly and
only local Z decreases. The depression is the C2 scalar field
`z = z0 - depth * (1 - q²)³`, capped at the established 0.08 mm. Its live
normal is exactly `normalize(-dz/dx, -dz/dy, 1)`, combined analytically with
the crowned rest surface slope. No normal-projected position, radial motion,
tangential motion, scaling, shearing, UV mask or view-dependent proxy remains.

The field's radial support contracts near the Select and outer hairlines. Both
circular boundaries are zero-height/zero-gradient constraints, so the inner
gap, outer silhouette and their normals remain byte-identical while contact
moves. The existing shallow floor receives the same Z field only beneath the
visible annulus and cannot intersect the wheel.

The contact-local shader card is removed, not recalibrated. Black and white
wheel surfaces use their ordinary physical materials under the approved key
and fill. Lighting now reveals only the true height-field normals; it cannot
stamp a travelling oval or substitute optical energy for geometry.

## W9A-14 · The visible basin has no preferred in-plane direction

W9A-13 fixed position but retained W9A-02's 5.5 × 8 mm footprint. That
anisotropy was not lateral motion, yet it made the analytic normal lobe almost
twice as long around the ring as across it. At the 45° contact and quarter
camera, the approved oblique softbox therefore rendered several parallel
diagonal bands. The owner rejected that result as a stamped warp.

The footprint is now a 5.5 mm-radius circle in immutable body-local XY. The C2
height profile, 0.08 mm maximum depth, exact rest X/Y, fixed boundaries,
ordinary wheel materials and approved key/fill rig are unchanged. Near a
physical ring boundary only the existing radial support contraction may break
isotropy, because preserving the Select gap and outer silhouette is the harder
constraint there.

No optical correction was reintroduced. The production browser compares the
new held-vs-rest image response with the immutable owner-rejected white quarter
pair. That gate measures affected area and principal aspect, so restoring the
8 mm tangent support is both a geometry-test failure and a visual-comparison
failure rather than a subjective documentation edit.
