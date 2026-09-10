# Mobile graphics: static diagnosis and trace mapping

Read-only V3 inspection on 2026-09-10, source HEAD `f4420ac6ce8f9cce15cd6bb0f9bc15d78f7e833d`. No application edits, browser control, live instrumentation, build, or deployment. Read runtime-review checklist and fundamentals. Library behavior grounded in installed Three 0.185.1 and Fiber 9.7.0 sources; no corresponding reference checkout found in the required resources root. The source HEAD is not yet independently matched to the production bundle.

User scenario: production tab under Chrome 6x CPU throttling with iPhone 16 Pro Max 440x956 emulation. This is not a measurement of a physical iPhone/JSC. Trace evidence pending. All work counts below derive from loops/constants, not fabricated timings; there are no measured HIGH/CRITICAL findings yet. MEDIUM means a concrete bounded expense worth correlating to trace, not an established bottleneck.

## Ranked candidates

### G1 — MEDIUM: per-update sticker geometry and collision passes

`packages/device/src/StickerPackScene.tsx:356` runs a synchronous layout effect whenever peel, pull, transport, landing, orientation, and other listed dependencies change (`:476`). It builds temporary base/rear/free/landing geometries at `:360`, `:369`, `:389`, and `:399`; iterates all positions at `:429`; then sets buffer dirty, computes normals and bounding sphere, disposes temporary geometries and invalidates at `:471`. `packages/device/src/sticker-surface.ts:6` fixes the surface grid at 96 subdivisions: 97x97 = 9,409 grid positions and 18,432 grid triangles before any ancillary geometry. `packages/device/src/sticker-free-carry.ts:250` clones the source geometry for a grabbed peel.

Conditional collision work is materially larger than scalar/vector micro-allocations: `sticker-free-carry.ts:83` can cast once per moved vertex during free carry; `:59` can cast twice per vertex while docking. `StickerPackScene.tsx:454` and `:460` select these paths. Fully lifted free carry has an explicit bypass at `:460`, and stationary points are skipped at `sticker-free-carry.ts:88`; do not attribute those collision loops to all sticker frames. Surface projection construction (`sticker-surface.ts:72`) has wrapped/cap shortcuts plus a ray fallback, so “9,409 shell raycasts every frame” would be false.

Boundedness: one current carried geometry plus a bounded number of temporary geometries; disposal exists. This is allocation/CPU work, not a proven retained-memory leak. Likely trace symbols: `PeelingPrint`, `createStickerGrabPeelGeometry`, `createStickerPeelGeometry`, `constrainStickerFreeCarry`, `constrainStickerLanding`, `computeVertexNormals`, `computeBoundingSphere`, `Float32BufferAttribute`, minor GC. Falsify as cause for a slow action if no carried sticker is mounted or these stacks do not appear. Candidate repair, only after profiling: reusable fixed-topology working buffers and reduced repeated constraint/normals work, preserving physical contact checks.

### G2 — MEDIUM: cached BVH still performs complete mesh inspection per query

`packages/device/src/sticker-visibility.ts:25` calls `content.updateWorldMatrix(true,true)`, traverses every content descendant, allocates a Matrix4 per eligible mesh, composes local ancestor transforms, and builds a string identity using joined matrices/material arrays (`:38–44`). `update` runs this inspection before the cache-hit return (`:70–75`). Hence warmed BVH avoids rebuilding triangles but does not avoid traversal/identity allocation. `stickerVisibilityQuery` refreshes this at `:8`; `StickerPackScene.tsx:130` begins it even before checking equipped stickers, and `:203` does it for contour requests. Carried collision also calls it at `StickerPackScene.tsx:455` / `:462`.

Boundedness: one collider, one pending worker, WeakMap identities, disposal and worker abort at `sticker-visibility.ts:90`; changing assembly replaces the old collider. Worker build fallback remains synchronous when a query arrives before preparation (`:75`), a plausible isolated first-interaction stall, not necessarily steady-state cost. `sticker-collision-preparation.ts:27` clears timer/listener and terminates worker on finish; `:37` copies attributes on main thread before transfer.

Trace symbols: `inspect`, `updateWorldMatrix`, `traverse`, `Matrix4`, `join`, `createStickerCollision`, `collisionWorkerFaces`. Candidate repair: explicit collision-relevant revision/invalidation, but must preserve position-buffer version, visibility/material changes, and control travel correctness. An unchanged camera/pose alone is already excluded from the actual BVH identity.

