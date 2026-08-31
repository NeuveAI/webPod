# Evidence — volumetric device verification

This note records the verification run for the volumetric device slice on
August 31, 2026.

## Browser artifacts

Pose captures from flagged Chrome T1 live in
`evidence/volumetric-device-browser/`:

- `composite-front.png`
- `composite-three-quarter.png`
- `composite-edge.png`
- `composite-rear.png`
- `device-front-white.png`
- `device-quarter-black.png`
- `device-edge-black.png`
- `device-rear-white.png`
- `summary.json`

`summary.json` records the exact browser facts behind those screenshots:

- composite front/three-quarter/edge/rear all resolved `tier: "T1"`
- all four composite poses recorded `requestPaint: true`
- all four composite poses attached exactly one `.wp-composite-panel-host`
- the mobile composite pass at 390×844 had `scrollWidth === clientWidth === 390`
  and a centered 330×552 device frame at `x = 30`

Responsive screenshots from the Playwright matrix live in
`evidence/volumetric-device-responsive/`:

- `composite-320x568.png`
- `composite-375x667.png`
- `composite-390x844.png`
- `composite-desktop-1440x900.png`
- `device-320x568.png`
- `device-375x667.png`
- `device-390x844.png`
- `device-desktop-1440x900.png`

## Command results

Responsive Playwright matrix:

- command log: `evidence/volumetric-device-responsive.txt`
- result: 17 passed
- coverage:
  - composite centered/contained at 320×568, 375×667, 390×844, 430×932
  - standalone device centered/contained at the same mobile sizes
  - standalone device LCD and WebGL backing stores at DPR 1/2/3
  - composite refit after mobile-height changes
  - bare panel authored-raster preservation
  - screenshot capture at mobile and desktop viewports

Repo gates:

- command log: `evidence/volumetric-device-gates.txt`
- result: automated gates passed
- summary:
  - `11/11 projects clean`
  - lint passed
  - repo tests passed
  - manual gates remaining: `U14`, `U15`

Build/type/lint status from the final tree:

- `bunx tsc -p packages/device` → exit 0
- `bunx tsc -p packages/composite` → exit 0
- `bunx tsc -p apps/web` → exit 0
- `bun test packages/device packages/composite` → 144 passed
- `bun run lint` → exit 0
- `bun run build` → exit 0
- `bun run gates` → exit 0

## Notes

The in-app browser on this host resolves the composite route to T3, so the
composited page is intentionally blank there today. That is consistent with the
current main-path scope: T1 `html-in-canvas` is implemented and verified in
flagged Chrome, while T2/T3/T4 fallbacks remain deferred.
