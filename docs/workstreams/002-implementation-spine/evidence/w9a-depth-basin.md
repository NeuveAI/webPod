# W9a localized depth-basin correction evidence

> Historical owner-rejected evidence. The localized basin was the wrong
> physical model even after its in-plane directionality was removed. It is
> superseded by [w9a-rigid-wheel.md](w9a-rigid-wheel.md). None of the basin,
> footprint, moving-normal or 0.08 mm wheel-travel claims below are current.

Date: 2026-09-02

## Outcome

The wheel remains an exact body-local Z-only deformation capped at 0.08 mm.
This correction removes the rejected 5.5 × 8 mm directional footprint and uses
a 5.5 mm circular support. X/Y, silhouette, ring radii, seams, materials,
lighting and the removed auxiliary shader are unchanged.

Source commits:

- `e4d556c3d60ad86117730dfc265f8fabc25991f9` — isotropic production field,
  mesh gate and browser visual comparison;
- `7baedf9f7039911e619de8fabed71d4fa3197f88` — immutable rejected visual
  baseline without a documentation-path dependency.

## Immutable production-browser proof

The browser served exact commit
`7baedf9f7039911e619de8fabed71d4fa3197f88`, tree
`b30cd16bd5691f99fbeb2ea92fe9382e872e9118`, source fingerprint
`7f60a11f86d4a9b36d548073c6c9cbc5a3ea7ec89bbfde70eeaa7048ddf0af90`
across 194 files. Health expected/current hashes matched.

Route and input are production: `/_spike/device`, followed by real Chrome
`mouse.move → mouse.down → captured hold → mouse.up → release settle` through
`CompositeDevice`. The driver asserts `data-wp-wheel-gesture=active`. There is
no control query parameter, synthetic pose or proof API.

The complete capture/hash index and comparison metrics are in
`evidence/w9a-depth-basin/summary.json`. The key comparison is:

| White three-quarter held response | Rejected | Corrected | Change |
| --- | ---: | ---: | ---: |
| Changed pixels, luma threshold 0.75 | 3,355 | 2,278 | −32.1% |
| Difference bounds | 67 × 100 px | 54 × 70 px | −19.4% × −30.0% |
| Weighted principal aspect | 1.744 | 1.393 | −20.1% |

The rejected baseline is pinned by rest SHA-256
`797e7037171e7f64610de4bfc25457d605c5e1fabe167f5233df9cd7d01f1104`
and held SHA-256
`f2d5f92a2ac6637ed34fe6547622eff487e3b1475e695982b3212c6c6fc18a79`.
The visual gate fails if the corrected changed area is not below 80% of that
baseline or if its principal aspect is not lower.

For black and white, front and quarter, every released PNG is byte-identical
to its corresponding rest PNG. Representative corrected frames:

- [white quarter held](w9a-depth-basin/white-three-quarter-held.png)
- [white quarter rest](w9a-depth-basin/white-three-quarter-rest.png)
- [black quarter held](w9a-depth-basin/black-three-quarter-held.png)
- [black front held](w9a-depth-basin/black-front-held.png)

## Deterministic geometry and mutation gates

`bun test packages/device/src/control-physics.test.ts`:
**14 pass, 0 fail, 330 assertions**.

The added gate proves, at the production midpoint contact:

- equal scalar weight at equal radial/tangential distances;
- equal authored radial/tangential physical support;
- affected production-mesh extents with aspect below 1.12.

The existing dense sweeps continue to prove every production vertex keeps
immutable X/Y, only moves toward negative local Z, preserves both circular
boundaries and restores exact arrays after release. The finite-difference
oracle still proves normals are the analytic gradient of the same scalar field.

Mutation: restoring `tangential: 8` produces **2 failures**: the literal
calibration gate and the isotropy gate. Source was restored before final runs.

## Final verification

- `bun test packages/device`: **197 pass, 0 fail, 62,645 assertions**.
- `bun run typecheck`: **11/11 projects clean**.
- `bun run lint`: clean.
- `bun test`: **1,093 pass, 0 fail, 66,587 assertions**.
- `bun run build`: client and SSR green; 234/393 modules transformed.
- immutable Chrome evidence: **1 pass**.
- `bun run gates`: **16 automated pass, 0 automated fail**; U14 and U15 remain
  the standing manual owner/reviewer inspections.

No audio source was read or changed.
