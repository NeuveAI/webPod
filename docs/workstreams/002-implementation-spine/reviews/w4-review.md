# Review: W4 — Device layer

## Verdict: REQUEST_CHANGES

W4 is not acceptance-ready. The geometry, demand frameloop, disposal work, and repaired texture orientation are credible, but the binding physical-render criterion is explicitly red, the current cover-glass recipe contradicts Three's material contract, and the D-056 handle is not replay-safe at the current W6 seam. H-6 and U14 remain owner-only and are not cleared here.

## Correctness check

- Reviewed commits `62c2bef`, `7cf9205`, `31d6d71`, `90b2349`, `cb9c75c`, `1fbd029`, `b4f6936`, and `0d7da79` against the W4 dispatch, 002 scope/decisions/HITL/review documents, W4 diary/decisions/evidence, and the current W6 integration.
- Compared Pencil MCP nodes `A76Ib`, `DLqSo`, `H4QpB`, `VWaJS`, and back-steel node `zbTc3`. The checked-in preview still lacks the references' controlled specular arcs, deep black dead zone, distinct wheel/Select depth, restrained white-poly hue separation, chromatic glass edge, and directional steel micrograin.
- Grounded renderer findings in `/Users/vinicius/code/agentic-context/three.js` and `/Users/vinicius/code/agentic-context/react-three-fiber`, not recalled APIs.
- Reproduced: device tsc clean; scoped lint clean; 33/33 device tests; repo typecheck 11/11; repo lint clean; repo tests 701/701. `bun run gates` is red (13 automated pass, 3 fail, 2 manual), including an admitted lexical U8 false positive in W4's screen test. A red mandatory gate cannot support approval even where the W4 hit is a harness defect.
- `frameloop="demand"` is correctly present at `packages/device/src/DeviceCanvas.tsx:62-67`; the checked evidence reports zero idle callbacks, consistent with R3F's exact on-demand-rendering contract. Geometry/textures/materials created by `Device` have cleanup effects. No unconditional `useFrame` was found.
- The normalized UV implementation produces `[0,1]` coordinates and the post-fix composite screenshot shows the complete panel. The test name overstates what it proves, however: it checks the normalization formula and extrema, not identifiable TL/TR/BR/BL cap vertices or a directional texture (`packages/device/src/screen-mesh.test.ts:52-77`).

## Findings

### Major — The binding quantitative acceptance criterion fails 28 of 43 stops

The dispatch makes every §4.2–4.5 stop within ±4 the correctness target and says the stop tables remain the acceptance criterion (`dispatch/W4-device-layer.md:17-25`). W4's own final evidence reports only 15/43 passing, RMS 10.13, and worst error 25.19; black wheel and both Select groups are especially far out (`evidence/w4-device-luminance.md:12-25`). The diary repeats that the front profiles remain outside ±4 (`diary/w4.md:162-166`). This is not a soft aesthetic note and cannot be waived by prose saying the preview is improved.

The green unit suite only tests the evaluator's arithmetic; it does not bind the current rendered report to the required values. W4 therefore has a green test suite around a known-red product result. The visual comparison agrees with the numbers: black reads largely flat/muddy, white clips into broad flat white, and wheel/Select separation is materially weaker than `A76Ib`, `DLqSo`, and `H4QpB`.

### Major — Replaying the screen callback silently disconnects W6 transform updates

`createScreenMeshHandle` installs its listener dispatcher by assigning the mesh's single `onBeforeRender` property (`packages/device/src/screen-mesh.ts:210-219`). Three invokes that one property directly (`/Users/vinicius/code/agentic-context/three.js/src/renderers/WebGLRenderer.js:2148-2156`). A second handle for the same mesh therefore overwrites the first handle's dispatcher.

That is exactly the lifecycle W6 documents: R3F may replay the callback ref and create a fresh handle, while the active coordinator deliberately keeps the first handle (`packages/composite/src/CompositeDevice.tsx:154-161`). I reproduced the combined behavior: subscribe through handle 1, create handle 2 for the same mesh, invoke `mesh.onBeforeRender`, and handle 1 receives zero notifications. The existing W4 test creates only one handle (`packages/device/src/screen-mesh.test.ts:125-155`), so it cannot catch the seam failure. Device movement after a replay can leave the HTML panel's hit-testing/focus geometry stale. D-056 needs stable handle identity, replacement/disposal semantics, or an `onBeforeRender` multiplexer that survives ref replay.

