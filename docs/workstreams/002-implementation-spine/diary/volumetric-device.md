# Diary — volumetric device

Status on August 31, 2026: the volumetric slice is implemented in the shared
workspace, the canonical white-front / black-front / steel-rear references now
pass the W4 ±4 contract in shipped defaults, and the rotated-pose proof has
been rewritten around D-064's canonical-vs-physical split.

## What moved

The device is no longer a front-only slab with a textured illusion of depth.
`packages/device` now owns one orientation model, real front and rear surface
layouts derived from Pencil components `VWaJS` and `zbTc3`, a recessed display
well, a recessed wheel well, a raised Select button, a visible rear steel shell
with inlay, and one pose-aware lighting path that keeps the lamps world-fixed
while the model rotates beneath them.

The shell/material stack also moved from "passing rig state exists somewhere" to
"the shipped source defaults reproduce that state." The decisive fixes were:

- fixing `packages/device/calibration/apply-rig.ts` so it patches a whole
  material block instead of repeatedly splicing stale string offsets and
  silently skipping later fields
- syncing the tuned `envRoom.stopExposure` array rather than leaving the room
  file partially stale
- keying the black/white Select materials separately so the black-only
  transmissive inputs cannot leak into the white colourway after a toggle
- giving the black Select cap a real thickness profile and attenuation path
  instead of a fake painted highlight

`packages/composite` keeps the T1 `html-in-canvas` path as the main route, but
the panel raster is now authored into a 320×240 source before Three uploads it,
and the canvas DPR seam is closed by passing the resolved numeric DPR through
R3F rather than letting it collapse back to the lower bound.

The two diagnostic routes stayed the proving ground:

- `/_spike/device` for the real volumetric mesh, physical materials, and
  pointer/keyboard pose validation
- `/_probe/composite` for the T1 DOM-in-canvas path, responsive fit, and sharp
  LCD output

## What I used

I followed the required guidance stack in order:

- `modern-web-guidance` first, specifically the browser-facing guidance around
  `requestPaint`, `layoutsubtree`, `getElementTransform`, and DPR-aware raster
  sizing
- `interface-craft`, `interface-design-guardrails`, `web-design-guidelines`,
  `global-patterns`, `vercel-react-best-practices`, and `runtime-review`

I grounded Three/R3F in the local `~/code/agentic-context` clone and read the
Pencil file only through MCP, using `VWaJS` for the front body and `zbTc3` for
the rear shell composition.

## What bit me

The first front-pose composite screenshot I generated was blank. The render was
fine; my capture was too early. The responsive T1 suite already proved the path,
and a direct front-pose poll showed the host attached, `requestPaint` present,
and the canvas sized correctly. I reworked the capture to wait for the panel
host instead of treating the first blank image as a product regression.

The more important miss was in my own acceptance story. Before D-064 landed in
code, the W8 evidence still read as though one luminance table could grade the
whole orientation space. That was the wrong mental model. The browser proof now
spends one test proving the split explicitly:

- front and rear are canonical stop-table poses and must sample green
- three-quarter, edge, and custom poses must reject `sample()` with the D-064
  message and be validated by physical continuity instead

The stricter re-review also exposed two honesty bugs in the verifier itself,
both now fixed:

- the edge probe must sample the visible front-half shell band, not the
  front/back split plane at `z = 0`
- the rear probe must classify the rendered back-composition plane first and
  require steel behind it, because that is the actual visible stack

One thing remains visibly rough by design: the LCD content inside
`/_spike/device` is still a diagnostic proxy. The shell now reads materially and
volumetrically like the intended object; the proxy UI is not the panel-fidelity
acceptance surface for this slice.

## Verification state

Owned package/app verification is green, and the numbers are now the final ones
for this tree:

- `bunx tsc -p packages/device`
- `bunx tsc -p packages/composite`
- `bunx tsc -p apps/web`
- `bun test`
- `apps/web/tests/volumetric-device-verification.e2e.ts`
- responsive Playwright matrix: 17 passed
- `bun run lint`
- `bun run build`
- `bun run gates`

Fresh flagged-Chrome proof is also back in place:

- `evidence/volumetric-device-browser/summary.json` records the three canonical
  samples now green in shipped defaults: black front, white front, and steel
  rear.
