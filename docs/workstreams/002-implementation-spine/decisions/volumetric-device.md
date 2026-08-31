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
