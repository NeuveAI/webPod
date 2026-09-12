# Independent GL prepared-source damage reuse review

Disposition: APPROVE, bounded source milestone only. Reviewed only `packages/device/src/sticker-prepared-damage.ts`, SHA-256 `b2b27ba40d83d194dff431fba66c3465188625aedfab426b6a2aff0d54a85a54`, against the archived `dcdda0d2` baseline and exact `gl-runtime-failure/source-reuse.patch`. No authoring by reviewer. Native output changes are outside this verdict.

The correction considers inherited damage provenance with explicitly supplied candidates, rejects more than64 candidates, and runs the existing yielding exact consumed-input comparator before reusing a canonical key. Artwork/id checks precede the comparison. Wrapper identity alone does not certify reuse. All inherited acquisitions remain, and the current geometry still receives independent contour preparation and its own borrowed wrapper. Registration avoids appending an already present canonical key, preventing duplicate provenance accumulation without shortening resource lifetime. No computation, resource cap, alpha field, GPU texel, contour or visible-wear policy was simplified. No Critical/Major source finding remains in this delta.

Independent validation completed:

- Archived-function actual workload reproduces capacity rejection at pending-source-wrapper0, with23 prepared owners and final zero accounting.
- Corrected default actual workload retains all four wrapper generations through wrapper3,27 prepared owners, no failure/worker error and final zero accounting.
- Exact actual-worker proof:10 checks covering full96-segment nonempty contours, field/GPU equality, normal/UV/artwork non-aliasing, cancellation, changed positions, inherited borrowed-buffer retention and final zero.
- Existing alpha, contour visibility and program preparation suites:17 tests,17,705 assertions, all pass.
- Device, composite and web typechecks pass; scoped source and three executed proof-file lint passes.

Proofs are retained under `evidence/gpu-worker/gl-runtime-failure/`: `gl-source-wrapper-before-workload`, `gl-source-wrapper-workload`, and `gl-source-wrapper-exact` (TS/JSON). Workload resource counts are lifecycle/admission evidence, not browser timing or whole-process heap limits. No browser, server, full build or application edits were performed. Fresh live GL tool and physical peel/drop/return acceptance remains lead-owned; this review does not close native visual parity or full activation gates.