- The same summary records the rotated proof boundary explicitly:
  three-quarter, edge, and custom poses reject canonical sampling with the
  D-064 message instead of being silently graded against the wrong tables.
- The animated continuity run records five custom orientations, zero page
  errors, and a front → right → back transition in the visible/probe face as
  the device flips.
- `evidence/volumetric-device-responsive.txt` re-runs the mobile/desktop,
  resize, and DPR matrix against this exact tree.

The raw logs and screenshots are in the `volumetric-device-*` evidence files.
What remains manual is unchanged: U14 thumb occlusion and U15 unsupported
controls absent on the real object.

## Tuesday, September 1, 2026 — physical-lighting repair addendum

I stayed inside `packages/device/**` and the W8 device paperwork only. No route,
panel, composite, token, history, or cert edits.

What I changed in the device package:

- kept the cover glass on Three's own transmission path with no additive UV-edge
  light
- kept the white shell on the same direct-light polycarbonate transport path as
  black, then retuned the light rig and front materials toward quieter studio
  product lighting
- pushed `DEVICE_TRANSMISSION_RESOLUTION_SCALE` to `12` so the LCD seen through
  the cover stays as sharp as the current route can honestly show
- made the white wheel ring materially subordinate to the pearl body again
  instead of reading glossier than the shell

What I checked live:

- earlier in this same session `http://localhost:3000/_spike/device` rendered
  visibly enough to confirm the fake glass lift was gone and the wheel/select
  recess read more clearly than the rejected pass
- after the final crown/material retune, fresh integrated-browser reloads no
  longer produced a mounted stage, so I am not claiming a new final screenshot
  for this exact tree
- final owner aesthetic acceptance is still open

What blocked the wider proof:

- the fresh Playwright verifier path on `http://127.0.0.1:4317/_spike/device?capture`
  mounted a blank page in both Playwright and the integrated browser, and later
  reloads of the shared `3000` route also returned an empty body. That
  route/app surface is outside this ownership boundary, so I recorded it
  instead of patching around it from W8.
- repo-wide lint stayed red outside this slice:
  `apps/web/src/routes/[_]probe.composite.tsx` has a
  `react-hooks/exhaustive-deps` warning and
  `apps/web/tests/lcd-acuity.e2e.ts` has an unused `Browser` import error.
- repo-wide `bun test` / `bun run gates` also stayed red in `scripts/gates.test.ts`
  fixture setup (`git`/temp-fixture `ENOENT`, fixture commit exit `143`) on this
  shared workspace session, so I did not claim a green full-suite result I did
  not have.

## Tuesday, September 1, 2026 — true-3D rebuild

The owner rejected the prior preview as flat, clipped, shimmery, and blurry.
That criticism held up under inspection. The route used a fixed camera distance
and a hand-painted LCD proxy; the compositing path rendered the panel above its
native density, put a second optical plane over the screen, and then viewed it
through a 12× transmission buffer. The body also consumed manufactured optical
normal/roughness profiles whose bands only made sense from the canonical front.

The replacement keeps the existing repo-native procedural shell, because it is
already real topology rather than a raster prop, and removes the front-pose
illusions around it:

- `DeviceCanvas` measures the rotated `device-model` group with `Box3` and fits
  a perspective camera from all eight bound corners and CSS-pixel safe margins.
- `StudioEnvironment` converts Three's `RoomEnvironment` once through PMREM;
  two broad world-fixed `RectAreaLight` softboxes reveal the volume while the
  one device root rotates beneath them.
- the front and rear shells, seam, display recess, wheel recess, dished wheel,
  raised Select, cover glass, rear composition, HOLD control, and headphone jack
  are separate bounded meshes with actual depth and occlusion.
- the live `Device` no longer imports or consumes the old optical-profile maps.
  Curvature and continuous normals come from its tessellated/extruded geometry.
- `/_spike/device` now mounts `CompositeDevice` with the real DOM `Panel`; it no
  longer paints a diagnostic UI into a `CanvasTexture`.
- the HTML-in-canvas source uses exactly 320×240, 640×480, or 960×720 at DPR
  1/2/3, no mipmaps, sRGB, and one linear-sampled screen plane. The cover glass
  is a separate reflective transparent sheet with no refractive resampling.