### Major — The cover-glass material violates Three's transmission contract

W4 configures glass with `transmission: 0.92` and `opacity: 0.12` (`packages/device/src/materials.ts:181-197`) and applies it as a `MeshPhysicalMaterial` over the screen (`packages/device/src/Device.tsx:437-440`). The exact Three source states: “When transmission is non-zero, opacity should be set to 1” (`/Users/vinicius/code/agentic-context/three.js/src/materials/MeshPhysicalMaterial.js:518-529`). This is not a stylistic recommendation: opacity is being used to work around the transmission buffer, so the shipped sheet no longer follows the physical model the dispatch requires.

The result also misses the Pencil glass treatment: a layered recessed surround, controlled quadrilateral sheen, and cool/warm edge dispersion. Fix the screen/glass composition without putting a non-physical opacity workaround into the transmissive material, and add a live assertion over the instantiated material.

### Major — Required physical recipes were deferred without authority, and the omissions are visible

The dispatch says to use the §12.3 recipes and makes glossy polycarbonate, mirror steel, translucent Select, and cover glass part of correctness (`dispatch/W4-device-layer.md:17-25`). W4 nevertheless records chromatic edge refraction and the steel anisotropy map as deliberately unbuilt (`decisions/w4.md:278-288`; `diary/w4.md:134-142`). These are not speculative fallback variants. The primary design source says directional grain is what prevents steel reading as chrome-plated plastic (`design-system.md:773-787`) and calls two-hue edge dispersion “small, cheap, and disproportionately convincing” (`design-system.md:831-850`). Scalar anisotropy plus isotropic random roughness is not the specified tangent-space grain.

The same gap exists for black plastic: the implementation supplies stock clearcoat/sheen parameters (`packages/device/src/materials.ts:105-117`) but no equivalent for the design's defining sub-surface warmth and controlled specular structure. The current render and 15/43 result demonstrate that these omissions do have acceptance consequences, contrary to W4-D12's premise. Engraved back markings may remain deferred with the expose/B-surface work; this finding does not require clearing that separate non-goal.

### Major — Calibration evidence is nondeterministic

Every device mount builds its roughness map from `Math.random()` (`packages/device/src/textures.ts:95-122`). That map participates in the body, steel, and seam materials being graded (`packages/device/src/Device.tsx:357-378`). The report has values on or near the ±4 boundary, yet no seed, captured texture, variance sweep, or repeatability bound is recorded. Consequently the checked JSON cannot be reproduced bit-for-bit and a rerun can change pass/fail classification.

Use a deterministic PRNG/seed or a checked-in generated texture, then run repeated captures proving the measurement is stable. A quantitative acceptance artifact cannot depend on unrecorded random input.

### Major — W4 crossed its ownership boundary and leaked the workstream ID into implementation artifacts

The dispatch limits W4 to `packages/device/**` and `apps/web/src/routes/[_]spike.device.tsx` (`dispatch/W4-device-layer.md:56-57`). Commit `31d6d71` adds `scripts/w4-apply-rig.ts`, `scripts/w4-rig.json`, and `scripts/w4-tune.ts`; later commits continue modifying those out-of-lane files. No ownership waiver appears in the reviewed decisions.

Those filenames, plus the global `window.__w4` surface (`apps/web/src/routes/[_]spike.device.tsx:133-167`), also encode workstream bookkeeping into executable artifacts. Move calibration machinery behind a product/diagnostic name in an owned tooling boundary, with an explicit ownership ruling if `scripts/**` is intended.

### Minor — The UV test's named corner claim is not actually asserted

`createScreenGeometry` rewrites every cap and side vertex from XY (`packages/device/src/screen-geometry.ts:12-33`). The test checks the same formula and min/max only (`packages/device/src/screen-mesh.test.ts:52-77`); it never locates four front-cap corner samples, distinguishes front from sidewall faces, or renders a directional fixture. The live W6 screenshot is useful behavioral evidence, so this is not another seam blocker, but the deterministic test should match its title and catch rotation/mirroring independently of the implementation formula.