### G3 — MEDIUM: detailed picking before input admission

`packages/device/src/StickerPackScene.tsx:136` raycasts both physical body shells, sorts their complete hits, then tests placements in reverse order (`:149`). `packages/device/src/sticker-hit.ts:18` creates a temporary Mesh borrowing geometry/material, invokes full mesh raycast, and alpha-filters the returned hits. The meshes retain default Three triangle raycast; the custom collision BVH is separate and does not automatically accelerate this path. Front/rear shell construction is detailed (`Device.tsx:291`, `:308`, bevel segments `:343`) and memoized, so geometry building itself is not repeated for ordinary orientation.

Installed Fiber `dist/events-*.esm.js` `intersect` calls `state.raycaster.intersectObject(obj,true)` for eligible event objects; pointer move first filters to hover/move handlers. The body has hover handlers for rotation, so “frameloop demand means no pointermove raycasting” is false. Touch-band projection math in `Device.tsx:889` happens only after raycast admission; it is a small, bounded addition rather than the full picking cost.

Boundedness: scan proportional to current scene/placement count, temporary intersections/probes collectible. Native capture ordering preserves stickers over shell; any simplified proxy must preserve holes, curved edges and visible-hit semantics. Trace symbols: `intersectObject`, `Mesh.raycast`, `_computeIntersections`, `checkGeometryIntersection`, `intersectTriangle`, `pick`. Need compare pointerdown versus drag and sticker versus wheel windows; no measured dominance yet.

### G4 — MEDIUM: DOM panel mutation can request upload before and after paint

`packages/composite/src/html-in-canvas.ts:141` measures native panel grid, calls requestPaint, and when a prior record exists also marks HTMLTexture dirty and invalidates. Its paint callback repeats fit/measurement and dirty/invalidate (`:189–199`). Resize also invokes the fit twice (`:167–169`). Mutation observation includes all attributes/subtree/text; only the panel host's own style is filtered (`:336`). This proves multiple invalidation opportunities per changed panel, not necessarily multiple GPU uploads: Fiber may coalesce requests before one frame and the browser paint timing matters.

`measurePanelElement` reads scroll/offset dimensions (`:350`); CSS writes precede later layout reads. A forced synchronous layout claim needs a trace stack; it is not proven by this pattern alone. Installed Three `src/renderers/webgl/WebGLTextures.js:1257` maps HTMLTexture updates to `texElementImage2D`, not ordinary `drawImage`. Parent panel is already attached, so Three's branch that creates its own paint handler is bypassed; do not count a speculative duplicate Three callback.

Boundedness: one panel texture, observers/listeners disconnected and resources disposed in `html-in-canvas.ts:242–275`. No polling loop here. Root-style changes caused by InteractionManager are intentionally ignored, preventing an obvious orientation/style mutation feedback loop. Trace symbols: `requestPixels`, `fitPanelToNativeGrid`, `measurePanelElement`, `requestPaint`, paint event, `texElementImage2D`, `RecalculateStyles`, layout. Likely more relevant than sticker geometry to wheel/menu-only slowness. Candidate repair: coalesce actual pixel updates and keep geometry sync independent, only if trace shows redundant work.

### G5 — MEDIUM: fixed DPR quality multiplies rendered pixels

`packages/device/src/pixel-density.ts:13` caps device DPR at 3 and `:35` takes the larger valid physical box/browser DPR. `CanvasPixelDensity.tsx:27` applies it; DeviceCanvas uses antialiasing and physical materials. At an actual DPR of 3 the drawing-buffer pixel count is 9 times the CSS canvas area. That is an arithmetic upper configuration, not a captured buffer measurement or 9x measured time. Increased mobile body size also increases shaded body coverage; the framebuffer's CSS dimensions remain stage-sized.

There is no adaptive quality loop tied to slow frames. Whether GPU fill/shading/upload is limiting requires renderer/GPU/compositor trace evidence; Chrome CPU throttling is not equivalent to a mobile GPU benchmark. Do not recommend reducing DPR as a CPU-raycast fix without evidence. Possible quality tradeoff: bounded device density setting/adaptive cap with LCD sharpness verification.

### G6 — LOW/MEDIUM: orientation diagnostics and transform mirroring

`packages/device/src/DeviceCanvas.tsx:279` runs projection diagnostics on every changed orientation, calls a full content world-matrix update (`:283`), allocates eight box corners plus bound/metrics, and writes several canvas dataset strings. This is included in production, not gated DEV. Three's normal render will also update the scene; these calls guarantee between-frame freshness, but the diagnostics traversal is potentially avoidable production work.