The flagged-Chrome proof is fresh and reproducible. It captured black and white
fronts, a black three-quarter pose, white edge, steel rear, a top-control pose,
and 375×812 mobile. Every pose's *measured live model bounds* projects inside
the requested safe area. The mobile case is width-limited and centered; it no
longer inherits a desktop aspect box. The panel remains real DOM and responds
to keyboard navigation after being composited.

All wider gates that the earlier addendum reported blocked are green on this
tree: 11/11 TypeScript projects, repo lint, 991 tests, production build, and 16
automated static gates. U14 and U15 remain correctly manual. The browser route
is `http://localhost:3000/_spike/device`; the default is an uncluttered black
three-quarter pose, with drag/keyboard rotation and external controls.

The evidence is in `evidence/volumetric-device-true3d/`. The earlier
transmission-12 and proxy-LCD notes above are historical failure records, not
the current architecture.

## Tuesday, September 1, 2026 — strict-audit corrections

Two implementation defects survived the first visual pass and were found by
testing the mechanism instead of accepting the screenshot.

First, the polycarbonate transport patch still searched for a physical-light
line removed before installed Three 0.185.1, and it only knew the ordinary
direct-light function while the studio uses `RectAreaLight`. The material
therefore looked plausible while the intended bounded transport was dead. The
repair patches the installed `ShaderChunk.lights_physical_pars_fragment`, covers
both ordinary and area-light functions, and throws if either known splice point
changes. The flagged browser compile is clean and the test consumes the
installed chunk rather than a hand-written surrogate.

Second, the first acuity repair made a sharp `CanvasTexture` by moving the live
panel below a hidden raster canvas. That fixed pixels but broke the standing
native-interaction thesis: the semantic panel no longer shared the projected
LCD geometry. A nested-canvas experiment restored paint but applied geometry
twice. The final path returns to Three's native `HTMLTexture` and
`InteractionManager`: one live panel is the direct `layoutsubtree` child, its
320×240 authoring box maps to the 272×204 LCD mesh, and the same element receives
the per-pose `matrix3d`. It has no mipmaps, is sRGB, and uses linear filtering
for fractional perspective samples. The DPR 1/2/3 browser gradient gate passes,
and DOM bounds match the projected screen to under 2px.

Preview rotation now requires Shift-drag. Plain pointer and touch input remain
available to the product click wheel; arrow/Home/End controls and the external
orientation API still exercise the stable whole-model transform. During the
proof, the immutable-source health endpoint also exposed a null-coalescing bug
that serialized an absent reviewed commit as an empty string. The Vite test
health endpoint now preserves an explicit metadata `null`; this was a verifier
repair, not a rendering change.

## Tuesday, September 1, 2026 — owner two-light direction

The owner's next-preview ruling replaced the inherited top-centre/fill values
with a disciplined photographic rig. The first pass moved the key to
camera-right at the required 20° descent and softened the old Select hotspot,
but the rendered lower source still read as a band and the black front remained
compressed. The second pass made the key larger and closer, reduced the kick
from 18% to 11% of key power, broadened both emitters, restrained the PMREM room
to 0.34, and brought the Select into the wheel's rough dielectric family.

The rendered result has no blown centre-button stripe. The wide key describes
the top crown and moves to the right rolled edge in the three-quarter pose; the
lower source remains visible at the shell separation without lifting the whole
black face. Black/white front, black three-quarter, black edge, rear, top, and
375×812 mobile are captured from the same two world-fixed lights. The browser
test still proves mobile containment and exact 1×/2×/3× LCD source grids.

## Tuesday, September 1, 2026 — owner geometry, lighting, LCD, and wheel corrections

I began with neutral diagnostic light rather than the beauty materials. That
made the lower-corner defect reproducible on both sides and separated it from
the white-shell reflection. The first plant restored the quadratic crown and
measured a 0.16536-radian rotated join-normal error. A second plant showed the
old edge sine reached its join with a non-zero derivative. Replacing both
profiles and adding x-crown tessellation removed the pinch in neutral and
beauty close crops without changing camera framing or roughness.

