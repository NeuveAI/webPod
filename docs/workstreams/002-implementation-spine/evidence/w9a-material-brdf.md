# W9a material-BRDF correction evidence

## Outcome

The remaining re-review Major at `w9a-physics-review.md:782+` is fixed without
changing physical travel. `CONTROL_TRAVEL.wheelMm` remains exactly `0.08`.
The previous raw RGB addition to `reflectedLight.directSpecular` is gone.

The contact response now has this complete energy path:

1. body-local source and incident direction from the real analytic contact;
2. cone, squared range and live/rest normal-slope gating;
3. `dot(N,L)` physical incidence;
4. installed Three 0.185.1 `BRDF_GGX_Multiscatter(lightDir,
   geometryViewDir, geometryNormal, material)`;
5. the matching `BRDF_GGX_Clearcoat` path when the wheel material enables
   clearcoat.

The installed multiscatter function calls `BRDF_GGX` and reads the physical
material's roughness, specular/Fresnel fields and DFG compensation. The
clearcoat function reads the same material's clearcoat F0/F90 and roughness.
There is no `RE_Direct`, Lambert, diffuse, emissive, UV, camera-position or
screen-space path in the wheel block.

## Bounded calibration

These remain visual scene calibrations, not OEM lamp measurements.

| Quantity | Final value |
| --- | ---: |
| Wheel travel | 0.08 mm |
| Tangent source offset | 8 mm |
| Source lift | 1.5 mm |
| Source/contact distance | 8.139 mm |
| Range | 12 mm |
| Inner / outer cone | 8° / 18° |
| Outer-cone radius at contact | about 2.65 mm |
| Deformation radial support | 5.5 mm |
| Live/rest slope start / full | 0.65° / 0.9° |
| Peak linear scene irradiance before gates/BRDF | 40 |
| Rest irradiance | exactly 0 |

The source is now low and tangential rather than front staged. The outer cone
cannot cover the whole depression support. In the captures, black's 0.44
roughness and 0.08 clearcoat produce a firmer narrow crescent; white's 0.8
roughness and 0.035 clearcoat produce a softer, weaker one. There is no
colourway-specific response branch.

## Fail-closed shader gate

`assertWheelGrazingShaderStructure` runs during material shader installation,
not only in tests. It extracts one uniquely marked custom block and requires:

- exactly one cone × range² × live/rest-slope optical gate;
- exact base and clearcoat `dot(N,L)` incidence;
- exact GGX-multiscatter and GGX-clearcoat calls with `geometryViewDir`, the
  appropriate normal and `material`;
- exactly two new optical output writes relative to the input shader: one
  `directSpecular`, one `clearcoatSpecularDirect`;
- no diffuse, Lambert or generic `RE_Direct` path.

The focused test runs twelve adversarial shader plants. It rejects the
reviewer's bare and exact `.rgb` raw `directSpecular` lines, reverse-order
`xyz` clearcoat and `stp` emissive writes, missing cone, missing range, missing
slope, missing base/clearcoat BRDF and constant base or clearcoat incidence.
The same suite verifies that actual black/white materials carry distinct
roughness and clearcoat into this common shader.

## Production browser evidence

- Date: September 2, 2026
- Route: `http://localhost:3000/_spike/device` with no query string
- Product path: ordinary T1 `CompositeDevice`
- Browser: Chrome 152.0.7977.65 (`Chrome/152.0.0.0` user agent)
- Launch flag: `--enable-blink-features=CanvasDrawElement`
- Viewport: 1280 × 1100 CSS px, DPR 1
- Input: real Chrome mouse move/down/hold/up through production R3F pointer
  handlers and the existing composite/state callbacks
- Browser errors: none; console contains only Three's existing `Clock`
  deprecation warning plus Vite development messages

### Wheel matrix

The twelve 1280 × 1100 RGB PNGs under `evidence/w9a-material-brdf/` cover:

| Colourway / view | Rest | Hold | Released |
| --- | --- | --- | --- |
| Black front | `black-front-rest.png` | `black-front-hold.png` | `black-front-released.png` |
| White front | `white-front-rest.png` | `white-front-hold.png` | `white-front-released.png` |
| Black quarter | `black-quarter-rest.png` | `black-quarter-hold.png` | `black-quarter-released.png` |
| White quarter | `white-quarter-rest.png` | `white-quarter-hold.png` | `white-quarter-released.png` |

The final black-front rest/release files are byte-identical at SHA-256
`672361275a83085abb6dc6b32a598808287eddb7f985ef979baa1a877baa541a`.
All four held files differ from rest. Exact rest restoration is additionally
gated by byte-exact CPU geometry tests; no claim is made that every independent
Chrome screenshot encoding is byte-identical.

### Temporal seam sequence

`temporal-seam-sequence/frame-174.png` through `frame-186.png` are thirteen
400 × 400 crops from one uninterrupted real pointer hold crossing the signed
left seam one degree at a time. All thirteen SHA-256 hashes are unique. The
glint stays an asymmetric edge crescent and advances with the physical contact;
there is no stationary plateau, source jump or broad circular pool.

Endpoint hashes:

- frame 174: `3f22c6876ac8a99d0cc70db7143bfeb257e6e07417742edf437ee4a92cf113c5`
- frame 180: `84d775876e0812e1938f4f81940b85af009342f4c529aba3e5af05fd4a30fd4f`
- frame 186: `a1ca3c06d7f15a34ade4ba20a0aa5cc2610cb9501948a11ef3083324833e1f7f`

### Select evidence completed where the ordinary route permits it

`select/` contains black and white rest/hold/release sequences in front and
quarter views, all through the same production Select pointer lifecycle. This
adds the older W9a Select visual sequence without a control-pose API.

Key-only and fill-only interactive macros are still not honestly capturable on
the ordinary route. The existing `lighting` query affects only
`capture&diagnostic=production-surface`, whose branch renders `DeviceCanvas`
instead of `CompositeDevice`; using it would repeat the rejected pointer-chain
bypass. Combined-light Select evidence is present. No proof seam was added.

## Verification

- focused readability suite: 8 pass, 0 fail, 86 expectations;
- device and web TypeScript: pass;
- scoped ESLint: pass;
- device package: 207 pass, 0 fail, 62,545 expectations;
- prior full `bun run gates` at `9c5dea6`: 11/11 typechecks, repository lint,
  1,103 tests and 66,484 expectations pass; all 16 automated gates pass;
  U14/U15 remain the workstream's explicit manual gates;
- client and SSR build: pass; existing client chunk-size advisory remains
  non-failing.

No audio source was read or changed. The prior zero-idle production trace
remains applicable because this correction changes only shader evaluation and
owns no timer, `useFrame` or requestAnimationFrame path.
