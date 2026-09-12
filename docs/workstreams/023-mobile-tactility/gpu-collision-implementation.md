# Packed collision resources — CPU-010

Implementation is frozen for independent review; no commit, browser interaction or trace was performed by this engineer. This is dispatch C under gpu-worker-scope.md, not completion of the GPU/worker architecture goal.

## Query and transport authority

`PackedCollisionTree` in `packed-collision-tree.ts` is the immutable wire and synchronous-query representation: Float64 bounds (six per node), Uint32 links (left+1, right+1, leaf start/count), and stable leaf triangle IDs. Root is node zero; absent child is zero. `StickerCollisionSnapshot` retains coordinates, provenance, metadata and this packed root. The exact cooperative builder produces it directly. The synchronous utility drains the same generator; the worker returns its private typed buffers by transfer.

Main query construction adopts the snapshot directly. There is no recursive restoreNode, Box3 hierarchy, recursive serializeNode, or per-snapshot tree rebuilding. A query owns bounded Box3/triangle/ray/vector scratch; returned hits own their vectors. Snapshot identity is retained. Disposing a borrowed query drops its references without mutating metadata or detaching shared buffers. The carry fallback can therefore borrow the same immutable snapshot without copying provenance metadata. Carry startup still structured-clones the immutable typed representation once per worker/assembly lifetime; no SharedArrayBuffer or transferable ownership of a still-live visibility snapshot is assumed. That necessary cross-owner copy is distinct from the removed nested object restoration/serialization.

Exact segment, nearest approved support, warm-facet hints, triangle overlap and stable equal-distance traversal retain the prior algorithms. Shell picking uses the same packed bounds/links/leaf order and still delegates actual triangle/side/UV/normal/material hit construction to Three. It restores original face IDs/order and object identity. Unsupported material arrays, changed position/index buffers, morphs and partial draw ranges retain the existing exact Three raycast path. Shell owners sharing one geometry/version now share one worker preparation/index result, while retaining independent query scratch/proxies.

## Registered assembly revisions

Production Device registers its nearest owned device-content group through the existing wheel ref, which avoids selecting another device copy by global name. Registration observes child-added/removed events and cleans up all listeners at the final owner. Device's layout effect marks prepared/material/finish/screen-material changes. ControlPhysicsController marks its local wheel/Select matrix mutations synchronously before normal invalidation. ScreenMeshHandle.setMaterial marks material replacement outside Device props. These narrow ownership expansions were approved in scope and recorded on the board.

Registered unchanged assemblies reuse cached faces/revision with only the root/ancestor world update needed by the query; they do not walk descendants or recompose every mesh's local ancestry. Global orientation is deliberately outside the local geometry revision. Changed local authority performs the existing exact inspection/signature comparison, and async preparation rechecks that authority before installing. PeelingPrint no longer recursively updates all content immediately before visibility does it again.

The registration contract requires owners to signal direct local buffer, transform or material-visibility/opacity mutation before the next query. This is explicit authority, not interception of arbitrary property writes. External/unregistered assemblies retain the defensive full inspection behavior, including geometry/index version and local visibility checks. Renderer-host consumers must use this same revision contract for owned local changes; ordinary world/device pose must not increment it.

## Bounded lifecycle

Collision preparation has one global producer, at most three waiting jobs and a 128 MiB admission bound for estimated private input plus packed output. Queued inputs borrow only immutable recipe/geometry references; actual private copies happen in budgeted execution steps. Plain nonnormalized Float32 positions use one exact native copy instead of expanding every vertex to Float64 on main. Other attribute layouts retain exact getter conversion in bounded batches. The worker deadline starts after copy/queue wait, when execution is dispatched.

Cancellation retires the active producer or removes its queued job and does not recover. Worker/runtime/message/timeout failure terminates the producer before exact cooperative recovery, which retains the same global slot. Admission overflow rejects explicitly rather than creating an unbounded fallback producer. Worker identity plus request ID guards late callbacks. Idle collision workers terminate. Shell preparation separately retains its existing one-worker/four-waiting bound, adds a 64 MiB input bound and request IDs, and coalesces identical geometry owners. Last-owner release aborts/releases that shared preparation. Subsystems are bounded separately; this does not claim a page-wide global compute budget.

