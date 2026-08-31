# Diary — volumetric device

Status on August 31, 2026: the volumetric slice is implemented in the shared
workspace, the two review-blocking probe regressions are fixed, and the fresh
Chrome evidence and command logs are ready to commit as a focused follow-up.

## What moved

The device is no longer a front-only slab with a textured illusion of depth.
`packages/device` now owns one orientation model, real front and rear surface
layouts derived from Pencil components `VWaJS` and `zbTc3`, a recessed display
well, a recessed wheel well, a raised Select button, a visible rear steel shell
with inlay, and one pose-aware lighting path that keeps the lamps world-fixed
while the model rotates beneath them.

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

The in-app browser remains a useful contrast check: on this machine it lands on
T3 for the composite route, so the T1-only page looks blank there. That is a
runtime fact, not an implementation failure, and it matches the current
“main-path first, fallbacks later” scope.

The stricter re-review found a second, more useful miss in my own proof path.
Naming the visible steel shell was necessary, but not sufficient: my first edge
probe rework still sampled the chassis at the front/back split plane (`z = 0`),
which means the rendered pixel can legitimately belong to the rear steel plate
at a perfect 90° turn. The correct verifier is the front-half seam band that is
actually visible in the edge pose, so the edge targets now sample inside that
front-half depth instead of on the split proxy.

The rear probe needed the same kind of honesty. The rendered rear pixel is the
double-sided back-composition plane, not the bare steel plate behind it. The
route now requires that visible composition first and the steel backing second.
That makes the proof about the rendered stack we ship instead of about a hidden
material the camera never sees directly.

## Verification state

Owned package/app verification is green:

- `bunx tsc -p packages/device`
- `bunx tsc -p packages/composite`
- `bunx tsc -p apps/web`
- `bun test packages/device packages/composite`
- responsive Playwright matrix: 17 passed
- `bun run lint`
- `bun run build`
- `bun run gates`

Fresh flagged-Chrome proof is also back in place:

- `evidence/volumetric-device-browser/summary.json` now records all four
  composite poses at T1 with `requestPaint: true`, one composite host, one
  canvas, zero page errors, and keyboard continuity in front, three-quarter,
  edge, and rear poses.
- The exact reviewer repro cases now return readings instead of throwing:
  `edge-white` resolves `probeFace: "right"` with three edge-shell readings,
  and `rear-white` resolves `probeFace: "back"` with eleven rear readings.
- `evidence/volumetric-device-density.txt` re-measures the T1 composite at DPR
  1/2/3 with exact 330×552, 660×1104, and 990×1656 WebGL backing stores and
  matching 320×240, 640×480, and 960×720 LCD source rasters.
- `evidence/volumetric-device-acuity.txt` re-measures LCD edge acuity at DPR
  1/2/3: P95 19.79, 31.77, and 37.63, each above the gate floors.

The raw logs and screenshots are in the `volumetric-device-*` evidence files.
What remains manual is unchanged: U14 thumb occlusion and U15 unsupported
controls absent on the real object.