### Minor — The luminance probe description overstates a literal vertical sample

The acceptance evidence should explicitly document its sampling geometry and asymmetry treatment. The probe chooses surface-dependent points and averages mirrored front samples rather than sampling one fixed vertical column. That may be a reasonable occlusion workaround, but averaging can erase the left/right imbalance that distinguishes a convincing key-light response. Preserve each side in the raw report and justify the aggregation against the primary stop-table construction.

## Suggestions

1. Repair the D-056 lifecycle first and add an integration test reproducing R3F callback-ref replay with an already-attached `CompositeCoordinator`.
2. Make calibration deterministic, then treat every failing stop as a gate failure. Do not tune against a stochastic map.
3. Rebuild glass composition within Three's transmission rules and implement the material cues the Pencil comparison shows are missing before another owner preview.
4. Add a render-level directional UV fixture and a report-validation test that fails while any checked-in stop exceeds ±4.
5. Keep the far-light/D-057 separation: its reasoning is documented and per-surface environment gain is applied. It simply has not yet produced the required front result.

## Neuve dogfood feedback

Not run. Repo law states there is no `neuve` shell or board for this repository; inventing that path would conflict with the repository's source-of-truth rules.

## Owner-only gates

- **H-6:** not cleared. Both colourways were inspected, but aesthetic acceptance belongs to the owner and the current quantitative/visual gaps make the preview unready for that sign-off.
- **U14:** not cleared. Phone-in-hand thumb occlusion remains owner-only and was not simulated as approval.

---

# Re-review — correction commits `3bf5215`, `64ac702`, `7df67b1`

## Verdict: REQUEST_CHANGES

**Severity:** 0 Critical · 3 Major · 1 Minor.

The corrections close the replay, transmission, missing-cue, randomness, ownership/naming, and UV-test findings. They do not close W4. The new 8/43 report is not merely red: its endpoint measurements are taken off the rendered surface because the probe and renderer use different silhouettes. The same correction also replaces binding primary geometry and black-material parameters with Pencil-derived values without a lead ruling. The claimed “source conflict” is therefore not established by valid evidence.

## Reproduced verification

- `bun test packages/device`: **41 pass, 0 fail**.
- `bun test`: **859 pass, 0 fail**.
- device tsc: clean; repo typecheck: **11/11 clean**.
- scoped device/route lint: clean; repo lint: clean.
- production build: green. Vite reports one client chunk at 1,176.98 kB (329.58 kB gzip), a warning rather than a W4-specific failure.
- `bun run gates`: **16 automated pass, 0 automated fail, 2 manual outstanding**. U14 remains manual; H-6 is outside this automated summary and remains owner-only.
- Exact framework sources checked: Three `MeshPhysicalMaterial` transmission and anisotropy contracts, Three's shader use of anisotropy-map RGB, and R3F's demand-loop stop/invalidation behavior under `/Users/vinicius/code/agentic-context`.
- Pencil MCP independently read `VWaJS`: 330×552, `cornerRadius: 26`, ordinary circular corner, with a smooth five-stop pearl enclosure fill. This confirms W4-D19's observation, but it also confirms a conflict with the primary prose/tokens rather than silently resolving that conflict.

## Original finding disposition

