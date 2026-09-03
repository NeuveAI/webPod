# Review: `1e09ae2` + `2b23f73` — visual and responsive repair

## Verdict: REQUEST_CHANGES — 3 Major, 1 Minor

Reviewed commit: `2b23f73` (including parent `1e09ae2`). The current working
tree already contains a separate, uncommitted follow-up. I excluded it by
reviewing and running the browser matrix from a disposable clone fixed at
`2b23f73`; nothing in the live tree was staged, reset, committed, or edited.

The responsive repair is real: both routes remain centred and contained at
320×568, 375×667, 390×844, and 430×932; the composite survives a
390×844 → 390×568 → 390×844 resize with selection and keyboard interaction
intact; the T1 composite allocates exact DPR 1/2/3 WebGL and HTMLTexture
rasters. Those results do not clear the visual gate. The owner has rejected the
render, and H-6 is explicitly owner-only.

### Visual quality scorecard

Scale: 0 = absent, 5 = matches the saved Pencil authority at native size.

| Surface | Score | Evidence |
|---|---:|---|
| Black enclosure diffuse / SSS depth | **1.0 / 5** | The accepted 330×552 capture and the owner's new screenshot read as an almost uniform brown-black slab. The thin chrome outline is the brightest enclosure event; there is no primary upper specular arc, broad secondary sheen, or visibly warm lower-edge scatter. |
| Black wheel / Select hierarchy | **1.5 / 5** | The ring is distinguishable mainly by value. Its recess is weak and the Select reads as a flat darker disc, not the raised translucent control specified in §5.4. |
| White enclosure diffuse depth | **1.5 / 5** | Shell, wheel, and Select collapse into one washed pale family. Pencil VWaJS instead separates the pearl shell, cool seam, recessed wheel, and raised Select through independent non-monotonic gradients and a dedicated Select specular layer. |
| Steel reflection / depth | **3.0 / 5** | The back capture preserves reflection bands and etched/inlay structure, but the upper field clips broadly and the lower hierarchy is softer than zbTc3's ten-stop 168° metal field plus mirror band and brush sheen. |
| LCD UI fidelity | **1.5 / 5** | The owner screenshot and the committed native composite capture show soft text and coarse horizontal structure. The hierarchy is readable, but it does not read as a sharp 320×240 LCD raster. |
| Responsive composition | **4.5 / 5** | Centring, authored aspect ratio, containment, safe-area/dvh framing, wrapping, and interaction after resize all reproduced. |

Pencil was read only through the Pencil MCP. VWaJS is a 330×552 component with
a layered white enclosure field (`#FFFFFF → #F8FAFC → #E9EEF3 → #F1F5F8 →
#FFFFFF`), a separately modelled wheel field, and an 84px Select plus a distinct
58×30 specular layer. zbTc3 is a non-monotonic ten-stop steel field with a
separate mirror band and brush sheen. The landed native captures do not preserve
that material hierarchy.

## Findings

### Major 1 — H-6 is rejected: the enclosure still reads as a flat substrate, not a physical object

`packages/device/src/Device.tsx:588-599` reduces black lower-edge transport to
an emissive map at intensity `0.02`. The surrounding recipes at
`packages/device/src/materials.ts:107-175` lower black body environment response
to `0.195`, black wheel response to `0.005`, and render the wheel/Select as
near-uniform physical surfaces. Those values are not automatically wrong; the
render they produce is. In the binding owner screenshot and the commit's own
black-front evidence, the enclosure has neither the design system's upper
clearcoat/specular event nor the broad sheen and lower-edge warm scatter that
communicate polycarbonate depth. White fails the same hierarchy in the opposite
direction: diffuse clipping makes body, ring, and Select merge.

This is not a request for painted gradients. The implementation can remain a
physical material/light/geometry solution. The blocker is the output: restore a
legible diffuse/clearcoat/transport hierarchy in black and white, preserve the
steel identity, and return all three native captures to the owner. Automated DPR
and luminance mechanics cannot clear H-6, and this reviewer cannot override the
owner's rejection.

