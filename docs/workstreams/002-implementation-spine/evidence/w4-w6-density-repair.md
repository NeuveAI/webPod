# W4/W6 high-DPI and material-fidelity repair

## Diagnosis

The reported browser image contained three independent failures:

1. The composited canvas had a CSS size but no source-correct backing-store
   observer. `devicePixelContentBoxSize`, DPR changes, and browser zoom were not
   reconciled through R3F.
2. A high-DPI WebGL buffer still sampled a logical-density HTMLTexture source.
   The 320×240 panel host and 272×204 active content therefore enlarged soft
   pixels. Mipmap intent and min/mag filtering were implicit.
3. The 15.5M key plus full white albedo flattened the white polycarbonate into
   a clipped field. Pencil's highlight/trough/recovery and recessed-control
   hierarchy were missing.

## Grounding

- `/Users/vinicius/code/agentic-context/html-in-canvas/Examples/webGL.html`
  and `complex-text.html`: physical backing-store resize from
  `devicePixelContentBoxSize`; experimental geometry remains
  `getElementTransform`.
- `/Users/vinicius/code/agentic-context/react-three-fiber/packages/fiber/src/core/store.ts`:
  the installed R3F renderer store owns `setDpr`.
- Installed Three 0.185.1 `HTMLTexture` and WebGL texture upload sources:
  Three owns the experimental upload call; the application owns texture
  sampling policy and source raster dimensions.
- Pencil MCP screenshots and properties for VWaJS and zbTc3: visual authority
  for white polycarbonate, wheel/Select depth, black identity, and steel bands.

## Deterministic measurements

Command: `bun packages/composite/scripts/capture-density-evidence.ts
docs/workstreams/002-implementation-spine/evidence/w4-w6-density`

| Device scale | Canvas CSS | Canvas backing | Panel source | Viewport / scroll | Margins |
|---:|---:|---:|---:|---:|---:|
| 1 | 330×552 | 330×552 | 320×240 | 390 / 390 | 30 / 30 |
| 2 | 330×552 | 660×1104 | 640×480 | 390 / 390 | 30 / 30 |
| 3 | 330×552 | 990×1656 | 960×720 | 390 / 390 | 30 / 30 |

The resolver tests also cover fractional DPR, invalid physical boxes, fallback
to `window.devicePixelRatio`, clamping above 3×, and a resized 275×460 canvas.
The browser listens to `visualViewport.resize`, so page zoom re-enters the same
measured resolver rather than a separate guessed scale.

## Native visual evidence

- `evidence/w4-w6-density/white-mobile-dpr-{1,2,3}.png`
- `evidence/w4-w6-density/light-candidates/white-{5000000,8000000,11000000,15500000}.png`
- `evidence/w4-w6-density/light-candidates/black-front-11000000.png`
- `evidence/w4-w6-density/light-candidates/white-back-11000000.png`

The selected 11M candidate restores visible body and control separation without
the 15.5M white wash. The black and steel controls show that the shared rig did
not repair white by destroying the other two material identities.

## Verification

- `bun test packages/device packages/composite`: 139 pass, 0 fail.
- `bunx tsc -p packages/device`: clean.
- `bunx tsc -p packages/composite`: clean.
- Flagged Chrome native capture: no page errors, exact backing and source sizes,
  no horizontal overflow, centered at DPR 1/2/3.
