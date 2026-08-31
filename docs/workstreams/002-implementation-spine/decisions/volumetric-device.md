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
