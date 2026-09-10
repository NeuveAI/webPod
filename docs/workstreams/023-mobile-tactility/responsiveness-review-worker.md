# Independent carry and collision recovery review

Reviewer: mobile framing/picking engineer, independent of worker and collision fallback authors. Reviewed full carry computation/preparation/worker, transfer, scene effect integration, generator wrappers, and collision preparation/cooperative fallback. Paper/visibility review is separate in `responsiveness-review-worker-paper.md`.

## Findings resolved during review

- Carry worker error callbacks now verify originating worker identity, so a queued event from a terminated worker cannot cancel its replacement.
- Carry owner now includes explicit `computationEpoch`, incremented by existing interaction supersession/reset/cancel and animation start boundaries. Identical artwork/source anchors no longer make a new gesture share the old asynchronous owner.

## Evidence and correctness

Independently ran retained `evidence/performance/carry-parity.ts`: all six sheet, attached, detached, landing, landed and return cases match the original effect, worker computation and cooperative path for 9,409 vertices. Snapshot restoration includes camera projection/inverse and world transform, and restores rear wrap form metadata lost by structured cloning. Transfer copies rendering inputs and cached source/target attributes; transferred output adopts owned buffers and precomputed bounds. Main thread does not recompute normals/bounds on publication.

The runtime admits completed in-flight poses monotonically within the current owner rather than requiring equality with the latest requested sequence. This prevents continuous input from starving publication. One active and one latest pending pose are retained; final latest work drains after active completion. New owners/assembly revisions reject obsolete results. Hidden/unmount cancels active work; returned frames are retired until React commits their replacement, then disposed. Readiness gates prevent collision queries against stale assembly. Worker failure selects exact cooperative computation and abort never restarts old work. Independently reran the finalized runtime lifecycle probe: Worker-unavailable carry recovers asynchronously, latest epoch/final pose drains, hidden stops publication, visible resumes and disposal clears frames. Worker instance identity and sequence admission were also inspected directly.

Independently ran `evidence/scheduling/collision-fallback.ts`: exact full snapshot parity for2,240 triangles/895 nodes, empty geometry, cancellation before/during computation and Worker-unavailable recovery pass. Stable merge ordering matches the existing comparator, triangle provenance and coordinates are retained. Assembly signature is rechecked before installing the fallback snapshot. Work yields every128 inner iterations under the shared4ms scheduler; bulk typed-array allocation and small native geometry operations remain non-yieldable. This is not a hard4ms maximum task guarantee.

Independent collision-file lint passes. All32 existing orientation/probe/sticker-hit/grab/visibility/free-carry tests pass (862,843 assertions). Independently reproduced unrelated baseline `StudioEnvironment.test.ts:94` failure: test expects route-level `studioEnvironment={undefined}`, while unchanged route delegates to DevicePage. Neither route nor test was modified; no assertion was weakened.

## Total concurrency audit

Placed sticker count does not create carry workers. Production neighbors are explicitly sliced to two in `production-device-view.tsx`, so per device there are up to three paper workers, one carry worker and two short-lived visibility workers; shell preparation is session-wide one. Thus up to seven workers can overlap for one device, and additional device copies multiply all but shell preparation. Parent and authors notified: shared bounded paper preparation is preferable to repeated Three parsing/heaps. Paper owner is moving paper preparation into a shared bounded runner; haptics reviews that separately. This does not block independent carry/collision approval. Per-hook queue boundedness alone is not a complete mobile concurrency claim.

## Final verdict

APPROVE carry and collision recovery after the metadata ownership fix. Haptics identified that restoring a temporary fallback collider from a borrowed visibility snapshot allowed disposal to empty live metadata. The author now copies metadata entries before restore; independent rerun of worker-lifecycle succeeds and live visibility metadata survives both returned frames. Coordinate/provenance arrays are read-only and disposal only replaces local references. Scheduling and picking approvals are recorded separately. No remaining source correctness blocker in this review lane.