Private buffers may transfer. Mounted geometry, live visibility snapshots and shared picking indices must not detach. No shared mutable Three instances cross the worker boundary. Native copies/allocations remain non-preemptible; this change removes dense object restoration and repeated assembly work without claiming all main-thread work is eliminated.

## Evidence and commands

`evidence/gpu-worker/collision/parity.ts` permanently pins baseline `d252c4425e18fff1424f26aff9e3dcb6e28e46f8` and archives its complete device source tree. It compares the original query implementation on the same complete prepared front/rear/hardware assembly, not the changed implementation against itself. The retained result proves:

- 529 exact segment, 529 nearest-support and 529 complete-triangle comparisons, including exact provenance/normals/contact values and identical support traversal work.
- 840 exact shell rays across front/rear, seven poses and all three material sides; another 840 UV-dependent alpha-filtered result comparisons preserve hit data. These synthetic alpha filters prove UV admission equivalence, not a new claim about unchanged higher-level sticker artwork code.
- Worker and cooperative coordinates/provenance/packed bounds/links/leaf order/metadata match.
- 200,913 input triangles formerly required 65,535 dense node restorations; packed adoption restores zero tree nodes. Prepared packed typed data totals 20,267,280 bytes; private worker inputs total 3,874,572 bytes. These are representation/work counts, not JS heap estimates, browser timings or GPU speedups.

`lifecycle.ts` / `lifecycle.json` has 21 passing checks: 100 registered global poses incur one initial assembly walk; actual physics and screen-material mutation invalidate; topology, buffer, visibility, registration/refcount/idempotence and external defensive behavior hold. Deterministic worker transport proves one producer, live-buffer protection, abort/no fallback, retired-generation rejection, idle teardown, exact message-failure recovery, overflow rejection, shared shell-owner preparation and borrowed snapshot disposal.

```sh
bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/collision/parity.ts
bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/collision/lifecycle.ts
bun test packages/device/src/{sticker-collision,sticker-collision-preparation,sticker-visibility,sticker-contour-visibility,sticker-free-carry,probe-raycast,orientation-grab,control-physics}.test.ts
bun test packages/device/src/screen-mesh.test.ts
bunx tsc --noEmit -p packages/device/tsconfig.json
bunx tsc --noEmit -p apps/web/tsconfig.json
bunx --bun eslint packages/device/src/{sticker-collision.ts,sticker-collision-cooperative.ts,sticker-collision-preparation.ts,sticker-collision-worker.ts,sticker-visibility.ts,packed-collision-tree.ts,sticker-assembly-revision.ts,shell-picking.ts,shell-picking-index.ts,shell-picking-preparation.ts,shell-picking-worker.ts,sticker-carry-preparation.ts,control-physics.ts,Device.tsx,StickerPackScene.tsx,sticker-collision.test.ts,screen-mesh.ts} docs/workstreams/023-mobile-tactility/evidence/gpu-worker/collision/*.ts
```

Affected existing suites: 51 pass / 865,071 assertions; screen boundary 9 pass / 121 assertions. Device and web types pass; scoped source/proof lint and diff check pass. No new unit tests. The existing two-triangle typedBytes assertion changes from 152 to 224 to include all newly typed BVH storage; its behavioral assertions remain unchanged. Lead owns integrated browser/6× and full-goal acceptance.

## Exact handoff ownership

Changed source: Device.tsx (registration and resource revision effects/import), StickerPackScene.tsx (one root-only update), control-physics.ts (three local-matrix notifications/import), screen-mesh.ts (setMaterial notification/import); sticker-collision.ts, sticker-collision-cooperative.ts, sticker-collision-preparation.ts, sticker-collision-worker.ts, sticker-visibility.ts; shell-picking.ts, shell-picking-index.ts, shell-picking-preparation.ts, shell-picking-worker.ts; sticker-carry-preparation.ts (remove unnecessary metadata copy); sticker-collision.test.ts (typed representation bytes). New source: packed-collision-tree.ts, sticker-assembly-revision.ts. Proofs and this diary are owned by CPU-010. Other agents' package/lock, alpha/drop-fit, shader, browser and scope edits are excluded.

Shared Device/control/StickerPackScene/screen-mesh sections are now released to the host lane after review coordination. Preserve their local mutation notifications. Carry-preparation's immutable borrow change is ready for CPU-011 integration; no deformation algorithm or gesture behavior changed here.
