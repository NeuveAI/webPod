# Decisions — volumetric device

Autonomous implementation decisions taken while landing the volumetric device on
August 31, 2026.

## VD-01 · One orientation root, not per-face branches

The device, composite route, and click-wheel interaction all read one
`DeviceOrientation` shape. Front, three-quarter, edge, and rear are presets over
that shape, and “which face is visible?” is derived from the orientation rather
than stored independently. That keeps flip/orientation work ready for later
accelerometer input without creating a second pose model now.

## VD-02 · Depth is geometry, not a baked front texture

The display recess, wheel recess, raised Select, and rear inlay are all real
meshes. I did not try to paint these cues into albedo or roughness maps. The
user asked for a proper 3D object that can survive flip and edge views; only
geometry survives those views honestly.

## VD-03 · World-fixed lamps, rotating object

The model rotates under a stable light rig. I did not rotate the lamps with the
device. Keeping light directions fixed is what lets the black and white shells
read as physical materials instead of flat fills whose highlight simply follows
the mesh.

## VD-04 · Pencil is authority for surface placement, not for shipping pixels

Pencil components `VWaJS` and `zbTc3` supplied the authored front and rear
surface layout: chamfer height, bezel seam, display well extents, wheel ring,
Select proportions, rear mirror band, rear inlay, and the legal/identity stack.
I reused those measurements, but I did not rasterize the whole device from
Pencil. The shipped object remains procedural Three geometry with material
response, not a flat pasted render.

## VD-05 · T1 stays the main path; T3 blankness is not “fixed” in W8

The scoped request was to push the `html-in-canvas` path first and keep
fallbacks for later. I therefore kept the T1 implementation path as the only
real composited route. The in-app browser on this machine still resolves the
composite page to T3, so that surface does not show the panel there yet. I
recorded that runtime fact rather than smuggling in a fallback implementation
under the volumetric task.

## VD-06 · LCD sharpness comes from the source raster and exact DPR, not from a fake sharpen pass

The LCD source is now rasterized at 320×240 before upload and scaled by the
resolved raster density. `CanvasPixelDensity` passes the measured DPR as a
number directly into R3F, closing the fractional-zoom seam. I did not add a
post-process sharpen trick, because that would hide the source-resolution bug
instead of fixing it.

## VD-07 · The front blank capture was a harness issue, not a render issue

An early front composite screenshot came out blank while the three-quarter pose
looked correct. I treated that as a possible regression, then falsified it by
polling the route directly: the front pose did attach the panel host, expose
`requestPaint`, and render with the correct canvas size. The fix was to wait for
host attachment in the evidence harness, not to mutate the product.

## VD-08 · Probe identity follows the rendered stack, not a hidden proxy

The review-blocking edge and rear failures came from the same root mistake:
asking the verifier to prove a surface the camera was not actually reading.
Every probe-relevant visible surface now has a semantic identity, and the route
admits a pixel only when the first visible hit matches the rendered surface for
that pose. For the rear, that means `device-back-composition /
back-composition` first and `device-steel-back / steel-back` present behind it.
For the edge, it means the visible steel shell rather than a front-face body
proxy.

## VD-09 · The exact edge pose must sample inside the shell half, not on the split

At yaw `-90°`, the device side is not one material depth from front to rear.
`Device.tsx` splits the chassis at `z = 0`: the steel shell occupies the front
half and the rear steel plate occupies the back half. My first edge probe used
`z = 0`, which is a geometric boundary, not a trustworthy rendered sample. The
edge targets now read at `body.depth / 4`, safely inside the visible shell
band, so the probe tests the sidewall the user sees instead of the split where
rear steel can legitimately win the pixel.

## VD-10 · Fresh flagged-Chrome proof is enough; I did not reopen long browser work

After the user explicitly asked me to stop hanging on more browser work, I kept
the rerun bounded. The follow-up evidence is:

- one fresh flagged-Chrome pose summary in
  `evidence/volumetric-device-browser/summary.json`
- one fresh responsive Playwright run in
  `evidence/volumetric-device-responsive.txt`
- fresh DPR density and LCD acuity captures in
  `evidence/volumetric-device-density.txt` and
  `evidence/volumetric-device-acuity.txt`
- fresh package/app checks and full gates logs

I did not leave any new long-running browser or Vite process behind after the
captures completed.

