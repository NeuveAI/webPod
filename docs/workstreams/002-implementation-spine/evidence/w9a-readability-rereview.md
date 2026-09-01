# W9a readability antagonistic re-review evidence

## Outcome

All three Majors and the teardown Minor from the review section beginning at
line 619 are addressed without changing wheel travel. `CONTROL_TRAVEL.wheelMm`
remains exactly 0.08 mm, the fixed input surface remains unchanged, and the
response remains wheel-only and demand-rendered.

The current implementation has three linked parts:

1. The source is sampled continuously from the actual body-local contact using
   `frontShellOffsetAt` and `frontShellNormalAt`; no mesh vertex participates.
2. The wheel material has no `RE_Direct` or diffuse path. A neutral response is
   added only to `reflectedLight.directSpecular`, gated by
   `length(liveNormal - restNormal)` and the contact-local cone/range.
3. The existing 0.05-pixel wheel-gap floor follows the same local height field
   as the ring. It therefore cannot intersect a 0.08 mm / approximately
   0.42-model-pixel held depression, while its rest separation is unchanged.

Bounded visual calibration, not claimed OEM measurement:

| Quantity | Value |
| --- | ---: |
| Physical wheel travel | 0.08 mm |
| Tangent source offset | 4 mm |
| Source lift | 5 mm |
| Range | 12 mm |
| Inner / outer cone | 20° / 42° |
| Live/rest slope start / full | 0.65° / 0.9° |
| Peak neutral linear edge return | 0.06 |
| Rest intensity | exactly 0 |

## Continuous-source measurement

The deterministic test constructs the production 128 × 24 wheel topology
(3,225 vertices), then drives the production analytic source through 36,001
contacts at 0.01° increments from -180° through +180°.

- minimum source step: `0.012872352620090425` model pixels;
- maximum source step: `0.012888336481062865` model pixels;
- seam closure: `1.7763568394002505e-14` model pixels;
- zero repeated samples and zero production-tessellation plateaus.

The previous rejected source held for 2.07° and jumped 3.447961 pixels. The
current gate fails if the contact is quantized to integer model pixels.

## Production browser provenance

- Date: September 2, 2026
- Route: `http://localhost:3000/_spike/device`
- Product path: ordinary T1 `CompositeDevice`; no query controls, proof prop or
  synthetic controller call
- Browser: Google Chrome 152 (`Chrome/152.0.0.0`)
- Launch flag: `--enable-blink-features=CanvasDrawElement`
- Viewport: 1280 × 1100 CSS px; DPR 1; WebGL2 available
- Input: real Chrome mouse move/down/held move/up through the production R3F
  annulus and composite/state callbacks
- Console: no page or shader errors; only Three's pre-existing Clock
  deprecation warning

### Complete still matrix

Every file is a genuine 1280 × 1100 RGB PNG. The held contact is in the lower-
right wheel quadrant, clear of the labels. Every hold differs from rest. Every
released frame is byte-identical to its corresponding rest frame.

| Colourway / view | Rest | Hold | Released | Rest/released SHA-256 |
| --- | --- | --- | --- | --- |
| Black front | `black-front-rest.png` | `black-front-hold.png` | `black-front-released.png` | `3bf58aa5…ac68` |
| White front | `white-front-rest.png` | `white-front-hold.png` | `white-front-released.png` | `d1fd470e…4843` |
| Black quarter | `black-quarter-rest.png` | `black-quarter-hold.png` | `black-quarter-released.png` | `3e3938f5…d9c6` |
| White quarter | `white-quarter-rest.png` | `white-quarter-hold.png` | `white-quarter-released.png` | `d7ba1c9c…da0c` |

All files are under `evidence/w9a-readability-rereview/`.

### Temporal seam sequence

`temporal-seam-sequence/frame-174.png` through `frame-186.png` are thirteen
400 × 400 wheel crops captured one degree apart during one uninterrupted real
pointer hold. The pointer crosses the left signed-angle seam through production
`CompositeDevice`; all thirteen frames have distinct SHA-256 hashes. Together
with the 0.01° source sweep, this can expose a two-degree held source or a seam
jump rather than hiding it in selected stills.

`agent-browser record` could not encode WebM because `ffmpeg` is absent on this
host. The requested temporal evidence therefore uses the explicitly permitted
sampled-frame alternative; no recording is claimed.

### Demand-rendering traces

The compressed raw Chrome traces are retained beside the images:

- `idle-trace.json.gz` — 2,000 ms after release, 3,409 events, SHA-256
  `4c0a34162e1f9845933f855edce3ab6a3ce5e77884b03134a85cdbef11ae02ee`;
- `active-contact-trace.json.gz` — real 360° held arc at 2° input increments
  plus release, 100,671 events, SHA-256
  `b31dd2232b3b8143dfdd363d24cf61f6a12ab8bae5b395b34c5c755744579802`.

The idle trace contains zero `RequestAnimationFrame`, `FireAnimationFrame`,
`CancelAnimationFrame`, `BeginFrame`, `DrawFrame`,
`AnimationFrame::Render`, `AnimationFrame::Presentation` and `Paint` events.
The active trace contains 472 requests, 273 callbacks, 199 cancellations, 426
begin frames and 199 draw frames while contact/release is changing. This is the
expected demand-rendered contrast, not a permanent loop.

## Load-bearing adversarial plants

Each edit was asserted in source, run against the focused suite, and reverted.

| Plant | Result |
| --- | --- |
| Replace `length(liveNormal - restNormal)` with `length(liveNormal)` | **red:** 1 failure, 5 pass; exact broad-front-light guard |
| Quantize analytic contact to integer model pixels | **red:** 1 failure, 15 pass; dense sweep minimum step became 0 |
| Delete current detach-time `readability.clear()` | **red:** 1 failure, 15 pass; replacement-safe teardown expected one clear and received zero |

The shader gate additionally rejects `RE_Direct`, any `directDiffuse` path,
UV/camera/time proxies, and any material binding outside `device-wheel`.

## Verification

Implementation commit: `8a3a104` (`fix(device): make wheel readability
continuous`).

Final verification from the same frozen source and evidence set:

- device and web scoped TypeScript: pass;
- scoped ESLint on the five changed source/test files: pass;
- `bun test packages/device`: 205 pass, 0 fail, 62,517 assertions;
- `bun run gates`: 11/11 projects typecheck; repository lint passes; 1,101
  tests pass with 66,459 assertions; all 16 automated static gates pass; U14
  and U15 remain the workstream's explicit manual owner/reviewer checks;
- `bun run build`: client and SSR builds pass (the existing client chunk-size
  advisory remains non-failing).

No audio file or package was read or changed.
