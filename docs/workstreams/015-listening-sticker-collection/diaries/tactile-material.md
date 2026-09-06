# Paper construction and material repair

## Authority and references

Read the bounded 3D construction dispatch, the full tactile scope, AGENTS.md, the approved artwork handover, current broad/runtime reviews, and the I3j07 material study. The chosen relative is a folded record-store paper pocket containing silicone-coated release paper and laminated printed vinyl. The reference illustrations explain material construction; they are not measured manufacturing simulations. Verified [Avery’s layer description](https://www.avery.com/custom-printing/resources/what-makes-up-a-label): facestock, protective topcoat, adhesive and silicone release coating have different roles. [Sticker Mule’s vinyl/laminate description](https://www.stickermule.com/uses/weatherproof-stickers) supports retaining a separate protective finish over printed vinyl.

Applied Modern Web Guidance first (`bunx --bun` search and the interactive-content-in-3d-scenes guide), Interface Craft storyboard, all Interface Design Guardrails resources, Neuve Motion, Global Patterns and the existing shared-state conventions. These were previously loaded during the flick dispatch. The HTML-in-Canvas guide confirms the existing DOM/Canvas capability and fallback boundary; this repair does not change the compositor.

Canonical `/Users/vinicius/code/.better-coding-agents/resources/` has no Three/R3F checkout. Inspected pinned Three 0.185.1 PlaneGeometry row-major vertex/UV construction, BufferGeometry vertex-normal and indexed geometry methods, and ExtrudeGeometry face/side material groups. Pinned R3F 9.7.0 owns declarative material disposal; the component explicitly owns and disposes its generated paper surfaces. Existing StudioEnvironment supplies the same lighting to the liner; no new lights or render loop were added.

## Diagnosis

The existing top-right curl showed triangular stair steps in the real desktop open-sheet capture. PackPaper reused the same warped geometry for front, backing and shadow, translating the backing/shadow copies in X/Y/Z. Their changed XY sampling made them intersect the front on the steep corner slope. More subdivisions alone could not fix this geometric intersection.

The sleeve was a single flat shape with overlapping angled strips. It lacked a true exposed paper edge around the thumb notch. Separately, the resting sticker mesh followed the liner's crosswise bow while the peeled print was rebuilt on a flat plane; that allowed partial-peel contact to differ from the resting seat.

## Correction

`sticker-paper.ts` creates a smooth cylindrical corner on a 96×96 grid. It changes only the unprinted top-right XY corner and preserves UVs. The back follows the front surface's normals at a calibrated 0.3 px liner thickness; a closed perimeter connects them. There are no XY-shifted duplicate shadow sheets to cross the curl. Sleeve stock uses the same construction at a stiffer 0.7 px thickness.

The pocket now has a bevelled extruded rim, including the thumb notch, plus shallow raised side/bottom fold seams. The matte paper face, rough exposed edge, waxy liner coat and existing vinyl laminate retain separate responses under the existing studio rig. These are visual analogues rather than measured physical constants.

`conformStickerToPaper` applies the same crosswise bow to resting and partially peeled prints. The stationary adhesive tail and UVs remain identical while the leading edge curls. The normal-sized sheet slots and real rear projection are unchanged.

Preserved the mobile device framing effect. At the collection engineer's request, optional workspaceLowering now lowers only the narrow-screen backing wrapper by 0.72×height×value after detachment. The carried print uses the original origin, so lowering the packet cannot move it away from the pointer. App state/return behavior and shared contract remain collection-engineer owned.

## Verification

Three meaningful geometry tests pass, with 74,789 assertions: finite unit normals and smooth adjacent-normal changes at three physical scales; positive front/back separation and a closed perimeter; unchanged UVs and sheet-seat XY; and identical adhesive-tail contact through partial peeling. The independent runtime reviewer reran these tests successfully and found no new geometry-source blocker.

Package/app typechecks and scoped ESLint passed. Final integrated browser captures under the actual studio rig remain required before material acceptance. The collection engineer owns the build/browser slot; the material source is frozen for that run. No artwork, lights, permanent scheduler, backend, or earning policy changed. No commits made.

## First real-render critique and bounded iteration

Inspected the rebuilt `desktop-open-sheet.png`, `desktop-peel-adhesive-contact.png` and `mobile-open-sheet.png` at normal scale. The intersecting triangular steps disappeared completely. The first cylindrical corner, however, remained too shallow to communicate bent paper without zooming. This was not accepted as sufficient material evidence.

After the build owner released the runner, increased the true cylindrical roll from 0.95 to 2 radians and tessellation from 64 to 96 segments per axis. This exposes the unprinted underside and physical edge, with a 27–32 px peak lift. Tests explicitly require negative corner-facing normals (actual underside exposure), bounded adjacent-normal change and unchanged sticker seats/contact. The lead approved this bounded geometric iteration; no additional lights, fake shine or roughness-only claim was introduced. Final rerender is pending.

## Inserted-corner collision correction

The stronger-corner render made the liner's bend visible on desktop and mobile, with no triangular steps or header overlap. However, inspecting the sealed sleeve exposed a real collision: the static curled corner emerged through the orange pocket face while the liner was still inserted. This was treated as construction correctness, not optional polish.

Curl now remains flat until the full diagonal support band has cleared the sleeve lip. It then relaxes through a smoothstep ramp over an additional 0.75×corner reach. An initial immediate ramp failed the new collision test at an intermediate clearance; delaying onset until full support clearance fixes that case without clamping or tearing the surface. UVs, sticker seats and the rear framing/placement contract remain unchanged.

The new test sweeps four packet widths (180, 265, 320 and 355) and clearance from 0 to 100 px in 2 px steps. Every covered vertex stays behind the opaque pocket face. Fully inserted and fully emerged endpoints are also checked. Final geometry suite: **four tests, 75,001 assertions**. Scoped lint, app TypeScript and diff whitespace checks pass.

Frozen source SHA-256 values handed to the build owner:

- StickerPackScene.tsx: `d1ef9eaa30742986e8a41e299fae5335811dceeba46010c2aa6edbc5947d6d9b`
- sticker-paper.ts: `76cf48506d7c21b8bc1d86b844d7b1bcaea91d5a565c875d5e932a4616279420`
- sticker-paper.test.ts: `c2a7dd8d72cc37d69d060024a5f1d920af4e04367df1185f3fc12fafe6442a2b`

The previously inspected desktop/mobile/open/partial-peel captures established the smooth emerged corner and stationary adhesive contact. The final inserted/intermediate/open rerender must now validate this last clearance correction; the collection engineer owns that runner.

## Final material inspection

Visibly inspected the final rebuilt `desktop-sealed-sleeve.png`, `desktop-open-sheet.png` and `desktop-peel-adhesive-contact.png`. The sealed sleeve has an uninterrupted orange face: the protruding cream diagonal is gone. The emerged liner retains its smooth rolled corner and broad light variation, without triangular steps or title overlap. The partial-peel frame retains the lower adhesive contact while revealing a cream unprinted underside. Earlier phone captures established the same smooth corner at 375 px; the final native suite independently verifies phone interaction and lower-rear exposure.

The verified browser artifact reports source fingerprint `871f4e90be5d81a5b86b6d9f0dbe12f4a9e64318743fac79dffefe0e9cca431b` (374 files), client SHA-256 `97501f768dc225bb8a849d0df8297d630b412986f91b837e890b184b0af6b301`, and server SHA-256 `741ac8d36dd2af2b05668fe2707ac91db06c9649256752300d5a5f2c5c87f189`. The independent reviewer reports 138 native browser assertions passing. The canonical development startup diagnosis is a separate application/runtime lane; this material source is unchanged.

Engineering assessment against the scope's quality facets: tactile continuity 4/5 (stationary adhesive tail and physically separate liner/pocket); collection identity 4/5 (printed fixed-size pocket and full liner); responsive control 4/5 (shared controller and unchanged projected seats); legibility 4/5 (no curl/title collision); restraint 4/5 (existing rig and artwork remain dominant). These are engineering observations, not owner taste approval. At roughly 60 px sticker scale the adhesive underside remains a modest light band; this is a stylized physical representation, not the macro photographic realism of the material-study illustrations. Material construction correctness is accepted for this bounded repair, with independent final feature approval owned by the lead/reviewer.

No material code work remains. No commits or extra test servers were created by this material dispatch. Final evidence lives in the shared `evidence/tactile-collection/browser/` directory so source provenance and native interaction proof stay together.

## Packet protective laminate correction

The post-delivery requirement audit found a real omission: the user requested laminate on both vinyl stickers and the packet, while the broad printed SleevePocket still used MeshStandardMaterial. The earlier material approval established paper/liner geometry and adhesive contact; it did not satisfy that separate exterior-coating requirement. Read the designer's consolidated tactile-design-brief.md and its final bounded finish briefing, current scope, final handover and goal-completion audit before this correction.

Reused the already loaded UI/motion skills: Modern Web Guidance first via Bun, Interface Craft, all four Interface Design Guardrails resources, Neuve Motion and global conventions. The fresh guidance search returned interactive-content-in-3d-scenes, apply-webgl-shaders and visually-texture-content; the existing compositor and demand-rendering implementation remain appropriate. Canonical reference root remains `/Users/vinicius/code/.better-coding-agents/resources/`. Pinned Three0.185.1 sources in MeshPhysicalMaterial.js and ExtrudeGeometry.js establish independent clearcoat roughness and the shared front/back cap group. Pinned R3F9.7.0 lifecycle guidance and prior installed-source inspection establish memoized geometry disposal and borrowed studio texture ownership. Physical-layer references remain Avery's [label layer anatomy](https://www.avery.com/custom-printing/resources/what-makes-up-a-label) and [release liner materials](https://label.averydennison.com/eu/en/home/products/liners.html), alongside I3j07 and the original app handover. These inform the material roles; rendering coefficients are tuned analogies.

The new narrow sticker-sleeve helper builds the same notched extruded pocket, then partitions positive-Z front, negative-Z interior and cut/bevel faces into separate material groups. It does not move vertices, alter UVs or add coincident geometry. The printed front and raised printed folds share a dielectric matte protective coat; the interior and raw edges remain rough paper. Bowed neighboring sleeve exteriors use the same recipe. The liner, artwork textures/alpha, vinyl coat, existing studio rig, mobile framing, workspace lowering, paper curl clearance and peel-contact geometry remain unchanged.

The first coating recipe (.55 coverage, .42 coat roughness) passed five geometry tests and the real 138-assertion browser flow, but a controlled actual-render comparison showed insufficient visual contribution. That iteration was rejected, not reported as complete. Final full coverage with .28 coat roughness gives the phone packet a broad upper-left satin bloom while preserving warm ink and a darker matte raw rim. There is no hard white glare, foil effect or baked highlight. Desktop response is subtler because the packet sits off-axis. The independent reviewer visually accepted the final phone coat/no-coat pair and desktop open scene without requesting expanded geometry or new lights.

Five tests with 77,434 assertions cover material-side ownership, complete nonoverlapping group coverage, unchanged original cap positions/UVs, smooth thin stock, inserted/intermediate curl clearance and stationary partial-peel contact. Package/app TypeScript, scoped ESLint, production build and whitespace checks pass. The native production flow passes 138 assertions; the reviewer independently reran it, then requested one additional screenshot at the existing sealed-phone step. This adds evidence without changing product behavior or weakening assertions. The final independently verified captures and hashes are under evidence/tactile-pack-laminate/coated. The comparison-only no-coat build lives separately, with its own source identity and explicit inactive-coat-roughness difference. Its frozen snapshot excludes secrets and never changes shared production source.

Final source fingerprint: `78f9687938df885fef966c105f25b3a8c6498b5bf1c8fcec2a232598ea6c511e` (376 files). Source hash inventory, build/test logs, normal-scale images, comparison measurements and exact commands are in evidence/tactile-pack-laminate. Older collection evidence was preserved; redundant calibration captures are removed. No commits were made by this lane.

The final independent run passed all 138 native assertions on the recorded fingerprint, and the independent reviewer accepted the source and visible coating. This correction closes the literal packet protective-coat gap. It does not claim photorealism or owner taste approval. Earlier optical limitations remain: small adhesive underside, subdued locked captions, compact collection-counter placement and shallow neighboring-pack visibility. The final object is still a printed folded paper pocket with a protective matte exterior, a separate release liner and laminated vinyl.
