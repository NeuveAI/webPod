# LCD and cover-glass parity investigation

Read-only CPU009 follow-up to `gpu-native-visual-review.md`. I inspected both retained Silver/light images at their original1320×2868 capture dimensions, then current application and installed Three0.185.1/Fiber9.7.0 sources. Native has a flatter/darker LCD background and reduced broad lower-screen modulation. The exact cause is **not yet established**. No application edits, browser action, build, brightness compensation or quality change was made.

## Reference validity comes first

The bottom controls in GL are consistent with the separately established CSS `:has([data-sticker-stage])` branch. `StickerCollection` returns null outsideT1 (`apps/web/src/sticker-collection.tsx:533`), whereas its T1 wrapper exists even when rear UI is hidden. This makes capability/context state a necessary capture qualifier. It does not prove the screenshot used another optical implementation.

`packages/composite/src/CompositeDevice.tsx:153` mounts a device only when `tier==='T1' || contextLost`; there is **no T2 alternate device/glass shader** in this branch. Context loss publishesT4 with `contextLost:true` (`tier-store.ts:45`) and retains the canvas for restoration while the sticker wrapper disappears. An old/unsettled/restoring canvas therefore must not be treated as a matched fully active GL reference. A complete visible screenshot alone does not reveal that state. Switching worker to GL can also expose the document-global capability snapshot, which is shared with StickerCollection.

Before recapture, read the existing settled snapshot without re-probing:

```js
const {getCompositeTierSnapshot}=await import('/@fs/Users/vinicius/code/webPod/packages/composite/src/tier-store.ts');
const s=getCompositeTierSnapshot();
({tier:s.tier,reason:s.reason,contextLost:s.contextLost,
  report:s.report&&{tier:s.report.tier,tierReason:s.report.tierReason}})
```

This getter lazily resolves only if uninitialized; an already settled route returns its existing atom. Capture root `data-composite-tier`, `data-composite-ready`, `data-renderer-requested/effective/failure`; canvas count, dimensions/rect and existing engine/warm/backend/raster dataset; restoration-status presence; `[data-sticker-stage]` presence; finish, orientation, device-reveal phase, matching Panel content and settled paint. RequireT1, no context loss/failure, current warm readiness and equal Panel state for an optical pair. Do not add a debug global or invoke `refreshCompositeTier` merely to inspect the old evidence.

## Source paths that do match

- `device-assembly-materials.ts:44–46` uses the same coverGlass params and separate screenStudio texture for GL and nodes. `materials.ts:224–241` is black diffuse, opacity0.2, transparent, transmission0, roughness0.08, clearcoat1/roughness0.06, envMapIntensity1.1. There is no intentional native opacity reduction or different finish parameter.
- GL `renderer-defaults.ts:21` and native `device-render-worker.ts:52` explicitly choose AgX/exposure1. Fiber initially defaults to ACES (`events-*.esm.js:15903`), but DeviceCanvas's onCreated applies the authored override. Claiming an ACES-versus-AgX mismatch from Fiber defaults would be wrong.
- `product-studio.ts:19` creates the same close screen accent, dimensions/radiance/orientation, in addition to the authored diffusion cards. Both `StudioEnvironment.tsx:85–88` and `render-backend-services.ts:92–98` request body and screen rooms with the same sigma. Installed GL/node PMREM both default near0.1/far100, use GGX mip filtering plus initial sigma blur, and return CubeUV maps. The accent atz50 is not omitted by different default clipping. Cube-face sign arrays differ between implementations; they belong to each backend's matching cubemap convention and are not alone evidence of an inversion bug.
- Node `MaterialProperties.js:21–24` uses explicit material.envMapIntensity when a map exists, matching the GL effective-intensity rule. Scene intensity0.2 is not an extra multiplier crushing the native glass.
- Direct card port `physical-material-nodes.ts:33–51` has the first-two actual light identities, key-view axes, width/height×1.6 and power÷2.56 matching `physical-materials.ts:122–145`. Installed `LightsNode.js:320` adds `lightNode` to the call, so that identity test is reachable; its absence from RectAreaLightNode's initial data object is not a missing-field bug. Worker creates the same ordered key/fill/rim recipe and initializes LTC textures.
- Both LCD materials disable tone mapping. GL HTMLTexture usesRGBA8 plus explicit Three sRGB EOTF (`html-in-canvas.ts:403`); native usesNoColorSpace rgba8unorm storage with one explicit matching EOTF (`lcd-material-nodes.ts:9`). Native copy destination declares sRGB/nonpremultiplied and applies the equivalent Y reflection (`native-element-image.ts:81–116`). Formula agreement is not proof that experimental native upload and HTMLTexture deliver the same bytes.

