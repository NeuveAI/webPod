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