### Major 2 — the standalone LCD is unconditionally a 1× texture, and the route is under-backed at DPR 3

`apps/web/src/routes/[_]spike.device.tsx:443-477` always creates a 272×204
`CanvasTexture`, while the route fixes its WebGL DPR to numeric `2`. The source
is therefore magnified at every 2× render and becomes still more deficient on a
3× display. My live DPR matrix at `2b23f73` measured:

| Requested display DPR | Standalone CSS canvas | Standalone backing store | Effective WebGL DPR |
|---:|---:|---:|---:|
| 1 | 330×536 | 660×1072 | 2 |
| 2 | 330×536 | 660×1072 | 2 |
| 3 | 330×536 | 660×1072 | 2 |

The responsive test at `apps/web/tests/responsive-previews.e2e.ts:195-201`
codifies this ceiling with `Math.min(2, window.devicePixelRatio)`, so the DPR-3
failure is green for the reason the test permits it. It also checks only the
WebGL canvas; it never checks the 272×204 LCD texture source.

The T1 composite does allocate 320×240, 640×480, and 960×720 HTML rasters at
DPR 1/2/3, respectively. That closes the allocation half, not the fidelity
half. Its visible output still has soft type and over-prominent horizontal
structure. `packages/composite/src/html-in-canvas.ts:84-94` and `:304-335`
select linear filtering and add a three-pixel scanline/triad shader, while the
tests assert dimensions and paint completion only. The follow-up needs an
empirical LCD gate: native-size capture, source/backing metrics, and a sharpness
or edge-acuity check that fails for the current screenshot—not another source
dimension assertion that the current code already passes.

### Major 3 — the zoom observer computes the physical DPR and then R3F discards it

`packages/device/src/CanvasPixelDensity.tsx:21-30` correctly resolves a physical
ratio from `devicePixelContentBoxSize`, but passes the result as
`setDpr([1, resolved])`. In the installed R3F source,
`react-three-fiber/packages/fiber/src/core/utils.tsx:124-127`, array DPR is
re-resolved against `window.devicePixelRatio`:

```text
physical box / CSS = 1.5; window.devicePixelRatio = 1
resolveCanvasPixelRatio(...) = 1.5
R3F calculateDpr([1, 1.5]) = 1
R3F calculateDpr(1.5) = 1.5
```

I ran that seam against the actual grounded R3F implementation. The pure tests
cover `resolveCanvasPixelRatio`, but never cross the `setDpr` boundary, so the
decision note's page-zoom claim is not enforced end to end. Pass the already
resolved value through without asking R3F to resolve it again, and plant this
exact disagreement case at the component/store seam.

### Minor 1 — the repaired mobile header still shrinks pointer targets below the route's own interaction bar

`apps/web/src/routes/[_]probe.composite.tsx` sets header links to 32px block size
and reduces them to 28px below 720px height. The controls now wrap and remain
visible, but both values are below the 44px touch target used by the project's
own panel controls and by the loaded interface guardrails. This is a diagnostic
route, so it is not a product-UI Major; it still makes the exact phone-sized
validation surface unnecessarily hard to operate.

## Regression and method checks

- The material finding contradicts the commit's intended result, not its
  physical-render method. The physical method can remain; the observed output
  does not satisfy it.
- The DPR/centering tests pass for the right reason on the composite path. The
  standalone DPR test passes for the wrong reason because it explicitly admits
  the 2× ceiling.
- The R3F zoom defect was found by crossing the producer/consumer seam with a
  cheap empirical plant. Reading either resolver in isolation would have missed
  it.
- Screenshot generation is not a visual regression gate. The test records
  materially rejected pixels without comparing or scoring them.
- The visual acceptance contract remains a manual owner invariant at the
  device boundary. A flag in a diary or a generated evidence image does not
  answer it.
