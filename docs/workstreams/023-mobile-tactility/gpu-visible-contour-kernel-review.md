# Review: exact visible contour kernel and query protocol

## Verdict: APPROVE

### Correctness Check

- Source of truth: Phase A of gpu-visible-contour-dispatch.md and gpu-visible-contour-kernel-implementation.md. Frozen three-file SHA256 manifest independently verified; archived contour and transform baselines independently equal e940 source exactly.
- Kanban ticket: none; current user AGENTS.md/dispatch require the workstream tracker and no Neuve shell/board.
- Correctness target: identical prepared contour projection, clipping, anchor and visibility order through one shared pure kernel; unchanged UV selection cache and live positions; canonical data-only protocol without new input authority.
- Dispatch scope: sticker-contour.ts, sticker-transform-projection.ts and new sticker-contour-query-data.ts only. Phase B files preserved. No browser, build, application edits, staging or commits by reviewer.
- Dependency/HITL status: Phase A authorized; this approves only frozen extraction/protocol. Phase C runtime validation, queue/credit semantics, cardinality accounting, lease retirement and actual production behavior remain required before activation.
- Neuve HITL gate: not invoked under explicit instruction; existing release gates remain separate.
- DoD checklist: deterministic parity, source audit and device/web type/lint gates pass for this phase. No worker lifecycle or responsiveness claim follows from protocol types alone.
- Review lanes: independent floating-point/kernel semantics, synchronous callers, UV mutation contract, plain-data transport and proof integrity.
- Type/lint/doc gates: independently ran both device and web typechecks (exit0), scoped eslint for three source files and proof (exit0), git diff --check (exit0). New public functions document borrowing, current samples and same-admitted-quad precondition. No runtime Three object is included in message payloads; callback type is synchronous-only.
- Git history/staging: small extraction/protocol slice with proof and report, separately reviewable from Phase B/C.
- Verification evidence: reran kernel/check.ts:224 complete contour comparisons (144 non-null/80 null),248 quad comparisons,669608 identical visibility callback coordinates/order, structured-clone replay and live deformation. Reran projection-cache/check.ts:36 exact comparisons,188180 initial UV reads and0 across20 warm poses,9 current position samples per query. Reviewed the actual fixture/proof logic and source baselines.
- Decision-log status: scope/report carry bounded API decisions; global/023 decision files absent as recorded by preceding reviews. No unrelated workstreams loaded.

### Findings

- [INFO] No blocking source finding. Matrix copies preserve double values and the original sequence of local→world→camera-inverse→projection operations. The extracted contour loop, null splitting, path closure, anchor ordering, anchor visibility calls and epsilons remain identical. The synchronous wrapper obtains its quad first, then passes the already-updated world/camera tuples and matching center into the same prepared kernel. Defensive nonprepared contour path is unchanged.
- [INFO] Quad capture preserves cached exact indices and9 live position samples. A fixed27-scalar Float64 array owns its values; mounted geometry storage is not transferred. Missing sample slots become NaN, which yields the same final null admission under projection. Valid canvas, behind-camera/near/far clipping, finite checks and polygon-area threshold remain intact. Source baseline equality and full result comparisons support exactness rather than visual approximation.
- [INFO] Transport reuses RenderMatrix, Pick<RenderPose> revision fields, PreparedStickerContour, StickerCollisionSnapshot and StickerProjectedContour. Lineage/session, generation, monotonically comparable sequence and separate resource IDs are available for the future owner. These compile-time fields are not runtime validation, resource accounting or result-credit enforcement; Phase C must implement and prove those obligations. The result's canonical variable-length point arrays especially require preallocation/cardinality charging, not an assumed tiny message size.
- [INFO] Pure prepared projection expects an admitted quad and coherent validated data; it does not independently reject an invalid canvas before processing. That is consistent with its documented same-quad-center precondition and the synchronous caller. Future worker code must project/admit the captured quad and validate incoming data before calling it. Do not treat exported kernel availability as permission to bypass this boundary.

### Suggestions (non-blocking)

- Keep Phase C's query admission/validation tests explicit for malformed tuple lengths, nonfinite matrices, malformed contour/anchor arrays and retired resource IDs. Those concerns belong at the worker boundary and are not resolved by this type declaration.

### Neuve Dogfood Feedback

- Commands run: none; prohibited by current user AGENTS.md and dispatch.
- Artifact refs: this review, Phase A report and evidence/gpu-worker/visible-contour/kernel/{baseline-contour.txt,baseline-transform.txt,check.ts,result.json,manifest.json}; prior projection-cache proof.
- Kanban updates: not applicable; workstream tracker authoritative.
- HITL gate: none introduced. Phase C, runtime and release remain separate.
- Signal value / sticking points / format feedback / backlog signals: not applicable under explicit tool prohibition.
- Feedback artifact: this section records the exception.