## Concrete remaining boundary and correction criteria

The feasible corrective boundary is the **existing native LCD upload/material and screen-environment/card port**, not chassis geometry or arbitrary light tuning. These are separate testable alternatives:

1. Verify matching unoccluded LCD source texels/appearance first on the existing route under a temporary, tightly scoped capture approved by lead. Hold Panel state, tone, raster density/frame and color metadata equal. If raw native paint or the isolated LCD differs, inspect `native-element-image.ts`/`lcd-material-nodes.ts` against installed GL RGBA8 upload. A correction must restore exactly one decode and the correct source/destination color/alpha convention. No brightness multiplier. Do not modify glass to hide a raster discrepancy.
2. If LCD agrees before glass, compare **screen** PMREM capture and sampled directions/roughness against GL, including the close accent; then direct card-only contribution. Candidate source is `render-backend-services.ts` or `physical-material-nodes.ts`, with `product-studio.ts` read-only canonical input. The screen room intentionally differs from body room, so body parity does not prove the accent path. Inspect actual generated node shader/uniform matrices and PMREM readback, rather than changing the authored card radiance or opacity. Preserve material side, clearcoat BRDF, alpha blending and output encoding order; Three GL shader applies tone/output conversion before framebuffer blending, while node renderer output-target behavior must be verified for the actual canvas configuration.
3. Recompose unchangedLCD+glass with the corrected transfer/reflection path and recapture the same settledT1 Silver and Black fronts plus a modest tilt. A still front can miss view-dependent reflections. Compare non-text LCD regions and highlight shape independently of text antialiasing. Exact renderer-byte equality is not assumed across APIs, but a missing broad reflection or systematic field darkening requires explanation.

No confirmed single source defect emerged from this bounded inspection. The existing visible discrepancy is real in the retained images, but degraded/unsettled GL reference state remains a plausible confound requiring the scalar check above. It is therefore unsafe to select a compensation patch. Full native visual activation remains pending the equivalent-tier capture and causal isolation; prior numerical material tests and independently approved source slices do not override this gate.

## Follow-up: healthy T1 and PR5 optical provenance

Lead's `/tmp/webpod-gl-capability-meta.json` now establishes actual GLT1, contextLostfalse in both existing root and authoritative snapshot, composite-readytrue, source-statepainted, warmready,960×720 LCD atdensity3 and1320×2664 backing. The missing sticker stage is accompanied by a real artwork-load failure on the rear, which Haptics is investigating independently. **Tier downgrade/context loss is not supported for this capture and must no longer explain away the optical difference.** This corrects the prior unresolved confound; it does not establish that artwork failure changes LCD shader math.

Compared exactPR5 `4cc7f4a` to currentHEAD with `git diff`, without building:

| Surface | PR5→HEAD result |
|---|---|
| physical-materials.ts, materials.ts | Byte-identical: authored GL glass shader/card enlargement and material parameters unchanged. |
| product-studio.ts, StudioEnvironment.tsx | Byte-identical: both reflection rooms, accent, PMREM sigma/intensity and installation unchanged. |
| renderer-defaults.ts, light-rig.ts | Byte-identical: AgX/exposure and authored light inputs unchanged. |
| front-surface.ts, surface-layout.ts, form.ts, device-envelope.ts, screen-geometry.ts | No changes in this range; optical positions/dimensions canonical inputs unchanged. |
| packages/panel/src | No changes in this range; Panel styling/content renderer unchanged. |
| ViewerLitDeviceFrame.tsx | Ordered key/kick/rim JSX extracted to device-light-recipe.ts, retaining the same positions, aim equations, area/power, color and dimensions. |
| Device.tsx / new assembly recipe/material factory | Substantial preparation/hierarchy extraction, not byte-identical. Prior createCoverGlassMaterial(withStudioEnvironment(params,intensity),studio.screenTexture) now calls the same factory with equivalent explicit-intensity fallback and screenStudio input. LCD screenDefaultMaterial remains identical and the live compositor still replaces it. Glass geometry recipe/position is extracted unchanged into prepared inserts/shared recipe; this remains covered by prior independent geometry/assembly evidence, not a new pixel proof. |
| html-in-canvas.ts | Only existing DOM fit code extracted into shared fitPanelContentToFrame; same frame/scale. The transformOrigin assignment is now unconditional. HTMLTexture upload/material EOTF code unchanged. |
| DeviceCanvas.tsx | Motion authority/semantic orientation subscription/bridge added. Same Canvas GL settings, onCreated renderer defaults, StudioEnvironment and optical framing inputs. |
| bun.lock | Only @webgpu/types added; pinned Three/Fiber runtime versions unchanged. |