`packages/device/src/screen-mesh.ts:248` checks the matrix before constructing a transform, so it does not allocate/read on every idle render. On actual orientation it creates a matrix/corners at `:180–211`, and `html-in-canvas.ts:212` applies the interaction matrix and clip datasets. Installed `three/examples/jsm/interaction/InteractionManager.js:129` updates one proxy and writes CSS matrix3d at `:206`. Bounded by one screen. Trace should distinguish full scene traversal versus this four-corner screen work before optimization.

## Exonerated or situational paths

- `DeviceCanvas` is demand-rendered. `DeviceRenderWarmup.tsx:42` registers a useFrame callback but schedules only the bounded warmup frames after compile; it does not independently keep idle rendering alive. Cleanup cancels the initial rAF and zeroes frame count (`:35`).
- `camera-fit.ts:150` scans 360 yaw x 97 pitch = 34,920 sample orientations / 279,360 corners with per-sample Euler/orientation-array allocation. However `DeviceCanvas.tsx:250–261` reruns fit only for viewport/envelope/options changes, not device pose. Treat as startup/resize candidate, not a wheel or steady orientation frame bottleneck.
- Device geometry and procedural maps use memo plus disposal (`Device.tsx:243–259`, `:291–306`). Large setup work is not evidence of repeated hot-path work.
- Sticker texture cache entries are removed and textures disposed when last subscriber leaves (`sticker-texture-cache.ts:49–55`); stale completed loads are disposed at `:25`. No historical URL accumulation established.
- Collision identity WeakMap and screen handles keyed by mesh do not alone prove memory retention. Closure-sharing claims require a retaining path/heap evidence; no engine-specific scope/GC timings are asserted.

## Checklist coverage / limits

Reviewed module caches, transient map/array/string allocations, geometry/texture disposal, worker Promise/timer ownership, event/observer cleanup, and render scheduling in this graphics vertical. No JSON round-trip clone, unbounded Promise.all fan-out, or uncapped active graphics resource cache demonstrated. Server timer unref, Effect fibers, and query/atom-family audits are outside this bounded graphics assignment and belong to other verticals. No heap snapshot or GPU measurement was collected by this agent.

Awaiting supervisor trace hotspots to upgrade/downgrade these hypotheses and match production minified functions to verified source locations. No changes are recommended as urgent based on static inspection alone.

## Supervisor trace/DOM correlation: idle marquee (subsequent evidence)

Supervisor reports live production DOM drawing buffer **1320x2664** for a **440x888 CSS canvas at DPR3**, exactly **3,516,480 drawing-buffer pixels**; LCD raster **960x720**, exactly **691,200 pixels**. These are measured dimensions conveyed by supervisor, not locally instrumented by V3. Supervisor's trace UI shows sustained `wp-title-marquee` animation / rAF / paint between sparse input. This elevates G4's ongoing animation-to-full-render path over sticker-only candidates for that observed idle interval. No exclusive CPU milliseconds or GPU timings have been supplied here.

Verified source chain:

1. `packages/panel/src/panel.css:165` enables infinite `wp-title-marquee` for an overflowing active title; duration/delay are 12s/2s at `:46`. Transform keyframes at `:247` include movement and stationary holds.
2. The CSS animation does **not** require JavaScript per-frame text updates or DOM mutations. The browser's HTML-in-Canvas paint events are sufficient; do not incorrectly blame MutationObserver for initiating every CSS frame.
3. `packages/composite/src/html-in-canvas.ts:189` accepts panel-related paint, remeasures at `:193`, marks the HTMLTexture dirty and calls `screen.invalidate()` at `:198–199`. `paintTouchesPanel` also accepts empty/missing changedElements lists (`:361`).
4. `packages/device/src/screen-mesh.ts:232` forwards to Fiber's invalidate. Installed Fiber events ESM `:16221` sets pending frame count to one (or two during a frame) and requests its loop when stopped. **Repeated invalidations coalesce; there is no ever-growing frame queue.**
5. Fiber's `update` calls `state.gl.render(state.scene,state.camera)` at installed events ESM `:16171`. With this integration there is no LCD-only WebGL redraw; every admitted scheduled render runs the entire scene path. “Demand” means no render without demand, not no demand while an animated title remains visible.
6. Installed Three `src/renderers/webgl/WebGLTextures.js:1257` uploads the dirty HTML element through `texElementImage2D` when used by the screen material. The model, lighting/material draw submission and drawing buffer remain part of the scene render even though only title pixels changed.

