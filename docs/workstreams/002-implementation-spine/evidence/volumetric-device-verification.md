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
- `device-edge-white.png`
- `device-rear-white.png`
- `summary.json`

`summary.json` records the exact browser facts behind those screenshots:

- composite front/three-quarter/edge/rear all resolved `tier: "T1"`
- all four composite poses recorded `requestPaint: true`
- all four composite poses attached exactly one `.wp-composite-panel-host`
- all four composite poses kept keyboard continuity (`ArrowDown` changed the
  selected row, with zero page errors)
- the mobile composite pass at 390×844 had `scrollWidth === clientWidth === 390`
  and a centered 330×552 device frame at `x = 30`
- the exact review repro poses now return readings instead of throwing:
  `edge-white` resolved `probeFace: "right"` with 3 edge-shell readings, and
  `rear-white` resolved `probeFace: "back"` with 11 rear readings

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

Fresh flagged-Chrome DPR density captures:

- command log: `evidence/volumetric-device-density.txt`
- screenshots: `evidence/volumetric-device-density/white-mobile-dpr-{1,2,3}.png`
- result:
  - DPR 1 → canvas 330×552, panel 320×240
  - DPR 2 → canvas 660×1104, panel 640×480
  - DPR 3 → canvas 990×1656, panel 960×720

Fresh flagged-Chrome LCD acuity captures:

- command log: `evidence/volumetric-device-acuity.txt`
- screenshots: `evidence/volumetric-device-acuity/lcd-native-dpr-{1,2,3}.png`
- result:
  - DPR 1 → edge P95 19.79
  - DPR 2 → edge P95 31.77
  - DPR 3 → edge P95 37.63

Repo gates:

- command log: `evidence/volumetric-device-gates.txt`
- result: automated gates passed
- summary:
  - `11/11 projects clean`
  - lint passed
  - repo tests passed
  - manual gates remaining: `U14`, `U15`

Build/type/lint status from the final tree:

- `bun run typecheck` → `11/11 projects clean`
- `bunx tsc -p packages/device` → exit 0
- `bunx tsc -p packages/composite` → exit 0
- `bunx tsc -p apps/web` → exit 0
- `bun test packages/device packages/composite` → 149 passed
- `bun run lint` → exit 0
- `bun run build` → exit 0
- `bun run gates` → exit 0

## Notes

The in-app browser on this host resolves the composite route to T3, so the
composited page is intentionally blank there today. That is consistent with the
current main-path scope: T1 `html-in-canvas` is implemented and verified in
flagged Chrome, while T2/T3/T4 fallbacks remain deferred.

The fresh browser summary proves the two review fixes specifically:

- edge verification now targets the visible steel shell band rather than a
  hidden front proxy or the front/back split plane
- rear verification now classifies the rendered back-composition plane while
  still requiring steel backing behind it

The remaining failed tokens in `summary.json` are luminance deltas, not probe
identity or visibility rejections.
