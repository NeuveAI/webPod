# Independent exact empty-contour admission review

Disposition: APPROVE for the one-file source correction, SHA-256 `6d5909aeb25d10b599e989a0899e21a578902d2a7abd1c63c4975302d735c4fe` (`packages/device/src/sticker-transaction-broker.ts`). Compared the exact retained contour-admission patch and scope. No application edits by reviewer, and no Critical/Major source finding remains.

`contourWorkBytes` duplicates precisely the existing first return predicate in `sticker-contour-computation.ts:9–10`: both position and UV lengths must match the canonical (96+1)² grid. Only a shape that already returns empty paths and a zero-length anchor array loses the boundaryCandidates×512 work allowance. Full-grid allowance is unchanged for every wear value; neither wear zero nor an apparently unworn field bypasses it. Input backing storage, worker clone, canonical result and private-copy accounting remain unchanged, as do the fixed96MiB cap, cancellation lifetime and contour computation itself. This removes impossible-work reservation rather than removing rendered/query detail.

Independent executions passed:19 retained exact generator/estimator/lifecycle cases (full grid at0/.4/1/NaN remains nonempty with full allowance; position/UV mismatches return exact empty output; full-grid over-cap still rejects; cancellation preserves current; final zero). Actual five-art warmup plus parallel eight-print packet completes with23 prepared owners and no errors; the retained pre-change result documents capacity rejection with22. Four wrapper generations still complete with27 prepared owners;10 exact source-wrapper regression cases pass. All workloads end with zero transaction ownership/accounting.

Eight existing alpha/contour tests pass with17,568 assertions. Device, composite and web typechecks and scoped broker/estimator/workload lint pass. Proof-only hygiene feedback requested replacing an unchecked extracted-function assertion with runtime function/result validation; no application change is needed for that correction.

This is bounded source/admission evidence, not mounted React scheduling or browser memory/timing proof. Fresh cold GL packet, tool release and physical peel/drop/return remain lead-owned runtime gates. No browser, full build or server actions performed.

Proof hygiene follow-up complete: author replaced the unchecked extracted-function assertion with runtime callable and finite-number checks. Reviewer reran the19-case proof and scoped lint successfully; product broker hash unchanged.
