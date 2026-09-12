# Worker paper and visibility peer review

Independent scheduling engineer review of sticker-paper-preparation.ts, sticker-paper-worker.ts, sticker-paper-transfer.ts and sticker-visibility.ts, with existing collision preparation adapter and PackPaper consumers. Atomic carry pipeline is reviewed separately by the picking engineer. Read responsiveness scope and team review protocol; no source edits made by this reviewer.

## Verdict: REQUEST_CHANGES (recovery implementation in progress)

Major: cold paper Worker construction, runtime, timeout or transfer failure publishes error but leaves stock null, and PackPaper ignores the error. The sheet remains missing until another request succeeds. The worker owner is implementing exact cooperative recovery; reduced-resolution permanent geometry would violate the appearance constraint. Exact current factory measurement in unthrottled Bun (300×500, pixel1, liner, full curl) was15.0ms cold, then6.0/3.4/2.6/4.0ms, with9,409 front vertices. This is not phone timing; it does not justify putting cold construction synchronously in an interaction handler.

Major: production workerOnly visibility returns false while unavailable and no longer uses the old synchronous fallback. On persistent Worker creation/CSP/runtime failure, all sticker admission/contact remains unavailable despite retrying after the one-second cooldown. Recovery must cover this collision path too. Reported to worker owner and supervisor. Final judgment pending policy and implementation.

## Passed static boundaries

Paper controller keeps one active job plus one replaceable latest wanted input. Job IDs prevent superseded results from publishing, hidden state terminates and retains desired work, mount cleanup terminates/removes listener/disposes active and retired stock, and geometry retirement waits for React's replacement commit. Transfer payload contains the current factory's full position/normal/uv/index and computed sphere; paper has no groups or draw ranges to lose. Buffers transferred are new owned copies, not rendering buffers. Error paths are explicit, but feature recovery is the blocker above.

Visibility signature retains object/geometry/attribute identity, backing/version/count, index and authored local matrices plus material visibility/opacity. Global camera/device pose does not invalidate local collision. Cached face descriptors are rebuilt only on signature change. Cold/changed collider readiness rejects stale queries, completion checks exact assembly revision and abort state, and epoch publication triggers consumers. Snapshot borrowing is documented as clone-only. Existing collision adapter has a15-second timeout and abort termination; it is not newly hidden-tab terminated.

## Independent checks

Existing paper and visibility suites:8 pass,0 fail,75,100 assertions. These verify original geometry and synchronous visibility parity, not worker scheduling/error recovery. Integrated device type/lint was initially blocked by known in-progress carry extraction (recorded in picking review); rerun required after final implementation. Worker lifecycle/transfer experiment, author diary, final type/lint and supervisor build/browser verification remain pending. No browser/phone performance gain is inferred from source changes.

Ownership update: supervisor assigned collision recovery implementation to this reviewer. That correction is recorded in responsiveness-scheduling.md and MUST be reviewed by the picking engineer; this document can no longer independently approve collision-preparation/cooperative implementation. Paper and visibility remain independently reviewed here.

## Recovery and epoch correction follow-up

Worker owner implemented exact96-segment paper generator recovery through budgeted yieldSteps when Worker fails. No approximation remains. Shared paper pool limits actual Workers to one, with at most32 clients and one queued job per client; production's sole neighbors producer already caps two neighbors, so its three paper surfaces share that one worker. Arbitrary public neighbors arrays cannot spawn arbitrary Workers. Closed clients remove queued work; active cancellation terminates and pumps remaining owners. Worker identity/sequence guards reject old callbacks. Hidden/dispose paths close their client and cancel fallback; last client terminates shared worker.

New Jotai computation epoch advances on explicit intent supersede, reset, cancellation, rear lifecycle loss and animation start (including release). Production forwards this through the visual contract to paper/carry. Paper requests move to layout effect so a completed old worker result cannot slip between new-epoch commit and passive effect. Compatible intermediate curls may publish monotonically only in the same dimensions/epoch; a single active job cannot reorder completed poses, and the final wanted input remains queued until computed. Previous accepted geometry remains visible while preparation catches up. This is delayed geometry progress, not synchronized per-pointer visual timing.

Independent current checks:20 existing paper/visibility/app interaction lifecycle tests pass,75,281 assertions; apps/web typecheck and scoped paper/visibility/epoch-app lint pass. During cross-boundary review found carry fallback borrowing snapshot metadata then disposing it, corrupting original visibility metadata; author fixed via clone and separate carry reviewer verified. Paper/visibility source findings appear resolved; final approval awaits author diary and retained paper pool/epoch/failure lifecycle evidence. Collision fallback implementation remains independently approved only by the picking reviewer.

## Final paper/visibility/epoch verdict: APPROVE

Read final responsiveness-worker.md. Independently executed paper-pool.ts and current typed worker-lifecycle.ts. Pool evidence proves global one-worker serialization across32 owners, FIFO, capacity rejection, active cancellation, stale worker error rejection and last-owner termination. Lifecycle evidence proves old epoch rejection, final latest input dispatch, hidden/foreground cancellation/resumption, stale callback isolation, asynchronous exact paper recovery without Worker, and disposal. Its additional carry/provenance checks passed but carry implementation has its own independent reviewer. Final scene now also enforces two visual neighbor slots, preserving the existing production producer's limit.

All substantive findings above are resolved. Independent device/web typechecks, paper/app source lint and20 existing affected tests pass. Evidence's unchecked any casts were removed; two remaining controlled-array non-null assertions were reported for final mechanical lint cleanup. They do not conceal a source runtime defect: preceding synchronous MockWorker construction creates those entries, and the probe already executes successfully. Supervisor reports combined build and built-preview renderer/worker HTTP checks; those are integration evidence outside this reviewer's independent execution. No claim of measured post-change phone latency or tactile validation is made.

Final evidence cleanup verified: both controlled-array assertions replaced with explicit missing-worker guards; independent scoped lint of worker-lifecycle.ts and paper-pool.ts passes. Final APPROVE has no outstanding check or finding in this lane.