## VD-11 · D-064 lives in code and browser evidence, not only in the write-up

The route-level sampler now throws on any non-canonical pose, and the new
Playwright proof asserts that behavior directly. That is more important than a
paragraph repeating the owner ruling, because the failure mode here was not lack
of prose — it was a tool that still looked callable in the wrong poses. Front
and rear sample green; three-quarter, edge, and custom must fail closed and be
proved another way.

## VD-12 · Fix the source/rig drift at the patcher, not by hand-copying "good" numbers

The passing rig state was not the shipped state. `apply-rig.ts` had been
patching repeated stale offsets into `materials.ts`, so later tuned fields in a
surface block could be skipped without any runtime error, and the room file was
never syncing the full `stopExposure` array. I fixed the patcher to replace the
whole block once per surface and to rewrite the full stop-exposure row, because
otherwise the next tune would have reintroduced the same "browser looks wrong,
rig looks right" split.

## VD-13 · The black Select's extra depth comes from transport, not a fake light

The black center plug needed more depth, but D-064 forbids pose-specific lights,
painted gradients, and unattenuated emission. The fix is a real thickness path:
shared transmission, attenuation distance/color, and a radial thickness map on
the black Select cap. That changes optical path length through the material
instead of painting a highlight into the object.

## VD-14 · Colourway-specific material keys are required when only one colourway carries extra physical inputs

The white front sample failed only after visiting black first because React
reused the Select materials across colourways while the black cap alone carried
its thickness-map transport inputs. The right fix was not to weaken the proof or
duplicate device state; it was to key the black and white Select cap/wall
materials separately so a black-only physical input cannot leak into white.

## Sources actually used

- `AGENTS.md`
- `docs/workstreams/002-implementation-spine/scope-volumetric-device.md`
- `docs/workstreams/002-implementation-spine/dispatch/W8-volumetric-device.md`
- `docs/workstreams/002-implementation-spine/dispatch/W4-device-layer.md`
- `docs/workstreams/002-implementation-spine/dispatch/W6-composite.md`
- `docs/workstreams/002-implementation-spine/reviews/visual-repair-review.md`
- `~/code/agentic-context/react-three-fiber/docs/API/canvas.mdx`
- `~/code/agentic-context/react-three-fiber/docs/API/hooks.mdx`
- `~/code/agentic-context/react-three-fiber/docs/advanced/scaling-performance.mdx`
- `~/code/agentic-context/three.js/src/textures/HTMLTexture.js`
- `~/code/agentic-context/three.js/src/renderers/webgl/WebGLTextures.js`
- `~/code/agentic-context/three.js/examples/jsm/interactive/HTMLMesh.js`
- `~/code/agentic-context/html-in-canvas/README.md`
- `~/code/agentic-context/html-in-canvas/Examples/webGL.html`
- Pencil MCP reads of `design.pen` components `VWaJS` and `zbTc3`

## VD-15 · White-front repair stays in physical light/material terms, not geometry or paint

The owner rejection was about the front reading like a raster-lit card:
shimmer, broad horizontal slabs, clipped white lift, and a wheel that did not
sit materially below the pearl shell. I kept the fix inside the W8-owned
physical terms:

- no pose lights
- no painted front gradients
- no fake glass emission
- no route-side screen sharpen pass

The repair space was therefore LAW 2's light placement plus the front-surface
material parameters already owned by `packages/device`. The current pass moves
the key/fill farther into a softer studio arrangement, lowers front dielectric
room gain, roughens the white wheel stack, and keeps the white body/shader on
the direct-light transport path rather than adding a new visual trick.

## VD-16 · LCD crispness is treated as a transmission-budget problem

The preview screen inside `/_spike/device` is already authored as a nearest
filtered 320×240 raster in the route. The extra softness the owner still sees
there is therefore mostly the cost of looking through the transmissive cover,
not a panel paint bug inside W8's surface.

I answered that inside the device package by raising
`DEVICE_TRANSMISSION_RESOLUTION_SCALE` from `4` to `12` and keeping the
cover's environment contribution near zero. That spends real render resolution
on the glass pass instead of hiding it behind a post-process or CSS sharpen
trick.

## VD-17 · Record cross-slice verifier failures instead of laundering them into W8 proof

On Tuesday, September 1, 2026, the fresh Playwright verifier invocation