- The changes are broad but coherent enough to review; I found no commit trailer,
  credential, `useState`, provider, or tier-ownership regression.

## Gates run independently

- `bun run gates` from a committed-only clone at `2b23f73`: **16 automated
  passed, 0 failed; U14 and U15 manual**.
- `bun run build`: **client and SSR green**; one pre-existing 1.19 MB client
  chunk warning remains.
- `responsive-previews.e2e.ts`: **14/14 green** at 320×568, 375×667, 390×844,
  430×932, and 1440×900, including dynamic height resize and keyboard state.
- Independent Chrome 151 T1 DPR matrix: composite WebGL buffers exactly
  330×552, 660×1104, 990×1656; HTMLTexture rasters exactly 320×240, 640×480,
  960×720; no horizontal overflow; interaction survives resize at all three
  DPRs.
- Grounded R3F seam plant: array `[1, 1.5]` resolves to `1` at window DPR 1;
  numeric `1.5` remains `1.5`.
- Neuve was not invoked: this repository's active workstream explicitly says
  there is no Neuve shell or board.

## Re-review status

Pending. The working tree contains an uncommitted enclosure/LCD follow-up. It
will receive a new section here only after it lands with an immutable commit
identity. No current finding is pre-cleared by those in-progress files.

# Re-review — `ab391a7` + `a07f52a`

## Verdict: REQUEST_CHANGES — 4 Major, 1 Minor

Both follow-ups are meaningful improvements and both are cleanly scoped. They
do not close the review:

| Initial finding | Re-review result |
|---|---|
| Major 1 — enclosure/H-6 | **Improved, still open.** Black is now neutral and carries a broad face response; the wheel recess and edge separation are clearer. White and steel are unchanged, and the owner has not accepted the new three-surface set. |
| Major 2 — LCD fidelity / standalone DPR | **Panel-source half closed; end-to-end and standalone halves open.** The bare DOM panel is now crisp and materially closer to an iPod LCD. The commit's own evidence explicitly says composited softening and scanlines remain open. The fixed 272×204 standalone texture and fixed 2× backing are untouched. |
| Major 3 — R3F DPR seam | **Open, untouched.** Neither follow-up changes `CanvasPixelDensity.tsx`. |
| Minor 1 — header targets | **Open, untouched.** |
| New Major 4 — transport violates LAW 2 | **Open.** The new SSS-labelled term is unattenuated post-light emission in the shader model. |

### Updated visual scorecard

| Surface | Before | After | Re-review evidence |
|---|---:|---:|---|
| Black enclosure diffuse / SSS depth | 1.0 | **3.0 / 5** | `black-low.png` removes the brown cast and introduces broad top/mid/bottom separation. It is visibly more object-like, but the transport is still shallow and has not been owner-accepted. |
| Black wheel / Select hierarchy | 1.5 | **2.5 / 5** | Recess and rim are clearer; Select is still subdued and the lower wheel rim remains the strongest local event. |
| White enclosure diffuse depth | 1.5 | **1.5 / 5** | White control is intentionally unchanged; shell/wheel/Select remain washed together. |
| Steel reflection / depth | 3.0 | **3.0 / 5** | Unchanged. |
| Bare LCD source fidelity | 1.5 | **4.0 / 5** | The 272×204 source now has compact Helvetica-family text, coherent inline icons, 21px title/row rhythm, 168/104 split, and crisp authored artwork. |
| End-to-end composited LCD fidelity | 1.5 | **2.0 / 5** | Better source content survives, but the native composite capture remains soft and the 3px scanline treatment dominates small text and artwork. |
| Responsive composition | 4.5 | **4.5 / 5** | All prior responsive and resize results remain green. |

## Re-review findings

### Major 1 remains — visual improvement is not owner acceptance

The retained black candidate is substantially better than the rejected render,
but H-6 remains an owner-only object/material judgment and the workstream says
so itself. `ab391a7` supplies only a black front and an unchanged white control;
it does not supply a newly accepted white/black/steel set. This reviewer cannot
promote a better screenshot into owner approval. The white hierarchy also
remains the same washed result that the owner rejected before the follow-up.