| Original finding | Re-review result |
|---|---|
| 43-stop acceptance red | **Still blocking; new report is 8/43 and is additionally invalid at silhouette endpoints.** |
| Screen-handle replay | **Closed.** `handlesByMesh` preserves handle identity and subscriptions; the exact replay regression is tested (`packages/device/src/screen-mesh.ts:158-172`, `screen-mesh.test.ts:228-256`). |
| Transmission/opacity conflict | **Closed.** Instantiated glass forces opacity 1 / non-transparent and the T1 captures show the panel through it (`physical-materials.ts:7-29`, `materials.test.ts:76-97`). |
| Missing physical cues | **Closed mechanically.** Steel anisotropy texture, black lower-edge emissive/SSS, and cool/warm glass shader are present and disposed. Their final aesthetic adequacy remains H-6. |
| Random calibration texture | **Closed.** Roughness noise and search use fixed seeded generators; byte stability is tested (`textures.ts:111-132`, `textures.test.ts:8-17`, `calibration/tune.ts:385-403`). |
| Boundary/naming breach | **Closed.** Calibration lives under `packages/device/calibration/**`; the route global is `__deviceCalibration`; initiative-name grep is clean apart from required source citations. |
| UV corner assertion | **Closed.** The test now finds front-cap corner vertices and checks orientation (`screen-mesh.test.ts:97-132`); the flagged T1 images render the complete panel in both colourways. |
| Probe mapping/asymmetry | **Not closed; escalated to Major below.** Raw mirrored samples are now preserved, but surface identity and silhouette agreement are not verified. |

## Findings

### Major — The 8/43 report samples outside the geometry it claims to grade

The renderer no longer uses `DEVICE_LAYOUT.body` for its outline. It hardcodes a 26px circular enclosure (`ENCLOSURE_CORNER_R = 26`, `ENCLOSURE_EXPONENT = 2`) at `packages/device/src/Device.tsx:104-110` and uses it for shell, back, and front geometry (`Device.tsx:246-312`). The probe still computes visibility from the token geometry: radius 33, exponent 4.2 (`packages/device/src/luminance-probe.ts:202-243`, `packages/device/src/layout.ts:124-131`).

At the top body stop with seam 4.2 and inset 3, the probe chooses `x = ±151.729`, `y = 268.8`. The rendered circular front only reaches `x ≈ ±150.036` on that row; a safely inset point would be about `±147.036`. The probe is therefore roughly **1.69 body pixels outside the rendered polycarbonate**. The checked report independently exposes the error: black `--poly-k-0` and white `--poly-w-0` record the exact same measured RGB `[66, 69.5, 72.5]` despite different body materials (`evidence/w4-device-luminance.json:52-63`, `:464-475`). Their bottom endpoints likewise read seam/background-dominated values. Steel endpoint sampling is derived from the same stale silhouette and produces the report's ±105/119-unit outliers.

The readback has no object-ID, depth, raycast, or material assertion proving that a projected point landed on the named surface. A valid calibration must derive targets from the actual geometry and reject a sample unless it hits the expected mesh, preferably using an ID pass or raycast plus a safe interior margin. Until then, neither 8/43 nor the earlier 32/43 is admissible evidence about joint satisfiability.

### Major — W4 silently chose Pencil geometry over binding §7.1/§12.0 geometry

The primary sources conflict. Pencil `VWaJS` really is 330×552 with an ordinary 26px radius; I measured it through MCP. But the design-system explicitly requires a 33/34px **superellipse n=4.2** (`design-system.md:1175-1186`), the typed geometry exports 33 and 4.2 (`packages/device/src/layout.ts:66-67,124-131`), and W4's own tests still claim that the shipped silhouette is that superellipse (`layout.test.ts:94-97,155-168`). The actual renderer bypasses all three with local constants.

Scope classifies both `design.pen` and the design-system as primary, with canvas winning only “where §12.0 says so” (`scope.md:34-42`). No lead/owner ruling in the reviewed decision log resolves this particular contradiction. W4-D19 is an implementer decision, not that ruling. The result is a green geometry test over values the product does not render—the exact “right assertion, wrong reason” failure D-058 forbids.

This requires a lead ruling: either adopt VWaJS's 26px circular outline and update the tokens, probe, tests, §7.1/§12.0 deviation record, and acceptance geometry together; or restore the binding 33px n=4.2 silhouette. Keeping both definitions is not an option.

### Major — “The 43 constraints are not jointly satisfiable” has not been demonstrated

The authoritative stop tables themselves are smooth, piecewise-interpolated curves. Black intentionally falls 64.8→12.9 and rises to 53.6; white traverses only 27 luminance units; steel intentionally oscillates because it reflects a room (`design-system.md:247-325`). Nothing in those finite constraints requires visible row bands. The visibly banded 32/43 candidate proves only that **111 independent row-local normal controls are an invalid model** (`decisions/w4.md:349-364`); it does not prove that smooth macro-geometry, a physically justified light field, or a correctly registered environment cannot satisfy the curves.

