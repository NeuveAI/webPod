# W9a owner depth-axis correction evidence

Date: 2026-09-02

## Production correction

- Wheel maximum remains `0.08 mm` (`0.4271844660` model units).
- Every live wheel vertex copies immutable rest X/Y exactly. Only Z decreases.
- Live normals are the analytic gradient of the scalar Z height field plus the
  immutable crowned-shell slope.
- The visible inner radius (`38`) and outer radius (`102.5`) are exact
  zero-height/zero-gradient boundaries.
- The former wheel-only grazing shader/material is deleted. The ordinary black
  and white polycarbonate materials now receive only the established scene
  key/fill and environment.

## Deterministic geometry gates

Command:

```text
bun test packages/device/src/control-physics.test.ts
```

Result: **13 pass, 0 fail, 394 expect calls**.

The dense gate covers 72 angles × 3 radii on the 3,225-vertex production ring,
then samples release at 12 more angles. Every vertex is checked for exact X/Y,
non-positive Z travel, immutable inner/outer boundary position and boundary
normal. Separate gates establish a monotonic radial basin, finite-difference
normal agreement, signed-seam continuity, floor separation, exact release,
reduced-motion restoration and bounded demand frames.

Package command:

```text
bun test packages/device
```

Result: **196 pass, 0 fail, 62,709 expect calls**.

Repo typecheck: **11/11 projects clean**.

Full gate command:

```text
bun run gates
```

Result: **16 automated pass, 0 automated fail**; repo tests are **1,092
pass, 0 fail, 66,651 expect calls**. The two standing manual gates remain U14
(owner thumb occlusion) and U15 (unsupported-control inspection).

Production build: `bun run build` completed both client and SSR builds; 234
client modules and 393 SSR modules transformed.

## Adversarial plants

Each plant was applied alone, the focused suite was run, and source was
restored before the next plant.

1. Restore the rejected normal-projected X/Y displacement.
   Result: **4 fail**. The first failure reports
   `contact -180deg/50.2px: vertex 187 changed local Y`.
2. Remove the fixed inner/outer boundary condition.
   Result: **1 fail**. The first failure reports
   `boundary 24 normal component 0 crawled`.
3. Remove `depth * dw/dx` and `depth * dw/dy` from the live normal.
   Result: **1 fail**. The independent oracle measures `0.0130287` normal
   distance against the `< 0.0002` bound.

These plants are load-bearing against the exact rejected geometry, a crawling
assembly edge and decorative normals disconnected from the real height field.

## Production browser matrix

Driver: `apps/web/tests/wheel-depth-evidence.e2e.ts`

Command:

```text
W9A_DEPTH_EVIDENCE_DIR=docs/workstreams/002-implementation-spine/evidence/w9a-depth-only \
  bunx playwright test apps/web/tests/wheel-depth-evidence.e2e.ts \
  --config apps/web/tests/playwright.config.ts
```

Result: **1 passed** in Chrome with `CanvasDrawElement` enabled. Source health
matched fingerprint
`49b8ca7fb4566e383835dc39efbc73b01bd0c8fef29483e3cccc0fe69e5b1307`
across 194 served files.

The route is the ordinary `/_spike/device` route. The test uses real
`mouse.move → mouse.down → captured hold → mouse.up → release settle`, and
asserts the production `data-wp-wheel-gesture=active` lifecycle. It adds no
control query parameter, synthetic control pose or proof API. The existing
preview controls change only colourway and camera pose.

The twelve PNGs and hashes are indexed in
`evidence/w9a-depth-only/summary.json`:

- black and white;
- front and three-quarter;
- rest, held and released.

For all four colourway/pose pairs, the released PNG SHA-256 equals the matching
rest SHA-256 exactly. The held three-quarter captures expose the shallow normal
change while the wheel's inner gap and outer silhouette remain fixed.