The first beauty render after that repair still carried horizontal bands. The
unexpected cause was architectural: every front material explicitly supplied
the legacy striped calibration environment, so the new RoomEnvironment was
mostly dead. Material tuning briefly appeared to improve the screenshot, but
it did not explain the mechanism. I reverted those values, allowed front
materials to inherit the PMREM scene environment, and retained the custom map
only on the calibrated steel rear. That removed the front band while preserving
the original body material values.

The final product-photo rig uses a close 520×380 key at 45°/40° and a narrow
behind-left low strip at 3% power. The fresh front, three-quarter, and edge
captures show the highlight moving over real normals. The center button no
longer carries an isolated blown stripe, and the lower shell separates without
an under-light band or lifted black face.

For the LCD, the owner's physical calculation and Pencil MCP agreed. The
272×204 canonical slot is 50.95×38.20mm at the existing body scale. I left the
HTML source and screen mesh unchanged, then made the mask, glass lip, and recess
separate thin bounds around it. Browser evidence still reports native
320×240, 640×480, and 960×720 raster grids at DPR 1/2/3, with DOM and projected
mesh alignment under 2px.

The wheel-selection browser proof initially tried to synthesize pointer events
inside the page. That did not exercise Chromium's real pointer capture or touch
default-action path. The final test uses Playwright mouse input and a CDP touch
start/move/cancel sequence, verifies detents still move the highlighted row,
observes zero Selection ranges, and confirms ordinary outside text remains
selectable afterward.

I wrote the final screenshots to a new evidence directory instead of reusing
the older `volumetric-device-correction` paths. This avoids the stale-image
failure mode that had made an earlier browser pass look like a lighting
regression after the source had already changed.

## Tuesday, September 1, 2026 — independent review corrections

The geometry reviewer reproduced an installed-renderer behavior the source
tests had missed: Three replaces a material's environment gain with the scene
gain when `envMap` is null. The screenshots were real, but the per-material
response we said they represented was not. The fix publishes the PMREM texture
per scene and binds it explicitly to front materials, with tests against the
installed renderer source. The same review then found the larger structural
miss: the shell crown moved but all front inserts stayed in the planar frame.
Those parts now resolve from one sampled crowned-surface contract.

The interaction reviewer found that the selection teardown itself was sound,
but a thrown start or move callback could strand capture around it. Both throw
sites now cancel before rethrowing, and planted callback failures prove the
next gesture remains usable. The browser evidence was also strengthened from
synthetic/programmatic end states to an observed active touch gesture, real
detent, cancellation recovery, and real mouse selection outside the device.

The geometry re-review then planted the old 6.2 crown through the public form
input and found one remaining sibling escape: the visible wheel moved while
the ray plane still read default depths. The canvas context now carries that
same injected form, and a mounted plant proves both surfaces move together.

The final immutable browser run reviews commit `325e8e4eb8c070372b79ae7f12c59ae4eadc7244`
and tree `2e67be51dc95456029aa2a88fc4ca5f3df8ebaa5`. The full repository sweep is
11/11 TypeScript projects, lint clean, 1,007 tests and 50,936 expectations,
production build clean apart from the existing chunk warning, and 16 automated
gates passing. The separate LCD suite remains 3/3 at DPR 1/2/3.

## Tuesday, September 1, 2026 — physical iPod 5G geometry specialist pass

The owner's front and exact-edge captures made the remaining defect class
unambiguous. This was no longer a material-tuning problem: the front had
stylised Pencil proportions, the Select had no physical rise, the front bevel
expanded beyond the enclosure plan, and the rear and front were independently
extruded solids. At exact edge they could only read as two slabs.

I selected one physical target before changing a number: the thin 30GB A1136,
103.5 × 61.8 × 11mm. Apple front photography supplied normalized screen,
wheel, centre, and Select ratios. iFixit established the separated plastic and
formed-steel assembly; iMods established that thin and thick backplates are
incompatible; MobileTechReview supplied the contemporary side silhouette and
thin envelope; Retrospekt was a secondary multi-angle check. Pencil MCP kept
the 330 × 552 body, 26px corner, and exact 272 × 204 LCD, but the owner's
explicit real-product correction superseded its 230px stylised wheel.