The exact production PR5 archive is therefore a faithful **original authored GL optical reference**, preferable to guessing parameters from an unhealthy current sticker readiness state. It is not byte-identical full currentGL execution: factory/preparation/pose integration changed. Compare the archive to both currentGL and native with equal settled front pose, finish/room, viewport/DPR, Paneltone/content and actual T1 state; archive-versus-currentGL also tests the supposedly exact extraction. Provider counts may differ; use matching non-text areas rather than claiming whole screenshot equality. No new baseline build was run by this reviewer.

### Minimal next isolation without a QA UI

First record the existing Panel's computed background/gradient/opacity and actual raster metadata alongside the three matched screenshots. This is standardDOM inspection only; computedCSS is not raster output and cannot establish native upload parity by itself.

If the field mismatch remains, the smallest causal experiment is one bounded readback at the **existing renderer-owned texture boundary**, not a brightness change or duplicate Panel. With lead authorization for temporary instrumentation, use each installed renderer's standard `copyTextureToTexture`/render-target and `readRenderTargetPixels` (GL) or `readRenderTargetPixelsAsync` (WebGPU) APIs to retain a small set of rawLCD texture samples/fullframe before cover-glass composition, preserving the texture's actual color-space metadata. Keep this local to the existing owner, return/save only diagnostic pixels/scalars through the established diagnostic capture procedure, remove instrumentation afterward, and do not add a global or route. Native ElementImage has canvas-lineage restrictions, so do not assume an unrelated2Dcanvas can draw it as a shortcut. A DOM element screenshot of the canvas subtree is likewise not guaranteed to exclude glass.

If raw uploads agree, repeat one rendered frame with only the existing cover-glass contribution isolated through a temporary owner-local material/visibility change and immediately restore it. This uses the same route/scene/resources, noQAUI and no permanent behavior change. Compare glass-only reflected accent/gradient and standard composition, then inspect PMREM/card/output-alpha handling. Exact API signatures/capabilities should be rechecked against installed sources when implementing that temporary readback; this note authorizes no new instrumentation. The current read-only evidence selects the boundary, not a patch or root cause.

## Matched production pair: discrepancy survives healthy baseline

Independently viewed and retained the new unmodified pair under `evidence/gpu-worker/visual-front/production-matched/`, including original metadata and SHA256 manifest. Baseline is exactPR5 archive4cc7f4a, clientindex-B26XPa1g; native is exactCPUfixesa822fec, clientindex-CC2h7_xA. Both images show Silver/white device, light room, front pose, Music with112Playlists/271Artists/461Albums/2726Songs/6Radio, the same selection and top-right controls. Metadata confirms bothT1/composite-ready, front0/0/0, backing1320×2664 and render-warmready. Baseline additionally records painted960×720density3LCD and stickerstagetrue; native recordsworker-webgpu/worker, placed0. Native's compact metadata does not itself repeat the rawLCD dimensions, so do not invent that additional scalar equality.

The optical discrepancy persists against this healthy original productionGL reference: native's LCD field is visibly darker and more uniform, with flatter header/blue-selection treatment and missing/subdued broad lower-screen reflection/gradient. Baseline's LCD background has visible spatial modulation. Chassis silhouette, aperture/bezel, wheel/Select location and broad metal appearance remain closely matched at screenshot scale. This is not a claim of bitwise geometry or full-material equality. Matching content and top controls remove the earlier loading-count/control-position confounds for this pair. A non-T1 baseline or currentGL artwork failure cannot explain this matched result.

Disposition: the native LCD/glass parity issue remains a real activation blocker, while its exact raster-versus-optics cause is still unproven. The next smaller isolation proposed by Haptics—capture actualGL/native glass material/environment/light binding scalars before texture readback—is appropriate. Source formulas alone have not established that the real render instance carries the intended screenStudio map/card references or intensity. Preserve original physical parameters; no brightness compensation. If live bindings match, proceed to the existing-owner LCDtexture/readback versus glass contribution boundary above.

Baseline warmup took much longer on this reload (supervisor reported complete by approximately87s); neither image nor these scalar snapshots measures startupperformance. CPU6 remained selected, but no speed or instrumentation-health conclusion is derived from that coarse observation. No app/browser/build action by this reviewer.
