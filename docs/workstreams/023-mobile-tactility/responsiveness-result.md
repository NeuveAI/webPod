# Responsive computation: implementation and verification

Implemented on `codex/mobile-tactility`; not committed or deployed. Earlier mobile framing, touch targets, haptics and version-update changes remain intact.

## Work moved or removed

| Path | Result |
| --- | --- |
| Detailed shell picking | A session-shared worker builds a triangle candidate index. The input handler traverses the index and lets Three produce exact hits from candidate triangles. Pending/error/unsupported geometry retains exact original picking. |
| Sticker paper | One shared worker computes full-resolution paper geometry. Owners have bounded pending work, FIFO service and a maximum registration count. |
| Sticker peel/carry/landing | The complete deformation/contact calculation runs as one worker job with cached source surfaces and generation-matched inputs. Final geometry includes normals and bounds. |
| Collision preparation | Production hit admission no longer builds a collision tree synchronously. Worker completion publishes readiness; failed preparation uses exact cooperative recovery. |
| List selection | Only visible rows are mapped into view models; absolute IDs, counts and scrolling semantics are preserved. |
| LCD updates | Mutation/resize/DPR bursts share one RAF flush. Delivered paint updates the texture immediately without measuring layout again or waiting another RAF. |
| Library updates | The final relationship snapshot is not published twice after the last progressive page. Playback command activation and ordering remain unchanged. |

The main thread still owns DOM and scene snapshots, React commits, browser media SDK commands, texture uploads and WebGL draw submission. Cheap exact index queries remain synchronous so touches do not await worker round trips. Animated LCD text still generates scene rendering; this change preserves its appearance and timing.

## Concurrency and failure behavior

Shell preparation has one worker globally with at most four queued jobs. Paper uses one shared worker, at most 32 registered owners, and one pending job per owner. The scene renders the existing two neighbor paper slots plus liner. Carry has one worker per active device, not per placed sticker. Collision preparation workers are transient.

Compatible completed poses can advance an active animation while the latest input waits. Epochs reject results from previous gestures; the final pending pose is retained. Hidden/unmounted owners cancel jobs and restore the latest intent when visible. Retired displayed geometry is disposed after replacement commit. Rendering buffers are never detached for transfer.

If workers fail or are unavailable, the exact sticker algorithms run cooperatively outside the initiating input stack, with a 4 ms yield budget and checkpoints in large loops. This is cooperative scheduling, not hard preemption: library allocations, normal/bounds operations and copies still execute between checkpoints. No permanent low-resolution fallback was introduced.

## Evidence

- **840 indexed shell-ray comparisons passed**, including both shells, rotations and all material sides; full point/distance/face/UV/normal results match. Independent fallback/lifecycle checks cover changed geometry, unsupported cases, cancellation, stale callbacks and disposal.
- **Local CPU experiment:** 420 front-shell rays took 1316.81 ms through the original path versus 6.43 ms indexed. This is an offline Bun experiment, not browser input latency or a physical-phone speedup.
- **Six complete sticker poses matched byte-for-byte** between the former effect, worker calculation and cooperative calculation. Each has 9,409 vertices; wrapping, landing and return are included.
- **LCD batching experiment:** three observer notifications cause one RAF, one paint request and one width/height measurement pair. Delivered paint causes zero layout reads and immediate invalidation. Resize, hidden state and detach pass.
- **Lifecycle experiments pass:** worker-unavailable recovery, stale epoch/error rejection, latest/final pose scheduling, hidden cancellation, pool limits, metadata ownership and disposal.
- **Independent lead checks:** all 14 typecheck projects, changed-source lint and production build pass. Scheduling/media suites: 380 passed. Gesture/contract subset: 36 passed. Broad device suite: 318 passed, one unchanged failure described below.
- **Built-app smoke check:** `/`, `/webpod`, `/api/version` and all four computation worker assets return HTTP 200; worker assets have JavaScript MIME types. Chrome mounts and displays the built preview renderer. The local build was not authenticated to a music provider, so this does not establish real playback latency.

The device-suite failure is `StudioEnvironment.test.ts:94`, which looks for `studioEnvironment={undefined}` in the legacy route wrapper. That configuration now lives in `device-page.tsx`. Both the failing test and route are unchanged from HEAD; independent review reproduced the baseline mismatch. It was not patched as part of performance work.

Final lead command evidence is in [evidence/responsiveness-final](evidence/responsiveness-final). Detailed implementation and experiments: [picking](responsiveness-picking.md), [workers](responsiveness-worker.md), [scheduling and collision recovery](responsiveness-scheduling.md). Independent reviews: [picking](responsiveness-review-picking.md), [scheduling](responsiveness-review-scheduling.md), [carry/collision](responsiveness-review-worker.md), [paper/visibility](responsiveness-review-worker-paper.md).

No post-change production trace or physical-phone measurement has been collected. The earlier 6× CPU trace is baseline evidence only. Remaining performance work includes measuring the new input path and the still-continuous marquee-to-texture rendering cost under the same conditions.

## Suggested commit boundaries

1. `Accelerate shell picking with a worker-built triangle index`
2. `Move sticker geometry to workers with cooperative recovery`
3. `Bound list preparation and batch LCD repaint requests`
4. `Avoid duplicate final relationship publication`

These are suggestions only. Earlier mobile/update changes and the external `.gitignore` edit require separate staging; no broad automatic commit was made.