- `bunx playwright test volumetric-device-verification.e2e.ts --config apps/web/tests/playwright.config.ts`

did not reach the device stage on its own `127.0.0.1:4317` Vite server. The
page shell served, but the client route mounted blank; the integrated browser
showed the same blank page on that fresh-server URL. The live shared dev server
at `http://localhost:3000/_spike/device` still rendered correctly.

That discrepancy lives in the route/app verification path, not inside the
device package. I recorded it as a blocker instead of claiming fresh flagged
Chrome captures that were not reproducible from this workspace state.

## VD-18 · Keep the repo-native procedural shell; replace the front-only assumptions around it

Inspection overturned the premise that the entire old device was a raster
composition. `Device.tsx` already had extruded front/back solids, a curved
front, a dished wheel, a raised Select, holes, recesses, and one orientation
group. Replacing that with an imported model would have discarded useful real
geometry and introduced provenance risk. The rebuild keeps the procedural
solid and removes the actual flatness sources: fixed camera, proxy panel,
manufactured optical maps, striped room, and duplicate LCD planes.

No third-party iPod mesh or texture ships. Pencil `VWaJS` and `zbTc3` remain the
layout authority and were read only through MCP. The NekoMod iPod Video model
(MIT) and iFixit 5G top-edge photography were mechanical references only; no
geometry, texture, or source was copied from either.

## VD-19 · Camera fit is solved from live bounds after orientation

The previous `1160` distance was a calibration number pretending to be a
responsive layout. The replacement runs after the model group's transform,
measures its world `Box3`, and solves distance from each corner's x/y/depth
requirements under the real perspective FOV. Safe margin is stated in CSS
pixels and converted to NDC separately for each viewport dimension. Debug
controls live outside the model frame and never enter the solve.

An explicit camera distance remains only as a calibration override. The default
preview, mobile, edge, rear, and custom orientations all use measured fit.

## VD-20 · Studio reflections are world-space PBR inputs, not UV paint

The environment is Three's `RoomEnvironment` filtered once through PMREM. Key
and kick are broad `RectAreaLight` emitters, siblings of the rotating model.
There is no `vUv` edge glow, camera/view-matrix band, additive outgoing-light
term, or pose-specific light. Black/white polycarbonate, wheel, clear cover,
and steel keep separate physical parameters and read differently under the same
room.

D-064 still governs acceptance: front/rear retain their canonical stop-table
role; rotated poses are judged on silhouette, continuity, occlusion, material
identity, and world-fixed highlights.

## VD-21 · One native-density LCD plane, with glass optically separate

The old route authored a separate fake LCD and the T1 source forced 2× at DPR1,
then placed a second optical overlay over it and spent a 12× transmission pass
looking through glass. The replacement mounts the real `Panel`, quantizes only
to exact 1×/2×/3× native LCD rasters, disables mipmaps, marks the texture sRGB,
and uses one screen plane. Linear filtering is retained because the perspective
projection commonly lands the screen between device pixels; nearest filtering
made that transform shimmer.

The cover glass remains separate geometry, but its material is reflective and
transparent rather than transmissive. It therefore catches the room without
resampling the DOM texture behind it.

## VD-22 · Edge controls are geometry and share the orientation root

The HOLD recess, orange indicator, slider, headphone rim, and jack well are
separate rounded/cylindrical solids on the top edge. They rotate with the same
model group and contribute to camera bounds. This is deliberately small detail,
but it makes the top/edge silhouette identifiable and prevents a future flip
interaction from exposing an empty generic slab.

## VD-23 · Composite changes are limited to screen integration and camera plumbing

The scoped cross-package changes are exactly:

- `packages/composite/src/html-in-canvas.ts` and its tests: native DPR raster,
  no duplicate overlay, no mipmaps, sRGB/linear filtering.
- `packages/composite/src/CompositeDevice.tsx`: forwards
  `cameraSafePadding` to `DeviceCanvas`.

No fallback or polyfill was added. T1 remains the main path as requested; T3/T4
remain a later workstream.

## VD-24 · Patch the installed physical-light chunk and fail closed on Three drift

The old polycarbonate patch was source-shaped evidence against an obsolete
Three diffuse line. Installed 0.185.1 no longer contains that expression, and
the studio softboxes enter through `RE_Direct_RectArea_Physical`, a second path
the patch did not touch. The visual result could therefore look acceptable
while none of the claimed transport executed.

