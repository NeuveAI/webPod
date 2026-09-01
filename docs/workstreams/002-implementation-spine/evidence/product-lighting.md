# Product-lighting correction evidence

Date: Tuesday, September 1, 2026  
Route: `http://localhost:3000/_spike/device`  
Reviewed source: `cb7692cea67871202a70a39a59c085c16e4fa928`  
Reviewed tree: `f695415db2fbed19fc1267f1554fd423431f4ad7`

## Outcome

The approved top-right key is unchanged. The previously ineffective lower
source is now a broad, world-space front-left fill. It reaches the lower shell
and click wheel, separates the product from the dark room, and remains quiet in
the combined exposure. No material, geometry, PMREM, camera-fit, or LCD shader
value moved in this lighting commit.

The immutable browser snapshot fingerprint is
`c403684d8431469e5f4debbb12f7682ea36aaa746bbbcab345d2988ea015e990`
across 184 served files. The value before and after capture is identical. This
integrated source includes lighting commit `ef2d48b` and Goodall's subsequent
owner-photo white-material correction without mixing implementation ownership.

## Owner-photo grounding

The nine owner-shot originals were inspected locally and were not copied into
the repository:

- `IMG_2239.HEIC`, `IMG_2240.HEIC`, `IMG_2248.HEIC`, and `IMG_2249.HEIC` show
  the front face retaining a broad lower lift rather than falling to a black
  floor.
- `IMG_2242.HEIC` and `IMG_2243.HEIC` show a wide oblique reflection that
  separates faceplate, wheel, clear edge, and steel without a narrow hotspot.
- `IMG_2244.HEIC`, `IMG_2245.HEIC`, and `IMG_2246.HEIC` show the side profile
  carrying long soft card reflections; they reject a thin horizontal strip or
  camera-locked painted rim.

The photos guide reflection size, continuity, and hierarchy only. Goodall's
material/geometry lane remains authoritative for white colorimetry and shape.

## Named physical rig

| Parameter | Key | Lower fill |
| --- | ---: | ---: |
| Viewer azimuth | +45° | −45° |
| Elevation | +40° | −18° |
| Distance | 720 | 620 |
| World position | `[390.006, 462.807, 390.006]` | `[-416.949, -191.591, 416.949]` |
| Aim | origin | `[-70, -160, 20]` |
| Emitter | 520×380 | 640×440 |
| Exposed power | 8,280,000 lm | 786,600 lm |
| Power ratio | 1.0 | 0.095 |
| Surface intensity | 13.3381 nit | 0.8891 nit |
| Intensity ratio | 1.0 | 0.06666 |

Linear exposure remains 0.92. The PMREM room remains intensity 0.20 with sigma
0.04. Both sources are Three `RectAreaLight`s and remain siblings of the one
rotating model group.

## Browser proof

[`product-lighting/summary.json`](./product-lighting/summary.json) records the
complete 24-render matrix: combined, key-only, fill-only, and neutral for black
and white in front, three-quarter, and right-edge views. Representative frames:

- [combined black front](./product-lighting/combined-black-front.png)
- [combined white front](./product-lighting/combined-white-front.png)
- [combined black three-quarter](./product-lighting/combined-black-three-quarter.png)
- [combined white three-quarter](./product-lighting/combined-white-three-quarter.png)
- [combined black edge](./product-lighting/combined-black-right-edge.png)
- [fill-only white front](./product-lighting/fill-only-white-front.png)
- [fill-only black front](./product-lighting/fill-only-black-front.png)
- [key-only white front](./product-lighting/key-only-white-front.png)
- [neutral black three-quarter](./product-lighting/neutral-black-three-quarter.png)
- [mobile combined three-quarter](./product-lighting/combined-black-three-quarter-mobile-375x812.png)

The fill-only white front is the direct contribution proof. With the key and
PMREM disabled, median luminance is 68.30/255 across the lower assembly,
68.30/255 across the wheel, and 70.43/255 along the bottom shell. The lower
left shell's p99-minus-p50 spread is only 3.07 and its maximum adjacent-row
change is 0.10, excluding a hotspot or horizontal band.

Combined minus key-only changes the lower assembly by 13.44 luminance points
on average (p95 21.51), versus 1.35 in the upper zone. The fill therefore has
a measured 9.97× lower-targeting bias while staying subordinate by power and
surface intensity.

At 375×812 the three-quarter render is centered with no horizontal overflow;
projected extent is `0.818667 × 0.675986` inside limits
`0.818667 × 0.916256`.

## Mutation and source gates

- Exact angle, distance, target, emitter, power ratio, and color literals are
  locked. Restoring the old −120° rear source or 85×300 strip fails.
- Cartesian reconstruction requires fill `x < 0`, `y < 0`, and `z > 0`; the
  old rear placement has `z < 0` and fails.
- Fill area must exceed key area while its power remains below 10% and its
  surface intensity below 8% of key.
- Key-only and fill-only must zero exactly one mounted emitter without moving
  either source.
- Source scans allow exactly two RectAreaLights and reject point, spot,
  directional, ambient, camera/view-matrix, UV, CSS-gradient, and additive
  outgoing-light escapes.
- World-transform tests flip the model and require both lights' world
  positions to remain unchanged.

## Verification

```text
bunx tsc --noEmit -p packages/device/tsconfig.json       clean
bunx tsc --noEmit -p packages/composite/tsconfig.json    clean
bunx tsc --noEmit -p apps/web/tsconfig.json              clean
bunx eslint <six scoped lighting/test files>             clean
bun test packages/device packages/composite              215 pass, 0 fail
bun run build                                             client + SSR clean
bun run gates                                             16 automated pass, 0 fail; 1,030 tests
product-lighting.e2e.ts                                   1 pass, 24 + mobile captures
lcd-acuity.e2e.ts                                         3 pass, DPR 1/2/3 + blur plant
volumetric-device-verification.e2e.ts                     1 pass
```

LCD edge acuity remains above the established gate at every density:

| DPR | composite p95 | composite p99 | p95 retained | p99 retained |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 83.70 | 142.13 | 61.30% | 60.18% |
| 2 | 103.17 | 157.46 | 71.33% | 61.75% |
| 3 | 105.49 | 167.65 | 69.31% | 66.07% |

The 1px blur mutation fails closed, and the 1.25× page-scale run remains
centered at zero-pixel offset with `scrollWidth === clientWidth === 390`.

The older `responsive-previews.e2e.ts` suite was not used as acceptance: it
still targets retired `.webpod-device-spike__stage` and
`.wp-composite-raster-canvas` selectors. The current product-lighting and
volumetric suites provide the mobile proof on the shipping route.