### Major 2 remains — `a07f52a` fixes the source and explicitly leaves the main-path raster defect open

The bare source correction is good work. I reproduced its geometry and
interaction tests, and its source capture is sharp. But
`docs/workstreams/002-implementation-spine/evidence/lcd-fidelity.md` states:
the composited captures still show scanline intensity and texture softening and
must not be used to approve the end-to-end shader. The decision file makes the
same boundary explicit.

That is exactly the user's acceptance surface: HTML-in-canvas inside the device,
not a bare DOM panel. `packages/composite/src/html-in-canvas.ts:84-94` and
`:304-335` are unchanged, as are the standalone route's 272×204
`CanvasTexture` and numeric DPR 2. The four new E2E tests check geometry,
interaction, and screenshot production; none scores edge acuity or fails on the
current soft composited output. Major 2 therefore narrows but does not close.

### Major 3 remains — the physical DPR is still discarded at the R3F seam

No follow-up line touches `packages/device/src/CanvasPixelDensity.tsx:29`.
The independent seam plant still holds: with physical-box ratio 1.5 and
`window.devicePixelRatio === 1`, R3F resolves `[1, 1.5]` back to 1 while numeric
1.5 remains 1.5. The responsive suite cannot falsify this because its DPR
contexts make both signals agree.

### New Major 4 — the SSS-labelled term is a third, unattenuated source of light

`packages/device/src/physical-materials.ts:39-50` gives the shader color,
ambient, distortion, power, scale, edge coefficient, and a normalized key
*position*. It does not give it the key intensity, key color, point-light
distance/attenuation, fill light, or environment contribution. Lines 69-75 then
add `webpodSubsurface` after Three has completed diffuse, specular, and emissive
lighting.

I instantiated the shipped material and inspected its compiled seam:

```text
uniforms: webpodSssColor, webpodSssAmbient, webpodSssDistortion,
          webpodSssPower, webpodSssScale, webpodEdgeTransmission,
          webpodSssLightDirection
directLight: absent; lightColor: absent; attenuation: absent
addition: totalDiffuse + totalSpecular + totalEmissiveRadiance + webpodSubsurface
```

Consequently, setting the key intensity to zero, changing its color, or moving
it farther away does not change this term; the fill never contributes at all.
That contradicts `light-rig.ts:8-20`, which says there is no ambient term and
that every unit of light arrives from the point key, fill, or room. It also does
not follow grounded Three SSS behavior: Three's
`src/materials/nodes/MeshSSSNodeMaterial.js` integrates scattering per direct
light and multiplies it by attenuation and `lightColor`.

This is not a naming-only complaint. The old emissive map was removed because
painted, light-independent lift made the enclosure read false; the replacement
retains the same physical violation through a custom additive shader. Integrate
transport with the actual direct-light terms (including coordinate space,
attenuation, color, and the fill) or record an explicit source-of-truth ruling
that authorizes a light-independent material emission. The current evidence's
claim that the term follows Three's SSS “shape” does not survive source
comparison.

## Re-review gates run independently

- Disposable committed-only clone at `a07f52a`.
- `bun run gates`: **16 automated passed, 0 failed; 951 tests passed**; U14/U15
  remain manual.
- `bun run build`: client and SSR green; the 1.19 MB client chunk warning
  remains.
- LCD + responsive browser suites together: **18/18 passed** in flagged Chrome.
- Bare LCD source inspected at native 272×204: crisp and structurally faithful.
- Composited desktop/mobile evidence inspected at native output: softening and
  dominant scanlines remain, matching the author's honest boundary.
- Grounded Three SSS source compared against the compiled custom-material seam;
  the per-light inputs present in Three are structurally absent here.

No implementation file, token change, old evidence image, or staged state was
modified. This review file remains the reviewer's sole working-tree artifact.
