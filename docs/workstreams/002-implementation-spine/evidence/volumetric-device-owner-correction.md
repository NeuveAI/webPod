# Volumetric device owner-correction evidence

Date: Tuesday, September 1, 2026  
Route: `http://localhost:3000/_spike/device`

## Implemented corrections

- Shell: C1-continuous sixth-order vertical and horizontal crown, inverse-
  transpose normals, no production secondary edge lobe.
- Lighting: world-space 45° azimuth / 40° elevation close key, subordinate
  behind-left low strip, restrained PMREM room, negative fill preserved.
- LCD: 272×204 active aperture with separate 274×206 mask, 276×208 glass lip,
  and 280×212 recess; semantic source remains 320×240.
- Wheel: pointer capture, cancelable-event default prevention, gesture-scoped
  selection containment, and complete cancellation/unmount cleanup.

## Measured geometry

The physical scale remains `330 / 61.8 = 5.3398 px/mm`.

| Quantity | Model | Physical / ratio |
|---|---:|---:|
| Body | 330×552 | 61.8×103.38mm |
| Active LCD | 272×204 | 50.95×38.20mm |
| Active/body | — | 82.42% wide, 36.96% high |
| Semantic LCD | 320×240 | exact 4:3 |
| Mask | 274×206 | 1px per side |
| Cover glass | 276×208 | 2px per side |
| Display recess | 280×212 | 4px per side |

Pencil MCP reported body `VWaJS` 330×552, Display Well 280×212, and canonical
active panel/screen geometry 272×204. No `design.pen` file content was read
directly. The measured model is within the committed 0.2mm tolerance of the
owner's 50.8×38.1mm reference.

Reference context supplied by the owner:

- Apple 2.5-inch 320×240 display specification:
  <https://support.apple.com/en-us/112321>
- EveryMac 5G/5.5G QVGA specification:
  <https://everymac.com/systems/apple/ipod/specs/ipod-5th-generation-enhanced-specs.html>
- iFixit 5G photography:
  <https://www.ifixit.com/Wiki/iPod_5th_Generation_%28Video%29_Troubleshooting>
- Retrospekt 5G product photography:
  <https://retrospekt.com/products/apple-ipod-5th-generation-mp3-player>

No third-party model, texture, HDRI, or photographic asset is shipped. The
model remains repo-native procedural geometry. The environment is Three.js
`RoomEnvironment` filtered by `PMREMGenerator`.

## Named photographic rig

| Parameter | Value |
|---|---:|
| Key azimuth | 45° front-right from viewer +z |
| Key elevation/descent | 40° (required 35–45°) |
| Key distance | 720 model units |
| Key emitter | 520×380 model units |
| Key power | 9,000,000 lm |
| Kick azimuth/elevation | −120° / −10° |
| Kick distance | 650 model units |
| Kick emitter | 85×300 vertical strip |
| Kick aim | `[-110, -210, -20]` |
| Kick/key power ratio | 0.03 |
| Linear exposure | 0.92 |
| PMREM intensity / sigma | 0.20 / 0.04 |

Tests reconstruct key elevation and azimuth from the mounted Cartesian
position, recover each light's luminous power, require the kick to remain
subordinate and below/behind, and assert that only the steel rear may consume
the legacy calibrated environment. Source scans reject camera/view matrices,
UV lighting, and additive outgoing-light hooks.

## Deterministic plants

- Restoring the quadratic crown produced a 0.16536-radian rotated join-normal
  discontinuity and failed the corner gate.
- Restoring non-zero production edge lobes reintroduced the join slope/band and
  failed exact form and tangent tests.
- Moving the key back to 20° fails the 35–45° geometric window; moving it to a
  90° side-grazing azimuth fails the 40–50° azimuth window.
- Allowing a front material to set `envMap={env}` fails the environment-owner
  test; exactly one such assignment is permitted and it is the steel rear.
- Changing active LCD width/height, 4:3, physical tolerance, or any nested
  mask/glass/recess bound fails the layout contract.
- Removing pointer-cancel, blur, or scoped selection teardown fails the mounted
  interaction suite; real browser mouse/touch proof also verifies zero ranges.

## Verification

```text
bun run typecheck                     11/11 clean
bun run lint                          exit 0
bun test                              1,006 pass, 0 fail, 50,930 expects
bun run build                         exit 0
bun run gates                         16 automated pass, 0 fail
bunx playwright ... volumetric...     1 pass, 0 page errors
bunx playwright ... lcd-acuity...     3 pass
```

The production build retains one pre-existing Vite chunk-size warning; it is
not a rendering or correctness failure. U14 thumb occlusion and U15 unsupported
controls remain manual by repo gate definition.

The browser summary is
[`volumetric-device-owner-correction/summary.json`](./volumetric-device-owner-correction/summary.json).
It records immutable source commit
`4564973e10a655c4684189492afcdfaae042ca58`, tree
`8fc7834ee389e60d1cfe1393c57e2980409de642`, a source-health match, every pose's fitted projected bounds, a
375×812 mobile fit (`extentX 0.818667 ≤ limitX 0.818667`), exact DPR rasters,
and no page errors.

## Independent review corrections

- The front shell, screen stack, click wheel, Select and interaction annulus now
  resolve their z positions from one crowned-surface frame. Rectangular and
  circular perimeter sampling proves no insert pierces the shell.
- The generated RoomEnvironment PMREM is explicit on front materials, so
  installed Three cannot replace black/white/glass gains with the scene-level
  0.20 value. The steel rear remains the only legacy calibrated-map consumer.
- Thrown arc-start and arc-move callbacks cancel capture and listeners before
  rethrowing; planted failures prove a following gesture still works.
- The browser test observes active touch state and a real detent before cancel,
  then performs native mouse selection outside the device and proves wheel
  activity preserves that external selection.

## Captures

- `correction-room-front-black.png`
- `correction-room-front-white.png`
- `correction-room-quarter-black.png`
- `correction-room-edge-black.png`
- `correction-room-rear-steel.png`
- `correction-room-mobile-375x812.png`
- `correction-room-screen-close-black.png`
- `correction-room-screen-close-white.png`
- `correction-room-corner-left-neutral.png`
- `correction-room-corner-right-neutral.png`
- `correction-room-corner-left-beauty.png`
- `correction-room-corner-right-beauty.png`
- `correction-room-neutral-front.png`
- `correction-room-top-controls.png`

The neutral close crops expose geometry without reflective camouflage. Beauty
crops use the shipping rig. All four are free of the rejected corner pinch or
horizontal overlay seam. Front screen crops retain sharp native panel edges;
the active aperture is larger because its real 272×204 geometry is now visible
inside only a thin mask and glass lip.
