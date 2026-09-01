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
