# CPU resource reuse — WEBPOD-CPU-001

Ready for independent review on codex/device-cpu-profile. Read complete cpu-fixes-scope.md and source/trace/result reports; task claimed through Neuve Kanban with sourceSRC-CLI-1789106126810-1. No Canvas, rendering quality, geometry math, browser, commits or deployment changes in this lane.

## Implemented

`sticker-collision.ts` caches its immutable serialized tree per collider. Restoring a worker-prepared collider retains prepared.root directly, removing the measured main-thread restore→serialize roundtrip on first carry handoff. Synchronous construction serializes once on first snapshot. Disposed snapshots still reject through ensure(); disposal clears the cached reference. Collision query data/provenance and assembly revision authority are unchanged. Main→worker structured cloning remains and is not claimed eliminated.

`sticker-carry-worker.ts` emits an immutable wear surface only when its cached source/target geometry changes; every pose includes a worker-local wearRevision. Subsequent poses omit unchanged attributes. Context replacement resets this channel. Full shown deformation geometry remains exact and is transferred each pose.

`sticker-carry-wear.ts` owns one cached wear resource with explicit frame leases. Accepted carry frames share that BufferGeometry identity, so existing surface-damage caches and textures survive ordinary pose changes. A cache replacement or worker stop releases only the cache lease; displayed/retired frames keep their lease until commit/unmount. Empty surfaces have explicit null payloads; an unknown revision without payload fails into the existing recovery path. No global/unbounded resource cache was added.

`sticker-carry-preparation.ts` consumes wear payloads from valid current-worker messages even when the pose epoch is stale, because the next current pose may refer to that same revision without resending it. Old worker instances remain rejected before this step. Pose publication still rejects stale epochs and drains the latest job. Fallback retains original exact cooperative computation and owns/disposes its independently created wear geometry through the same frame release boundary; it does not adopt a stale worker cache.

## Verification

-23 existing collision, visibility and free-carry tests pass,863,373 assertions.
-Six former synchronous/worker/cooperative cases remain exactly equal for9,409 vertices: sheet, attached, detached, landing, landed, return. Retained current result: evidence/cpu-fixes/resources/carry-parity.json. Historical result file restored after the existing script generated it; no old evidence was rewritten.
-New retained experiment (not a unit test): evidence/cpu-fixes/resources/check.ts/json. Ten checks pass: locally built snapshot identity, prepared-root identity, exact collision query parity, disposed rejection, metadata ownership, wear lease identity/disposal, discarded-first-epoch payload reuse, real worker same-source reuse, source replacement and commit/unmount ownership.
-Device typecheck and scoped source/current-evidence lint pass. Independent reviewer owns signoff; lead owns combined build and current-browser checks.

These changes target the observed first-keyboard-carry serialization and source-proven recurring wear resource churn. No post-change phone/input duration or GPU speedup is claimed. Cached serialized tree retention is bounded by collider lifetime; cached wear retention is bounded by one current resource plus frames awaiting commit. PostMessage cloning, full shown-geometry upload, remaining collision inspection and synchronous drop/editor work remain separate follow-up profile targets.
