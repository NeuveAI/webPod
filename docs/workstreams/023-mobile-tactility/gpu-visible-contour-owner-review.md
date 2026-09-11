# Visible contour query owner — independent review

Disposition: **APPROVE the corrected bounded source slice**. This review covers only the query owner, dedicated query worker, discriminated query stamp, and retained owner proofs. It does not approve the concurrently authored projection/editor integration or production latency.

The binding contract is [the dispatch](gpu-visible-contour-dispatch.md) and the **Production follow-up** in [the design](gpu-visible-contour-design.md). Earlier strict-current-result and resident-builder proposals are superseded. Compatible historical samples are permitted; hard lifetime barriers are not.

## Finding

**Resolved Major — compatible candidate admission failure destroyed the current presentation.** In the initial owner hash `a618237b54288b8be9a901380092a3825c53c1d3b4610329096453b93c82b5ba`, `sticker-contour-query.ts:145–148` routed reservation/private acquisition failures to `fail` at line 82. That terminated current ownership and cleared its usable result. The design explicitly requires candidate capacity rejection to keep the current compatible presentation intact. This is not a reason to retain a result across a genuine selection, source, layout, or backend lifetime barrier.

The independent actual-worker reproduction [reviewer-candidate-capacity.ts](evidence/gpu-worker/visible-contour/owner/reviewer-candidate-capacity.ts) first receives a real contour result, reserves the remaining shared budget externally, and requests a compatible new print revision. [Before correction](evidence/gpu-worker/visible-contour/owner/reviewer-candidate-capacity-before.json), `retained` is false and the error is `Collision preparation capacity exceeded`; cleanup nevertheless reaches zero. [The independent corrected run](evidence/gpu-worker/visible-contour/owner/reviewer-candidate-capacity.json) now retains exactly the same displayed result, reports the capacity error, and finishes with zero ownership.

The correction rolls back only a rejected candidate, leaves the current leases intact, and latches failure until explicit clear/retry. Independently rerun added cases prove 1,000 repeated rejected demands do not retry, explicit retry succeeds after pressure is released, the actual 32-private-owner limit rolls back an already allocated pair/shared collider reference, and a new hard-barrier session immediately clears retained presentation. Fatal send/timeout failures still retire the generation. No unresolved Critical or Major finding remains in this source slice.

## Checks already completed

- Independently reran the retained actual query/transaction module-worker and private-port experiment after correction: **31 cases passed**. It covers exact kernel output, empty contours, compatible coalescing, stationary latest drain, private installation reuse, borrowed-array integrity, stale generations, send/timeout/release failure, observer exceptions, cancellation during initial copy, capacity rollback, and final zero ownership.
- Actual default assembly plus query current/candidate and an existing collision build peaked at **70,885,700 / 134,217,728 bytes**; 200,913 triangles and 20,267,280 typed snapshot bytes. The synthetic-alpha print fixture is representative, not a full-catalogue/browser heap measurement.
- Independently ran contour visibility, transform projection, and drop projection suites: **9 tests / 825 assertions** passed.
- Device and web typechecks and scoped source/proof ESLint passed again for the final corrected source, including the independent reproduction.

Final SHA-256 values match [the author manifest](evidence/gpu-worker/visible-contour/owner/manifest.json): owner `96082b58a246d8987eb0608fe2207020e75f7383b80d1e41956f8760a8849c12`; worker `1bd5708380a6af0eeaa48b5f5c32b597ac5e090cabefdaf9f91c3b4149b85a39`; data `6aca4019141ca4eb6ccb3f18175c7b3d82736e77ef214c8b109ad1e9e05de53e`.

## Source and integration boundaries

The worker invokes the accepted exact kernel and packed collider, preserving the original segment threshold. It receives private contour bytes from the existing producer and a chunked private collider snapshot; no new geometry/BVH producer or synchronous UI fallback was introduced. Collider/output reservations share the original collision budget, and contour private leases remain in the transaction budget. Termination precedes settled-resource release; cancelled copying remains charged until its continuation unwinds. This accounting is not a claim to bound total browser or GPU heap.

Native pose fields are echoed as native authority metadata; GL has an explicit capture stamp rather than invented renderer-worker fields. The owner itself automatically rejects session/source, backend discriminator, visibility, layout/rectangle, and collider changes. **Actual backend-owner replacement must dispose/clear the old query owner, external placement replacement must clear its session, and assembly changes must change the collider admission.** These are caller obligations for the separate integration review; `sceneRevision` alone is not an unconditional barrier because legitimate adopted previews advance it. The owner cannot infer a renderer generation from `motionEpoch`.

Publication is a historical presentation sample, not current input authority. The integration still must prove hard-barrier delivery, no full main-thread sweeps, current input/final-release admission, fade/tool-preview continuity, and measured end-to-end sample age in production. No browser, server, or build operation was performed by this reviewer.

Workstream documentation is the tracker. No Neuve or Kanban commands apply under the current repository instructions.
