# True-3D device evidence — September 1, 2026

## Outcome

`/_spike/device` renders the repo-native procedural iPod as one coherent R3F
model under a PMREM `RoomEnvironment` and two broad world-fixed softboxes. The
route uses the real HTML-in-canvas `Panel`, not the previous painted proxy.

Flagged Chrome route:

`http://localhost:3000/_spike/device`

## Browser proof

Command:

```sh
bunx playwright test --config apps/web/tests/playwright.config.ts apps/web/tests/volumetric-device-verification.e2e.ts --reporter=line
```

Result: 1 passed. The test enables `CanvasDrawElement`, verifies T1 reaches
`painted`, exercises the real DOM panel by keyboard, and captures:

- `volumetric-device-true3d/true3d-front-black.png`
- `volumetric-device-true3d/true3d-front-white.png`
- `volumetric-device-true3d/true3d-quarter-black.png`
- `volumetric-device-true3d/true3d-edge-white.png`
- `volumetric-device-true3d/true3d-rear-steel.png`
- `volumetric-device-true3d/true3d-top-controls.png`
- `volumetric-device-true3d/true3d-mobile-375x812.png`

`volumetric-device-true3d/summary.json` contains the source fingerprint, image
hashes, measured camera distances, projected extents, and safe-area limits.
Every measured extent is at or below its limit. Required DPR results:

| DPR | LCD raster | WebGL backing store at 430×932 |
| --- | --- | --- |
| 1 | 320×240 | 430×932 |
| 2 | 640×480 | 860×1864 |
| 3 | 960×720 | 1290×2796 |

All have mipmaps disabled and use sRGB texture data.

## Automated proof

- `camera-fit.test.ts`: 375×812, 430×932, and 1024×768 across front,
  three-quarter, edge, and rear; a planted 0.82× camera distance escapes the
  safe area and makes the gate fail.
- `StudioEnvironment.test.ts`: requires RoomEnvironment, PMREM, ownership
  cleanup, and rejects view/UV/additive-light hooks.
- `physical-continuity.test.ts`: requires solid/crowned/rounded/cylindrical
  live geometry and rejects the old optical-profile consumption and view-locked
  shader escape.
- `html-in-canvas.test.ts`: exact native 1×/2×/3× source grids, no mipmaps,
  correct color space, and no second overlay plane.
- existing curved-shell tests retain manifold, smooth, thickness-preserving
  tessellation and finite continuous normals.

Full command chain:

```sh
bun run typecheck
bun run lint
bun run test
bun run build
bun run gates
```

Results: 11/11 TypeScript projects; lint clean; 989 tests passed; client and SSR
builds complete; 16 automated gates passed, 0 failed. Manual U14/U15 remain.

## Asset and environment provenance

- Model: repo-native procedural Three geometry in `packages/device`; no external
  mesh, texture, or model file imported.
- Authored proportions/layout: encrypted `design.pen`, Pencil MCP components
  `VWaJS` (front) and `zbTc3` (rear).
- Environment implementation: Three.js `RoomEnvironment` and `PMREMGenerator`
  from the installed `three@0.185.1` dependency (MIT).
- Mechanical references only: iFixit iPod 5th Generation top-edge photography;
  NekoMod/iPod-Video-3D-Model (MIT). Nothing copied or redistributed.
- LCD source: existing repo-owned HTML `Panel` through the Chrome
  `CanvasDrawElement` T1 implementation.

## Scoped cross-package changes

`packages/composite` was touched only to keep the LCD on a single native-density
texture plane and to forward camera safe padding. No fallback/polyfill was
implemented.