**Established:** the source has an indefinite active-overflow CSS animation, the supervisor observed it in the interval, and every admitted paint requests a full scene render through this chain. This is bounded persistent work, not a memory leak. **Not established:** exact paint-to-render frequency, duplicate uploads per visual frame, exclusive CPU share of texture upload versus scene traversal, actual GPU cost, or equivalence to a physical phone. The animation's held keyframe portions may be optimized by the browser; do not claim every refresh in every part of the 12s cycle necessarily repaints.

Highest-value next comparison, if authorized separately: a controlled run with the same stationary device/title where marquee motion is temporarily disabled, compared against the unchanged run. That isolates continuous title animation from user gesture cost before quality or geometry changes. No such mutation was performed by this read-only agent. A subsequent implementation could bound/pause marquee motion or introduce a cheaper screen-update path, but any visual/behavioral tradeoff should follow the measured comparison. Simply memoizing React or optimizing sticker geometry would not stop this browser-paint → full WebGL-render path.

## Native CPU profile and exact production bundle mapping

Read supervisor/reviewer artifact `docs/research/performance/evidence/performance/native-trace-summary.json` from `/Users/vinicius/Downloads/Trace-20260910T222915.json.gz`, and matched minified function bodies in `/tmp/webpod-production-bundle.js` (`src-B2IO_406.js`). The following are **aggregated sampled CPU-profile values from that artifact**, not event delay, per-call timing, GPU timing, or extrapolated unthrottled performance. Inclusive values overlap; never add parent and child totals.

| Trace location (displayed line:column) | Verified implementation | Profile evidence |
| --- | --- | --- |
| `Jy`, 4119:14859 | Fiber render loop: schedule next rAF, render active invalidated roots, cancel next rAF when no work | 1062.40ms inclusive sampled |
| `Hy`, 4119:14396 | Fiber update: subscribers then `gl.render(scene,camera)` | 903.90ms inclusive sampled |
| `render`, 4108:31590 | Three WebGLRenderer.render | 901.31ms inclusive sampled |
| `bt`, 4108:39960 | Three WebGLRenderer setProgram/material setup | 445.33ms inclusive; 32.16ms self sampled |
| `ft` / `mt` / `ht`, 4108:34678 / :36460 / :36692 | renderScene / renderObjects / renderObject | nested render work; do not sum |
| native `texElementImage2D` | HTMLTexture upload API | 208.02ms self sampled |
| anonymous, 4108:77318 → `r`, 4108:74222 → `s`, 4108:74461 | Fiber pointer handler → intersect → intersectObject | 323.87ms / 298.90ms / 295.99ms inclusive sampled, nested |
| `Eo`, 1:167807 / `Do`, 1:168096 | Three Mesh checkIntersection / checkGeometryIntersection | 27.37ms / 22.48ms self sampled |
| `update`, 4201:392076 | Three InteractionManager.update | 26.69ms self sampled |
| `s`, 3671:10663 | Three WebGLBindingStates setup | 29.76ms self sampled |
| `Lm`, 4006:1629 / `Km`, 4006:3164 | Three WebGLUniforms arraysEqual / matrix4 upload cache | 18.32ms / 13.37ms self sampled |

This gives direct CPU evidence for **both full-scene rendering and detailed Fiber triangle picking**, upgrading G3/G4 from purely static suspects to observed work in this trace. It does not by itself show either path caused a specific input's presentation delay; reviewer is mapping input-window stacks separately. The shown raycasting is Fiber's event route, not automatically the native saved-sticker `pick` or the custom collision BVH. The 9,409-node peel path (G1) is therefore still conditional and must not be claimed the recorded raycast source without a matching stack.

Native requestAnimationFrame (82.14ms), cancelAnimationFrame (143.02ms), and clientWidth (64.94ms) self samples are also reported. The exact `Jy` body confirms that frequent start/stop demand scheduling can contain rAF/cancel calls; parent stacks are needed to assign each native node. Native getter time can include browser work, so a 64.94ms aggregate is not a standalone getter cost or proof all calls are from the panel. InteractionManager has clientWidth/height reads; marquee measurement also has a root.clientWidth read. Neither alone should be assigned the whole aggregate without parent evidence.
