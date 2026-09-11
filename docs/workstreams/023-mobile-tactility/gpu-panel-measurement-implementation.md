# Native panel dimension reuse

Implemented under lead's explicit followup dispatch of gpu-panel-measurement-scope.md after C2 completion. Base be77986. Only production files: packages/composite/src/device-render-host.ts and new native-panel-measurement.ts. No app/browser/server/build/commit/Neuve action; no contour/capture, raster, content-fit, shader or DPR changes.

## Exact ownership and projection

Each host attaches/styles/fits its existing panel first, then creates one border-box ResizeObserver measurement owner. The owner reads actual offsetWidth and offsetHeight; no CSS string parsing, rounding approximation, writing-mode axis conversion or device-pixel multiplier. Pose adoption uses read() with no DOM size getter. Existing acceptance checks and exactly one query/carry update remain unchanged.

Only panel transform math/write is extracted into projectPanel. Changed valid observer dimensions call that function directly, using the latest query screen matrix and current layout; they do not call adoptPose, applyPose, sticker/carry project, public listeners, content fitting or capture. Identical transforms retain the old assignment suppression. Equal observer dimensions do not trigger projection. The existing visibility handler refreshes dimensions before resuming publication, including before worker initialization; no parallel visibility listener or extra RAF/interval is added.

Hidden or zero/unboxed measurement marks availability false while keeping last valid numerical dimensions. read() then returns null, so only panel transform is skipped, retaining query/terminal behavior. A positive box restores availability and reprojects even if its numerical dimensions equal the old box. Initial zero/hidden setup waits for the first positive measurement under the existing host45s timeout and abort signal before transferring/initializing the renderer. It never certifies authored guessed dimensions. Disposal disconnects RO, clears element/callback/size references, rejects first-box waiters, removes their abort listeners and ignores stale delivered callbacks. New hosts have fresh caches.

The host still has its existing initialization visibility synchronization; it may cause one additional startup measurement. Observer initial delivery also legitimately reads again. The claim is zero size getters per pure pose update, not exactly one lifetime measurement. External CSS changes become known on border-box observer delivery; no synchronous pre-delivery knowledge is claimed.

## Independent verification handoff

- `bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/panel-measurement/check.ts`:16 lifecycle/callsite checks pass.5000 pose-cache reads invoke zero extra getters; six exact projectNativePanel matrix comparisons using supplied integer box values; idle update after newer pose; equal/zero/hidden/reentry; initial-zero readiness; abort/dispose waiters; stale observer callback; host-callsite separation of transform and query/carry paths. Total fixture reads15 per dimension across intentional invalidations. This is controlled integer/getter evidence, not browser rounding or paint timing.
- Existing native-layout/lifecycle.ts:16 checks pass.
- Existing html-in-canvas.test.ts:5 tests/39 assertions pass.
- Composite, web and device typechecks pass; scoped source/proof eslint and diff check pass.

Frozen hashes in evidence/gpu-worker/panel-measurement/manifest.json. Haptics independently reviews before commit. Actual browser offset rounding for fractional/bordered/writing-mode styles, panel hit alignment, visible reentry and stopped CPU attribution remain lead-owned runtime gates. No125ms/132ms speedup or GPU-frame claim is made from these synthetic counts.