The front chain now closes exactly: 24px forehead, 204px LCD, 59px gap, 206px
wheel, 59px lower margin. The wheel shrank from 230 to 206px, moved to the
photo-measured centre, and its separate 74px Select was initially modelled
approximately 1mm proud; that last assumption is superseded by the owner
correction below.
The display trim is a thin nested physical stack rather than a second bezel.
The live DOM mesh itself remains 272 × 204 and maps 320 × 240 without a second
raster step.

The shell repair was more structural. `productShellDepths()` now supplies one
axial handoff. The rear is one indexed, normal-smoothed tray with eleven
matched rounded-rectangle rings expanding from its inset rear face to the
seam. The front starts at that same plane. The front's Three bevel is
pre-compensated; this removed the 334.6-versus-330 lower-corner overshoot.
Finally, shell crown displacement is zero at the rear handoff and grows only
toward the face, so a planar steel seam is not asked to meet a wavy plastic
boundary.

The missing evidence is recorded rather than hidden. Public material did not
provide an exact dimensioned front/rear depth split or Select offset. The
current 2.6mm / 1.6mm profile values are photo-derived and the owner was asked
for caliper or macro-profile references if tighter fidelity is wanted.

The final Chrome run exercised CanvasDrawElement, native DOM interaction, DPR
1/2/3, mobile fit, wheel selection suppression, and beauty plus neutral
all-angle captures. Neutral exact-edge views now show one tapered rear tray,
one thin plastic front, and one intentional seam; the front button visibly
projected in quarter, top, and bottom views before the owner correction below.
Six independent mutation plants reintroduced the owner's defects and each went
red.

## Tuesday, September 1, 2026 — owner Select, rear-roll, and decal correction

The owner corrected the one profile inference the public sources had not
settled: Select is not raised. I deleted the dome geometry, proud wall,
calibration parameters, and radial thickness map rather than tuning their
appearance. The replacement is a closed flat part 0.3mm below the ring's inner
edge, separated by the existing 4-unit Select lip. The first neutral front
render found that the ring still overlapped the Select by one unit; switching
the annulus to `selectLipR` made the seam real and visible.

The rear correction was not more bevel subdivision. A smootherstep profile had
the wrong endpoint tangent and produced the owner's wedge at the rear cap. The
new 48-section quarter ellipse leaves the stamped plate in-plane, rolls around
the perimeter, and arrives parallel to the side wall. Neutral left/right edge,
top, bottom, rear, and rear-three-quarter views show no pointed lip or corner
slope break.

The wheel marks are now deterministic vector decals. Apple's physical front
image sets the 20×13 skip boxes after scale; Pencil MCP confirms a discrete
play mark, pause bars, and visible space between them. MENU is unchanged. A
flush Select, linear rear wedge, zero play/pause gap, and 13-unit skip box were
each planted and all failed their owning tests.

## Tuesday, September 1, 2026 — research-first wheel assembly correction

The owner's process correction changed the order of work. Before touching a
geometry or material value, I assembled a six-cell source sheet and ledger
covering Apple official fronts, contemporary white and black hardware,
iFixit's detached wheel/button, a stated 30GB side/rear, and explicit
aftermarket/refurbished exclusions. Pencil was read only through MCP. The
source sheet existed before this code diff; it is not an after-the-fact mood
board.

That evidence overturned two values from the prior pass. The 4-unit Select
opening produced a decorative annulus where every OEM source shows only a
hairline assembly seam, and the 4.25-unit wheel inset produced a shadow moat
where independent shallow obliques show a near-flush stack. Production now
uses a 1-unit Select seam, 1-unit wheel inset and 0.5-unit Select recess. These
are model-space targets inside image-derived upper bounds, not invented OEM
millimetres. Exact depth remains open pending a calibrated macro profile.

The materials now encode two assemblies rather than a black/white inversion:
black charcoal wheel + darker Select + pale ink; white cool pale-gray wheel +
warmer white Select + medium cool-gray ink. A capture-only production-surface
route let the unflagged browser render the real geometry/material stack without
touching HTML-in-canvas. The evidence board places external reference, prior
render and corrected render side by side for black, white and neutral oblique
views.