The current candidate also changes an exact primary material while making the conflict claim: §12.3 specifies black `sheen 0.15`, `sheenColor #6E4A2E` (`design-system.md:2809-2814`), while product defaults use `0.08` and `#2B313A` (`packages/device/src/materials.ts:105-119`). D-057 authorizes per-surface `envMapIntensity`; it does not authorize replacing the black BRDF to remove bronze. The local test merely asserts the replacement values, so it cannot prove conformance (`materials.test.ts:11-29`).

The correct current conclusion is narrower: the accepted geometry/material model has not yet met the 43-stop gate, and the latest measurement cannot quantify the miss reliably. First fix the geometry/probe mismatch and rerun a bounded smooth model. If valid sampling still shows an incompatibility between exact §12.3 parameters, Pencil material identity, and ±4 at every stop, present that falsified model and its remaining degrees of freedom for a lead ruling. W4 cannot downgrade the binding gate to an aesthetic holdout on its own.

### Minor — The T1 screenshots prove texture orientation, not the full lifecycle claim

`w4-composite-black-t1.png` and `w4-composite-white-t1.png` visibly show T1, complete correctly oriented panel content, and a visible device. They support UV orientation, transmission, and static composition. A screenshot cannot prove that callback-ref replay retains transform subscriptions while the DOM remains interactive after resize/movement. The new deterministic replay test closes W4's producer half, and current W6 tests must remain the proof for the consumer lifecycle; keep the evidence wording bounded to that split.

## Critical question — answer

- **Are the 43 constraints jointly satisfiable with smooth physical materials?** Not disproved. The target functions are smooth by construction; the only near-fit used per-row answer-key normals and is not a valid feasibility experiment.
- **Is the measurement mapping/objective wrong?** Yes, materially. The objective reflects the per-stop gate, but target-to-surface mapping uses stale geometry and does not establish surface identity. Endpoint outliers and identical black/white pixels are direct evidence.
- **Is a binding conflict present?** Yes: Pencil `VWaJS` says circular 26px, while §7.1/tokens/tests say 33px n=4.2; exact black §12.3 parameters also conflict with the regularized candidate. These require a lead/owner ruling before the acceptance contract or geometry is changed.

## Owner-only gates

- **H-6 remains outstanding.** The light-white and dark-black holdouts are smoother and more credible than the banded 32/43 candidate, but aesthetic sympathy cannot replace a valid quantitative gate. Only the owner can accept both colourways after the source conflict is resolved.
- **U14 remains outstanding.** No phone-in-hand thumb-occlusion validation was performed or inferred.

---

# Re-review — commit `b2c0783`

**2026-08-29 · independent antagonistic W4 design/runtime review**

## Verdict: REQUEST_CHANGES — 0 Critical, 3 Major, 0 Minor

Commit `b2c0783` closes the structural parts of D-067, but it does not close W4's
acceptance gate. The saved Pencil component `VWaJS` was independently inspected
through Pencil MCP: it is a reusable 330×552 frame with an ordinary circular
26px corner. That geometry now has one definition in
`packages/tokens/src/geometry.ts:23-35`; `DEVICE_LAYOUT`, all three enclosure
geometries, the route shadow, the probe, CSS parity, and tests consume it. The
exact black BRDF is also restored (`sheen: 0.15`, `sheenColor: #6E4A2E`) and
mechanically pinned (`packages/device/src/materials.ts:105-117`). The retained
model and screenshots are smooth, and the active tuner contains no row-local
normal or per-stop answer-key controls.

Those are genuine structural corrections. They are distinct from the binding
±4 gate: the checked report is candidly red at **6/43**, RMS **16.36**, worst
absolute delta **45.42**, and all **11/11 steel stops fail**
(`evidence/w4-device-luminance.md:12-24`). I independently recomputed the JSON:
43 rows, 6 passes, RMS 16.3554515. The arithmetic and the report's red wording
are truthful. The measurement is nevertheless not admissible as a feasibility
result because the back runtime/probe coordinate frame is wrong and the identity
guard can approve a mesh hidden behind a nearer rendered surface.

