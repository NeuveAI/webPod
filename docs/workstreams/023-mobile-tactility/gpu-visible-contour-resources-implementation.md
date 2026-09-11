# Visible contour Phase B: resource authority and shared budget

Scope gpu-visible-contour-dispatch.md Phase B and design Production follow-up; baseline e940356. Only four production files changed by this author: sticker-contour-preparation-data.ts, sticker-prepared-damage.ts, sticker-collision-preparation.ts, new sticker-collision-budget.ts. Phase A kernel/UV files belong to the other author. No browser/build/server/commit/Neuve action. Existing UV-cache authority remains unchanged.

## Consumer interfaces

`PreparedStickerContourDescriptor {readonly key:string; readonly input:StickerContourRequest}` uses the canonical transaction request. setPreparedStickerContour accepts an optional fifth descriptor. `preparedStickerContourDescriptor(geometry)` returns it only when existing geometry dependency/field/wear validation passes and its input field, normalized byte wear and position/UV backing match the adopted print. Unknown/unprepared/modified prints return undefined. This is immutable borrowed input; do not transfer its buffers. Acquire private bytes through existing `acquirePrivateStickerTransaction(descriptor.key,descriptor.input,port,signal)`, hold that lease through replacement acknowledgment or actual renderer/query-worker retirement.

preparePrint saves the already-created contour key/input after the canonical request succeeds and registers it with the exact adopted contour. It does not change keys, calculation, damage reuse or the preparedStickerResources surface/damage list. Invisible material-only preparation still has no contour. The original canonical contour lease remains held for the prepared print lifetime, so private delivery can find the same producer result. The optional descriptor supports existing setters/proofs without forcing a duplicate producer.

`reserveStickerCollisionBytes(bytes): StickerCollisionReservation` synchronously reserves integer nonnegative bytes or throws the existing capacity error. Reservation has readonly bytes and idempotent release(). `stickerCollisionBudgetSnapshot()` exposes only {bytes,reservations,limit}. Limit stays134217728 (128MiB), shared by existing build reservations and future private query snapshots/results. Phase C must reserve its whole actual private collider/candidate/output allowance before allocation, then retain charge until ACK or termination. This helper does not calculate query output bounds or transfer ownership for its callers.

## Builder lifecycle and unchanged fairness

Original one active plus three FIFO waiting jobs remain; the original input/packed-output estimate is unchanged. Queue admission checks precede reservation, then private input copying begins. Build success/failure/queued cancellation releases only that job. Active worker termination remains synchronous before retirement. A pending cooperative copy or fallback retains its reservation after cancellation until its promise finally settles, preventing premature byte reuse while arrays remain reachable. Job pendingWork counters cover overlapping copy→fallback transition. No retry, cap increase, parallel producer or queue reordering was introduced.

Build reservations still have their original transient meaning: returned main snapshots are borrowed by existing consumers after build completion. New query-private resident copies must acquire their own reservation from this same pool. Do not interpret the helper as automatically accounting every existing main resident snapshot or as proof actual default-device overlap fits; the explicit private-copy/result owner and combined real-scene peak proof belong to Phase C before activation.

## Verification and frozen handoff

- `bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/visible-contour/resources/check.ts`:13 checks pass. Actual build/transaction workers and MessagePorts; deterministic8×8 alpha-readback fixture. Full cap rejects builds; queued abort releases correctly; copying abort remains charged; other FIFO jobs complete with an existing resident reservation. Unavailable Worker recovers cooperatively with exact12-triangle output. Actual preparePrint descriptor stays outside render list; delivered Float64 contour paths/anchors deep-equal canonical data with independent buffers, mounted input arrays remain intact, UV revision invalidates selector, material-only has no descriptor. Final shared budget and canonical/private transaction accounting zero.
- Existing collision/lifecycle.ts:21 checks pass, including stale worker, cancellation, message-error recovery and queue bounds.
- `bun test packages/device/src/sticker-collision.test.ts packages/device/src/sticker-visibility.test.ts`:12 tests/733 assertions pass.
- Device and consuming web typechecks pass. Scoped four-source/proof eslint passes; diff check passes.

Exact source hashes are in evidence/gpu-worker/visible-contour/resources/manifest.json. Independent review remains required. This slice installs no query worker or UI behavior; it is not evidence of contour latency, result age, full default-device private overlap or browser responsiveness.
