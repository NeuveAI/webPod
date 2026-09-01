# Evidence — volumetric device verification

This note records the final W8 verification run for the volumetric device slice
on August 31, 2026.

## Canonical luminance verification is now explicit and bounded

D-064 is encoded in executable form, not only in prose:

- `packages/device/src/orientation.test.ts` classifies only `front` and `rear`
  as `canonical-luminance`; `three-quarter`, `edge`, and `custom` are
  `physical-continuity`.
- `apps/web/tests/volumetric-device-verification.e2e.ts` proves that
  `window.__deviceCalibration.sample()` succeeds only for the canonical
  reference poses and rejects rotated poses with the exact D-064 message.

The fresh flagged-Chrome canonical proof lives in
`evidence/volumetric-device-browser/summary.json`, with native captures beside
it:

- `device-front-black.png`
- `device-front-white.png`
- `device-rear-white.png`

Canonical results from that summary:

| Reference sample | Readings | Failed tokens | Max `|delta|` |
|---|---:|---:|---:|
| black front | 16 | 0 | 3.9999999999999964 |
| white front | 16 | 0 | 3.893699999999967 |
| steel rear | 11 | 0 | 4 |

Those are the W4 tables the owner asked to close: canonical white front,
canonical black front, and the shared steel rear. The shipped source defaults
now meet the ±4 contract without a live rig patch.

## Rotated poses are verified by physical continuity, not by the stop tables

The same fresh browser summary records the physical-continuity evidence set:

- `device-three-quarter-black.png`
- `device-edge-white.png`
- `device-custom-flip-white.png`
- `device-animated-00.png` through `device-animated-04.png`

What is asserted there:

- three-quarter, edge, and custom poses all reject canonical sampling with the
  exact D-064 message rather than silently grading the wrong thing
- the rotated captures keep the stage centered, vertically contained, and free
  of horizontal overflow at 390×844
- the animated front→rear sequence keeps rendering through five custom
  orientations with zero page errors, and the recorded hashes differ frame to
  frame
- the sequence's `probeFace` progression is physically sensible for the visible
  side of the object: front → front → right → back → back

The deterministic invariants behind those captures are split correctly:

- `packages/device/src/ViewerLitDeviceFrame.test.tsx` proves the lamps stay
  world-fixed while the model rotates
- `packages/device/src/orientation.test.ts` proves which poses are canonical
  and which are continuity-only
- the route-level browser test proves the diagnostic sampler cannot be reused on
  rotated poses by accident

## Responsive / DPR / resize matrix

Fresh responsive screenshots from the Playwright matrix live in
`evidence/volumetric-device-responsive/`:

- `composite-320x568.png`
- `composite-375x667.png`
- `composite-390x844.png`
- `composite-desktop-1440x900.png`
- `device-320x568.png`
- `device-375x667.png`
- `device-390x844.png`
- `device-desktop-1440x900.png`

`evidence/volumetric-device-responsive.txt` records the matrix result:

- 17 passed
- composite centered/contained at 320×568, 375×667, 390×844, 430×932
- standalone device centered/contained at the same mobile sizes
- standalone device LCD and WebGL backing stores at DPR 1/2/3
- composite refit after 390×844 → 390×568 → 390×844
- bare-panel authored-raster preservation
- mobile/desktop screenshot capture

## Command results

Fresh browser proof:

- command log: `evidence/volumetric-device-browser.txt`
- result: 1 passed
- source identity: `1e2dd4fcfc70eae800a97b6f6a86f91f82445ebb1854cf98a153b3bf7321842d`
  across 170 browser-served files, matched before capture

Per-package/app checks:

- `bunx tsc --noEmit -p packages/device/tsconfig.json` → exit 0
- `bunx tsc --noEmit -p packages/composite/tsconfig.json` → exit 0
- `bunx tsc --noEmit -p apps/web/tsconfig.json` → exit 0
- `bun run lint` → exit 0
- `bun run build` → exit 0

Repo tests:

- command log: `evidence/volumetric-device-tests.txt`
- result: 966 pass / 0 fail / 53 files

Full gates:

- command log: `evidence/volumetric-device-gates.txt`
- result: 16 automated passed / 0 automated failed / 2 manual outstanding
- manual items still outstanding by design: `U14`, `U15`

## Notes

The shell/material evidence and the LCD evidence should not be conflated. W8
closes the volumetric shell and its canonical-vs-rotated proof boundary. The
inner LCD content visible on `/_spike/device` remains a diagnostic proxy for
the panel/composite system, not the final panel-fidelity acceptance surface.

## Tuesday, September 1, 2026 — device-owned physical-lighting repair addendum

This addendum covers the follow-up device-only material/lighting repair done in
the shared workspace after the owner rejected the prior white and black fronts
for shimmer, broad bands, clipped lift, and insufficient product depth.

### Owned changes

- `packages/device/src/light-rig.ts`
- `packages/device/src/materials.ts`
- `packages/device/src/materials.test.ts`
- `packages/device/src/renderer-defaults.ts`
- `packages/device/src/renderer-defaults.test.ts`

These changes stayed within physical light/material controls:

- no additive glass shader
- no view-locked front gradient
- no pose-specific light
- no change to the canonical ±4 stop-table expectations

### Device-local verification that did pass

- `bun test packages/device/src/materials.test.ts packages/device/src/renderer-defaults.test.ts packages/device/src/optical-profile.test.ts`
  → **18 pass / 0 fail**
- `bun run build`
  → **exit 0**
- `bun run typecheck`
  → **11/11 projects clean**
- earlier same-session integrated-browser check at `http://localhost:3000/_spike/device`
  → the route was visible enough to confirm the fake glass lift was gone and
  the wheel/select recess read more clearly than the rejected pass
- final fresh integrated-browser reload after the last crown/material retune
  → **not reproducible**. The connector saw an empty `<body>` on the shared
  route, so no new final screenshot is claimed for this exact tree

### Verification surfaces that stayed blocked or red

- fresh browser verifier:
  `bunx playwright test volumetric-device-verification.e2e.ts --config apps/web/tests/playwright.config.ts`
  → **failed before grading the device**. The harness served the shell on
  `127.0.0.1:4317`, but `.webpod-device-spike__stage` never mounted and the
  integrated browser showed the same blank page on that fresh-server URL. Later
  shared-route reloads also returned an empty body.
- repo lint:
  `bun run lint`
  → **exit 1 outside W8's owned surface**
  - `apps/web/src/routes/[_]probe.composite.tsx`: `react-hooks/exhaustive-deps`
    warning
  - `apps/web/tests/lcd-acuity.e2e.ts`: unused `Browser` import error
- repo tests:
  `bun test`
  → **red in `scripts/gates.test.ts` fixture setup on this session**, including
  temp-fixture `ENOENT`, `git` spawn `ENOENT`, and fixture baseline commit exit
  `143`
- repo gates:
  `bun run gates`
  → re-ran typecheck green, then stopped at the same out-of-slice lint failure
  and the same `scripts/gates.test.ts` fixture failures above

### Supporting references used for the repair

- Pencil MCP components `VWaJS` and `zbTc3`
- Retrospekt product photos:
  `https://retrospekt.com/products/apple-ipod-5th-generation-white-mp3-player`
  and
  `https://retrospekt.com/products/apple-ipod-5th-generation-mp3-player`
- iFixit front-face reference:
  `https://www.ifixit.com/Guide/iPod+5th+Generation+(Video)+Front+Faceplate+Replacement/159192`