## What independently passed

| Check | Result |
|---|---|
| Commit scope | **Pass.** The token/layout edits are the cross-package work D-067 explicitly requires; no composite implementation was changed and the commit has no trailers. |
| Saved Pencil source | **Pass.** `VWaJS` independently measured 330×552, circular radius 26 through Pencil MCP only. |
| Shared enclosure geometry | **Pass.** `BODY_CORNER_R = 26` and `BODY_CORNER_EXPONENT = 2` drive tokens, layout, renderer, probe, CSS and tests. |
| Exact black BRDF | **Pass.** Product defaults and tests contain sheen `0.15` / `#6E4A2E`; Three's checked source exposes both on `MeshPhysicalMaterial`. |
| Smooth-model restriction | **Pass.** Pointwise profiles are zero and not exposed by the active tuner; no answer-key banding is visible in the four retained captures. |
| Device/composite seam | **Pass at the tested boundary.** Focused device/tokens/composite tests are green and the commit does not alter composite source. |
| Performance/disposal | **Pass structurally.** The canvas remains demand-rendered; no `useFrame` or free-running rAF was introduced; memoized geometries, generated textures and materials have cleanup paths. |
| Clean-commit gates | **Pass.** From a `git archive` of `b2c0783`: typecheck 11/11, focused tests 120/120, repo tests 864/864, scoped lint clean, repo lint clean, and production build clean (with Vite's existing large-chunk warning). |

## Findings

### Major 1 — The back view rotates the supposedly viewer-fixed light rig, while the probe samples an unrotated coordinate

`Device` puts both point lights and every device mesh inside the same group, then
rotates that entire group by π around Y for the back face
(`packages/device/src/Device.tsx:511-529`). The key's body-local `+z` therefore
becomes world `-z`, behind the object, and the fill changes left/right as well.
LAW 2 defines the key and fill relative to the viewer, not as lamps bolted to the
iPod. The back capture is consequently lit by a different world-space rig from
the front capture. The existing LAW 2 test checks only parameter signs and ratios
(`materials.test.ts:112-119`); it cannot detect this scene-graph error.

The probe then makes the inverse mistake. Back geometry is rotated into view, so
a local steel point `(x, y, -frontFaceZ)` becomes world
`(-x, y, +frontFaceZ)`. The route instead projects `(x, y, +frontFaceZ)` directly
(`apps/web/src/routes/[_]spike.device.tsx:217-238,272-276`). Recomputing all 11
targets against the actual 168° gradient shows four are read on the wrong
iso-line: stop 0 is sampled at 0.109 instead of 0.000, stop 1 at 0.117 instead of
0.070, stop 9 at 0.883 instead of 0.940, and stop 10 at 0.891 instead of 1.000.
The seven centreline targets happen to have `x = 0`; that does not rescue them
from the rotated light rig.

**Required correction:** keep LAW 2's lights outside the face-rotation group (or
rotate only the device meshes), transform probe targets through the actual device
world matrix before projection, and add a scene-level test proving key/fill world
positions are invariant between front and back. Add a back-target test that
reconstructs the 168° gradient parameter after the face transform. Regenerate
both back captures and all 11 steel readings afterward.

### Major 2 — The raycast “identity” guard can approve a hidden mesh, and it uses unlogged unchecked casts

Raycaster intersections are distance sorted, but the route does not validate the
nearest rendered hit. It searches for the first object whose name starts with
`device-` (`apps/web/src/routes/[_]spike.device.tsx:277-288`), skipping any nearer
unnamed or differently named surface. The scene contains exactly those surfaces:
the unnamed chrome shell, surround, screen and cover glass, plus the
`wheel-label-decal` (`packages/device/src/Device.tsx:542-549,578-594,625-659`).
A pixel can therefore be produced by a nearer surface while the raycast skips it,
finds the expected wheel/body/select behind it, and approves the sample. This does
not meet D-067's requirement that the sampled pixel be confirmed as the expected
mesh with a safe interior margin.