The patch now expands and edits the installed
`ShaderChunk.lights_physical_pars_fragment` at compile time, adding bounded
transport to both ordinary direct lights and RectArea lights. It throws if the
known direct splice is absent, and separately throws if an installed RectArea
function no longer contains its splice. Tests consume the installed chunk and
the real flagged-Chrome shader compile closes the integration half.

## VD-25 · Acuity and native interaction share one HTMLTexture DOM tree

A hidden 2D raster canvas can make a sharp texture, but moving the panel under
that hidden canvas detaches native hit-testing and accessibility geometry from
the LCD. Duplicating or cloning the UI would restore pixels at the cost of a
second representation. Neither is acceptable.

The final path keeps one panel as a direct `layoutsubtree` child of the WebGL
canvas. Three `HTMLTexture` uploads it, and Three `InteractionManager` writes
the same element's CSS `matrix3d`. The 272×204 panel content is scaled once into
the canonical 320×240 authoring box before the browser snapshot; the texture is
sRGB, linear-filtered, and mipmap-free. Browser tests at DPR 1/2/3 measure the
rendered edge gradients, plant a 1px blur that fails the gate, compare semantic
DOM bounds to the projected screen, click-focus the real application, and run
keyboard navigation.

## VD-26 · Preview pose drag is modified so it cannot steal product input

The entire device orientation remains one group transform, but the preview
stage previously captured every primary pointer before the click wheel could
own it. Shift-drag now rotates the product model; ordinary pointer and touch
input remain product input. Arrow keys and the preview orientation API retain
keyboard, automation, accelerometer, and future flip seams without baking a
camera assumption into the model.

## VD-27 · The owner two-light rig is geometric, power-based, and explicit

The accepted scene uses exactly two authored direct emitters. The key sits
camera-right at a 28° viewer azimuth and descends 20° onto the device, inside
the owner's 15–25° range. Its 620×420 model-unit rectangle is the softness
control, and its 5.8M-lumen pre-exposure power is scaled by the rig's 0.96
linear exposure. The kick sits below the horizon at −14° and camera-left at
−18°, uses a 600×360 rectangle, and receives exactly 11% of the key's rendered
luminous power. Three's installed `RectAreaLight` relation
`power = intensity × width × height × π` is used to derive each intensity.

The restrained RoomEnvironment remains at 0.34 only to preserve material
identity between poses; it is not a third directional look. The model alone
rotates. Tests reconstruct the key angle from its Cartesian position, recover
both rendered powers from the mounted light props, and require the kick to stay
subordinate. The black Select material now uses a broad, low-energy dielectric
response rather than the former transmissive, low-roughness lens that produced
an isolated vertical hotspot.

## VD-28 · Corner continuity is a topology contract, not a material adjustment

The lower-corner pinch came from two structural discontinuities. The vertical
quadratic crown reached the top and bottom bevels with a non-zero first
derivative while its reported join normal was flat. The secondary sine edge
lobe also reached one boundary with a non-zero tangent, creating the visible
horizontal band. Neither defect belongs in roughness, exposure, or framing.

The shell now uses an even sixth-order C1 profile with zero value and tangent at
both joins. Its side-to-side counterpart is tessellated into the same cap and
the normals use the inverse transpose of both x and y derivatives. Optional
edge lobes use `sin²`; the production top and bottom lobes are zero. Tests cover
all four corners in every named orientation, reject degenerate production
triangles and duplicated-position normal splits, and verify the world-space
normal joins after rotation.

## VD-29 · The product-photo rig is one close softbox, one low strip, and negative fill

The owner correction supersedes VD-27's earlier 28°/20° placement. The final
named rig is:

- key: 45° viewer azimuth, 40° elevation/descent, 720 model-unit distance,
  520×380 emitter, 9,000,000 lm, warm-neutral `#FFF9F2`
- kick: −120° viewer azimuth and −10° elevation, 650 model-unit distance,
  85×300 vertical strip aimed at `[-110, -210, -20]`, 3% of key power,
  cool-neutral `#DCE7F2`
- linear exposure: 0.92
- PMREM RoomEnvironment intensity: 0.20, sigma 0.04

