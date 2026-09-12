# Picking lane

Implemented after reading responsiveness-scope.md. No new dependencies, unit tests, commits or deployment. Library behavior inspected in installed Three 0.185.1 Mesh.raycast / Object3D transforms and Fiber9.7 pointer event dispatch. Scope ownership: Device.tsx, orientation-picking.ts, sticker-pick-cache.ts and StickerPackScene picking. PackPaper hook + initial visibility/carry readiness integration coordinated with worker owner. PeelingPrint was handed to worker owner for full atomic worker extraction; its final implementation/checks belong to that lane.

## Changes

Physical front/rear rendered meshes remain unchanged and retain their exact default raycast for sticker admission, occlusion and calibration. Separate invisible **orientation event meshes** own the existing orientation handlers. Their broad phase rejects a ray only when both ends of its full enclosure-depth segment lie strictly inside a conservative inner rectangle. Convexity proves the whole segment cannot reach the outer grab band. For fine input the rectangle is inset by max(18 model units, corner radius); for touch by the maximum width/4 band permitted by existing foreshortened grab logic. Uncertain edge-on, corner, boundary or control-hole rays fall back to the real rendered shell's exact raycast. Ray hits retain point/UV/face/depth, redirecting only event object to its co-located proxy. Sorted intersections and control stopPropagation still determine ownership. Proxies are invisible and are rejected by visible-geometry probe/collider inspection.

Touch keeps a deliberately conservative large band: many outer clickwheel positions and rotated rays still run exact shell raycasts. This is not complete ray elimination. The detailed front mesh contains169,367 triangles under current factory settings, which explains why rejecting even a subset is useful. No low-poly approximation changes visible geometry or misses true perimeter hits.

Sticker admission now exits immediately for zero placements. For nonempty placements it looks for actual printed alpha first, and performs collider visibility/shell-perimeter arbitration only for an ink candidate. Reverse order uses an index loop instead of copying and reversing placements. A single-result cache shares identical synchronous admission queries until the next microtask checkpoint; its key includes current scene/placements identity, visibility epoch, canvas bounds, camera world/projection and content world matrices. Different coordinates, pose/camera/layout/placement publication cannot reuse it. No hit persists into a later event/frame; the optimization does not claim all separate browser callbacks will share a checkpoint. False/null results are cached as well.

Production visibility opts into worker-only preparation and subscribes to worker epoch for projection notification. PackPaper delegates to the worker-owned usePreparedStickerPaper hook and its disposal. Worker owner controls final PeelingPrint readiness/deformation details.

## Verification

52 existing tests pass across orientation-grab, probe-raycast, sticker-hit-grab, sticker-surface-grab, sticker-visibility and clickwheel unit/integration suites (432 assertions). See evidence/responsiveness-picking/tests.txt. Device typecheck passed before worker's in-progress extraction; picking-only scoped eslint and git diff --check pass. Full integrated typecheck/lint/build will be rerun by author/lead after worker completion.

Offline experiment evidence/responsiveness-picking/check.ts reproduces the current front factory verbatim, plus rear shell and hardware cutouts, using the same rays for original and optimized paths.20 target points include LCD/bezel boundaries, control holes, clickwheel center/rim, body edges and corners across7 yaw/pitch poses, for mouse/touch and both shells:560 ray comparisons. Every exact fallback matches point/face index/count; every broad-phase rejection is checked to contain no original perimeter hit at the maximum allowed band.

| Shell/input | Rays | Exact rays after | Broad-phase skips | Baseline → optimized elapsed |
| --- | --- | --- | --- | --- |
| Front/mouse |140|92|48|264.29→144.73ms|
| Front/touch |140|115|25|253.49→196.80ms|
| Rear/mouse |140|92|48|63.55→40.55ms|
| Rear/touch |140|115|25|50.46→41.42ms|

These are measured **single-pass unthrottled local Bun CPU totals**, not browser input delay, phone frame time, or a statistically repeated benchmark. Work reduction is the robust result:48/140 fine rays and25/140 conservative touch rays bypass triangles. See measurements.json. The fixture itself was corrected to keep source/proxy local rotation in sync before this final pass (a fixture worldToLocal update had initially reset a manually supplied source matrix); no production correctness failure was hidden.

A physical phone and representative browser performance trace remain follow-up validation. No claim that raycasting is the only responsiveness constraint.

## Remaining exact triangle cost / next boundary

The representative touch pass still delegates115/140 rays to detailed geometry. The broad-phase stage alone did not solve the complete raycast bottleneck. Existing worker-built collision BVH can accelerate spatial candidate selection, but `StickerCollisionHit` currently exposes only point/normal/source/kind/distance, not original triangle/face index, barycentric UV, material group or material-side semantics. Its segment cast deliberately uses double-sided triangle contacts and a tolerant shared-edge fallback. Installing that return value as a render Mesh raycast would silently change input semantics.

A concrete correctness-preserving extension is worker-built **triangle candidate indexing** for each immutable shell geometry, with original triangle IDs retained. Main-thread ray traversal then visits only candidate leaves, and exact Three triangle/hit construction preserves front/back material sides, near/far, UV/normal, face indices, original groups/draw ranges and hit ordering. The current render geometry remains authoritative; no low-poly approximation. Worker output must be keyed to position/index identity+version and mesh geometry identity; stale/pending/error uses the current exact fallback until ready, with bounded outstanding rebuild. Alternatively extend collider snapshots with original triangle metadata and reproduce/test all Three hit semantics explicitly, but that is a larger correctness surface. BVH construction belongs off-thread; its cheap synchronous traversal belongs on the event path. This assessment led to the implemented and benchmarked extension below.

### Authorized exact shell index extension

The broad phase alone left 115/140 touch rays expensive. The shell index follow-on keeps exact Three triangle intersections but moves immutable BVH construction to a session-wide worker. Candidate leaves borrow current rendering attributes; Three constructs point, UV, normal, face and material-side semantics; original face IDs/order are restored. Unsupported material arrays, partial draw ranges, morphs or changed geometry/version use the original exact raycast. Physical shell and orientation proxy both benefit. No appearance changes.

Preparation has one worker across all device copies and at most four waiting jobs. Input buffers are private copies; disposal/version cancellation rejects stale work. Error, timeout, transfer failure, unsupported Worker and queue overflow retain exact input behavior. Worker terminates when idle. Main-thread query visits only node bounds/candidate leaves and performs no BVH build or full tree restoration.

`evidence/responsiveness-picking/index-measurements.json` records 840 full hit parity comparisons (420 per shell, seven poses, twenty points including LCD/bezel/clickwheel holes/corners/back, all three material sides). Point/distance/UV/normal/face/order match. Offline Bun front exact 1316.81ms versus indexed 6.43ms for420 rays; rear201.77ms versus9.33ms. Offline index build224.01ms/36.49ms runs inside worker in production. These are bounded host experiment timings, not phone or input latency. Original broad-phase evidence remains separate. `lifecycle.ts/json` proves serialized startup, active/queued cancellation, stale terminated-worker callbacks ignored, idle termination and queue overflow fallback. Shell files lint and device typecheck pass.

Final independent runtime fallback evidence `fallback.ts/json` covers material arrays/groups, partial draw ranges, position version changes, pending/unavailable Worker and disposed owner. Final affected existing suite:32 pass,862,843 assertions; no new unit tests. Device typecheck and source lint pass. The unrelated unchanged StudioEnvironment route-source assertion remains documented in worker review.