The tests exercise only string matching and the analytic body inset
(`luminance-probe.test.ts:87-142`). They do not build a scene, check the nearest
visible hit, cover wheel/select margins, include an occluder, or exercise a back
transform. The implementation also reaches material identity through unchecked
`as unknown as` casts at route lines 282-284 and 322-329. Those casts are not
logged in `decisions/w4.md`, contrary to the workstream's type law, and they hide
the absence of real `Mesh`/material narrowing at the most safety-critical edge.

**Required correction:** admit only the first visible intersection, with an
explicit alpha-aware rule for the transparent label decal if it must not count;
narrow with Three's real `Mesh` and material types instead of structural casts;
and add a live scene/raycast test containing a nearer wrong-material occluder.
Gate safe margins for body, wheel and Select separately and cover the back-face
world transform. The report cannot claim identity-safe sampling until those
tests go red under the current implementation.

### Major 3 — The red 6/43 result is an implementation/model failure, not evidence of a source conflict

D-067 authorizes smooth geometry, lighting, environment response and the already
approved per-surface `envMapIntensity`. The current search explores only its
selected bounded knobs with random search and shrinking coordinate descent
(`packages/device/calibration/tune.ts:390-466`). It is not a global feasibility
proof. W4-D18 itself says the unresolved shape may require a “new physically
justified macro-geometry/light model” (`decisions/w4.md:349-364`), and the current
front body remains a mostly flat cap apart from the edge bevel. Smooth macro
curvature has therefore not been falsified. More decisively, Majors 1 and 2 show
that the present objective is grading a changed back light rig, four mirrored
steel coordinates, and potentially hidden surfaces.

The only conclusion supported today is: **the current implementation fails the
binding ±4 contract.** The evidence does not establish a contradiction between
Pencil material identity and the source tables, and this review does not waive or
relax ±4.

**Required correction:** fix the rig and probe first; rerun the bounded smooth
calibration; then explore only physically justified smooth macro-geometry,
lighting and environment fields if needed. If a valid report remains red, an
escalation must enumerate the tested smooth model, bounds and remaining degrees
of freedom and show which exact source constraints conflict. A local optimum or
an aesthetically better holdout is not that proof.

## Owner-only gates

- **H-6 remains owner-only and outstanding.** The four captures were inspected
  for gross runtime defects and banding, not accepted aesthetically. Mechanical
  review cannot decide whether either colourway reads as the saved object.
- **U14 remains owner-only and outstanding.** No phone-in-hand thumb-occlusion
  validation was performed or inferred.

---

# Final re-review — commits `2e3442b`, `8a48254`, `9a5507f`, `3a72817`, `b6ac859`, `abb370a`

**2026-08-29 · bounded re-review of the three `b2c0783` Majors**

## Verdict: REQUEST_CHANGES — 0 Critical, 2 Major, 0 Minor

The first two former Majors are structurally closed. LAW 2's lights are now
viewer-space siblings of the rotating model, the route projects body-local
targets through the live model matrix, and the four off-axis steel targets are
mirrored into the viewer-facing 168° frame. The first-hit classifier no longer
searches through nearer geometry; the chrome shell is a real perimeter frame;
the former route-level `as unknown as` material/object casts are gone; and the
runtime boundary uses Three's constructor-set type flags where module identity
can differ. The retained screenshots correspond to the checked candidate and
show no row-local answer-key profile.

The final JSON is arithmetically truthful: 43 rows, 24 passes, RMS
9.4738205886, worst absolute delta 19.9934, steel 10/11. It is still red, and
the front half of that result is not yet a valid D-067 measurement because the
new “smooth” crown is neither smooth in the rendered mesh nor the surface the
probe actually projects onto.

## Former-Major disposition

| Former finding | Disposition |
|---|---|
| Back view rotated the lights and projected untransformed steel targets | **Closed.** `ViewerLitDeviceFrame` keeps both lights outside `device-model`; the model alone flips. Tests pin invariant world positions and the four off-axis 168° targets. |
| Identity guard skipped nearer surfaces and used unchecked casts | **Closed.** `firstVisibleProbeHit` consumes the distance-ordered first contributor, fails closed for unknown transparency, and has an occluder control. The overlapping shell cap was removed. Production probe casts identified in the review are gone. |
| Red result was presented as a possible source/model conflict | **Still blocking, narrowed below.** The report now correctly says 24/43 is red and makes no tolerance-waiver claim, but the retained front geometry/probe pair is not the smooth shared model it claims to measure. |