The key is therefore front-right-above, inside the required 35–45° elevation
and approximately 45° azimuth windows. The kick sits behind-left-below and
rakes the lower shell instead of acting as frontal fill. The opposite side is
left unfilled so black polycarbonate retains contrast.

The room is now the front materials' restrained scene environment. The old
striped calibration environment is assigned only to the mirror-steel rear,
where D-064's canonical stop-table calibration still requires it. This is the
architectural correction that removed the full-width front bands; changing
roughness would only have hidden the dead scene environment.

## VD-30 · The LCD aperture is physical geometry and matches the Pencil canonical slot

The active panel is fixed at 272×204 model units, exactly 4:3 and semantically
320×240. Against the 330px / 61.8mm body scale, that is 50.95×38.20mm—within
0.15mm and 0.10mm of the 50.8×38.1mm 2.5-inch reference. Its width is 82.42%
of the body and its height is 36.96%, matching the owner's measured target.

Pencil MCP inspection found the same canonical geometry: body `VWaJS` is
330×552, display well is 280×212, and active panel/screen slot/glass reference
is 272×204. There is therefore no conflict to escalate and no DOM scale was
changed.

The physical stack is now four explicit nested bounds: 272×204 active pixels,
274×206 thin black mask, 276×208 cover-glass lip, and 280×212 recess. The
screen mesh and HTMLTexture mapping remain 272×204, so raycasts, native DOM
geometry, and the 320×240 semantic source all share one aperture.

## VD-31 · Selection suppression belongs to the active wheel gesture only

The click wheel uses pointer capture and cancelable-event `preventDefault()`.
On arc start, a scoped controller snapshots the existing selection, marks only
the device interaction root, and prevents `selectstart` inside that root. A
selection caused during the gesture is restored to the snapshot rather than
clearing unrelated document selection. Pointer up, pointer cancel, lost
capture, window blur, unmount, and thrown arc callbacks all run the same
teardown.

The root keeps `touch-action: none` as the pre-gesture pointer-routing contract;
`user-select: none` exists only while the active gesture attribute is present.
Outside text remains selectable, and focus, keyboard input, live DOM screen
geometry, button presses, and assistive semantics remain unchanged.

## VD-32 · Every front insert resolves from the crowned shell frame

The first corner repair changed the shell's front surface but continued to
place the display, glass, wheel, Select and invisible input annulus from the
old planar `frontFaceZ`. That made the shell coherent in isolation while its
siblings occupied a different depth frame.

`front-surface.ts` is now the one resolver for the crowned shell offset and
every front assembly depth. Rectangular inserts use the minimum shell offset
sampled around their aperture; the wheel uses the minimum around all 256
sampled opening points. The insert stack therefore remains recessed without
intersecting the shell at corners or rotated poses. The production crown is a
subtle 1.2 model units in each axis, and tests reject the former 6.2-unit value
as a second chassis depth.

## VD-33 · Explicit PMREM maps preserve authored material gain

Installed Three 0.185.1 assigns `scene.environmentIntensity` whenever a
material inherits `scene.environment`; it does not retain that material's
`envMapIntensity`. Letting front materials inherit the room therefore collapsed
all of their different gains to 0.20. Multiplying those authored gains by 0.20
would apply the scene level a second time and crush black and glass instead.

`StudioEnvironment` now publishes the generated PMREM texture to consumers in
the same R3F scene. Front materials receive that texture explicitly and keep
their authored response; a material without an authored gain falls back to the
scene value. The steel rear alone keeps the calibrated mirror-room map. Tests
consume the installed renderer source, prove the null-map override exists, and
lock the explicit black, white and glass gains at 0.008, 0.0024 and 0.16.

## VD-34 · Gesture callback failure is a terminal cancellation path

Pointer capture and listeners are installed before an arc-start callback and
remain active during arc-move callbacks. Either callback may throw; cleanup
must therefore happen before the original error escapes. The production
surface now routes both failure sites through the same cancellation path used
by pointer cancel, blur and unmount, releases capture, removes listeners, and
swallows only a secondary end-callback failure so the first error remains the
one reported.

The browser proof is no longer terminal-state-only. It observes the active
gesture marker, a real touch detent, touch cancellation and a subsequent mouse
gesture. It also performs native mouse selection on text outside the device
instead of constructing a Range programmatically. The evidence summary records
the exact reviewed commit and tree.
