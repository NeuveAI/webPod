# Private carry result delivery

CPU026 source is frozen for independent review. Host integration and full native peel/carry/stick, final drop/save, fallback fidelity and6× responsiveness remain mandatory. No browser actions, commits, geometry algorithm changes or host edits were performed.

Read gpu-worker-scope dispatch K, renderer-host plan and existing carry preparation/worker/wear/transfer ownership. The renderer owner explicitly released these modules and agreed the API before implementation. Baseline source copies and hashes are retained under evidence/gpu-worker/carry-render-resources; final three-source snapshot and manifest are `/tmp/webpod-cpu026-frozen-20260911/`. No moving-HEAD parity assumption is used.

## Source and integration contract

Only sticker-carry-preparation.ts, sticker-carry-worker.ts and new sticker-carry-render-resources.ts change. Existing zero-argument createCarryPreparation()/mount/request/commit and GL cooperative fallback remain available. No independent producer, cache of recomputed geometry, main dense copy, source/target geometry algorithm or wear-cache change.

Opt in with `createCarryPreparation({renderer:true})`. Its published CarryFrame has optional `renderStamp`, and `acquireRendererFrame(frame, port, signal)` returns Promise<CarryRendererLease>. The consumed MessagePort receives CarryRenderPayload: version1, stamp, exact geometry, bounds index, full wearGeometry (including when unchanged on main), wearRevision and pointerError. The returned lease carries stamp/byte count and idempotent release. Functions remain main-only; none enters the wire data.

Stamp fields are ownerId, workerGeneration, jobId, computationEpoch, owner and assemblyRevision. Owner includes existing source/art/anchor/gesture identity plus active target placement. Acquisition rejects retired producer/source/target/gesture/assembly stamps. Compatible completed jobs retain the existing monotonic publication and latest pending/final-sample behavior; they do not wait for every renderer projection.

Acquire the selected frame immediately, before asynchronous print/damage preparation. It pins selected main geometry/wear through private delivery and rendering, so commit/newer results cannot dispose an adopted query frame. Host owns current and candidate GPU leases; release the old lease only after replacement/retirement. Host calls runtime.commit after query/renderer candidate adoption; this releases canonical ownership for superseded main frames while explicit lease pins preserve displayed query buffers. Release does not authorize persistence or save a sticker.

## Producer, budgets and cancellation

The same carry worker optionally retains at most two completed canonical results (current plus candidate). It structured-clones the main result before transferring main buffers, and later clones the exact canonical packet directly to the renderer's port. Main never clones dense output. Stable worker wear data is shared between canonical packets and cleared when no canonical packet remains; unchanged main wear revisions retain the original identity reuse.

Per carry owner, each completed wire resource is limited to8MiB, total accounted output/private reservations64MiB, at most two canonical frames and two private renderer owners. One active computation reserves two maximum output payloads before scheduling. Private owners are admitted before posting, charged twice until the producer copy ACK, then once until explicit renderer release. The numerical accounting covers output/wire/private buffers, not Three/GPU implementation heap or the pre-existing collider/source/algorithm temporaries. Over-limit or unavailable native resources fail explicitly into complete GL fallback; quality is not reduced.

Canonical pressure pauses the next computation, retaining the single latest wanted pose. Releasing a superseded canonical result resumes that exact final wanted job. Copy requests use the same producer FIFO; an explicit worker start response arms the copy execution deadline, so queue wait itself does not start a timeout. Active carry computation retains its existing execution deadline.

Pending private cancellation retires the worker before reservations are freed, rejecting queued/late copies. Settled GPU/query leases remain charged and pinned until renderer replacement/release, even after producer retirement. Stamp/request and worker identity reject late ACKs. Stop suppresses reentrant dispatch while pending leases release. In renderer mode failure publishes snapshot.error and stops further computation; it never silently starts dense main deformation. The unchanged zero-argument GL path retains exact cooperative recovery.

## Verification

`bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/carry-render-resources/check.ts` passes with an actual module worker and MessagePorts. It compares every main/private geometry array, sphere, exact bounds index, wear geometry and stamp; transfers private arrays again and verifies mounted main arrays remain attached. It proves query pins survive commit, two-frame/two-private admission, latest final job drains after pressure releases, source/gesture supersession rejection, pending cancellation/worker retirement, old settled lease retention, stale ACK rejection, unavailable native producer rejection without subsequent main computation, idempotent release and final zero accounting. Representative payload is1,110,040 bytes; four requested computed jobs and one worker. These are work/ownership counts, not phone timings.

Existing checks:

- `bun test packages/device/src/sticker-free-carry.test.ts packages/device/src/sticker-return-path.test.ts packages/device/src/sticker-projected-bounds.test.ts`:13 pass,0 fail,862,660 assertions (/tmp/cpu026-tests.log).
- Existing evidence/cpu-fixes/resources/check.ts passes original GL worker wear identity/commit/unmount ownership proof.
- Existing evidence/performance/worker-lifecycle.ts passes default unavailable-worker exact carry recovery, final epoch/pose, visibility and disposal checks (/tmp/cpu026-default-fallback.log).
- Device/composite/web typechecks pass (/tmp/cpu026-{device,composite,web}-types.log).
- Scoped ESLint passes for all three source files and the retained new proof. No new unit test, route or dependency.

Application source is frozen during the coordinated packet-only browser checkpoint. Host consumes the typed interface separately; a different reviewer must accept this source and the live caller's stamp/adoption/release integration before commit. Full native rendering and performance are not proven by this offline result.