## Findings

### Major 1 — The retained body crown is a faceted triangulation, and the probe projects a different surface

`applyVerticalCrown()` writes a quadratic z offset only at the vertices already
present in Three's non-indexed `ExtrudeGeometry`, then calls
`computeVertexNormals()` (`packages/device/src/curved-shell.ts:19-36`). It does
not tessellate the front cap into the y-directed surface the equation describes.
The final front cap contains 234 triangles over 232 unique positions; 152 shared
front positions carry discontinuous normals, with an independently measured
maximum split of **30.40°**. The intended quadratic's slope at that worst sampled
row is under one degree. The rendered response is therefore controlled by
Earcut's triangles and hole topology, not by one smooth cylindrical degree of
freedom. The test proves only five scalar equation values and three mutated
vertices (`curved-shell.test.ts:5-33`); it never checks surface tessellation or
normal continuity.

The probe then assumes that equation is the actual front surface. It projects
`frontFaceZ + verticalCrownOffset(y, …)`
(`apps/web/src/routes/[_]spike.device.tsx:225-237`), while the renderer builds a
7px shell with a **5.875px** bevel and clamps the negative interior depth to
0.1px (`packages/device/src/Device.tsx:281-315`,
`packages/device/src/form.ts:64-75`). In Three's checked `ExtrudeGeometry`, the
front lid sits at `depth + bevelThickness`; after the translation, the actual
front reaches z **34.22** while the probe's nominal uncrowned face is z
**29.37**. Independent rays through the eight body targets hit the body **4.83
to 6.73px** in front of the projected point and up to **1.16px** away in y. A
first-hit identity match proves “body”, but it does not prove the intended stop
coordinate on that body.

This violates both halves of D-067: the added degree must be smooth, and the
probe must derive its sample position from the geometry actually rendered. It
also means the apparent 24/43 improvement cannot yet be attributed to a valid
smooth macro-model rather than triangulation facets and displaced sampling.

**Required correction:** build a genuinely tessellated/smooth front surface
whose normals implement the single bounded crown independently of Earcut's hole
triangles; preserve a coherent thickness/bevel invariant instead of allowing
`frontBevel > frontThickness / 2` to trigger the 0.1px clamp; and have the probe
solve or read the actual ray/surface intersection. Add a gate comparing the
accepted hit's body-local x/y/z with the intended stop and a normal-continuity
test over the complete front cap, not a three-vertex fixture.

### Major 2 — ±4 remains the exact acceptance blocker; no source/model conflict is evidenced

The checked report fails **19 of 43** required rows: body black 2/8, body white
4/8, wheel black 2/4, wheel white 3/4, Select black 1/4, Select white 2/4, and
steel 10/11 (`evidence/w4-device-luminance.md:12-24`). The worst body misses are
about 20 units. D-067 did not waive ±4, and neither visual improvement nor a
better failure count substitutes for it.

The trajectory is candid but not a conflict proof. The durable artifact contains
the final 24/43 rows; the intermediate 6/43 → 15/43 → 23/43 → 24/43 checkpoints
are a summary table rather than independently inspectable raw reports. More
importantly, Major 1 shows that the sole new macro-geometry experiment did not
instantiate the smooth surface it claims to test. The evidence therefore does
not falsify the authorized smooth model space and does not establish a
contradiction between Pencil material identity and the stop tables.

**Required correction:** repair the one front geometry/probe defect above,
regenerate the four screenshots and all 43 rows, and keep ±4 literal. If a valid
smooth implementation remains red, preserve each bounded checkpoint and the
tested degrees/bounds as raw evidence. Only then can a residual be classified as
a measured source/model conflict rather than an implementation or local-search
failure.

## Owner-only gates

- **H-6 remains owner-only and outstanding.** The screenshots were checked for
  correspondence and gross banding/faceting only; no aesthetic approval is
  inferred.
- **U14 remains owner-only and outstanding.** No phone-in-hand thumb-occlusion
  validation was performed or inferred.
