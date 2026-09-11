# Review: visible contour resource and collision budget preparation

## Verdict: APPROVE

### Correctness Check

- Source of truth: Phase B of gpu-visible-contour-dispatch.md and gpu-visible-contour-resources-implementation.md, read in full. Reviewed four frozen files; every SHA256 exactly matches evidence/gpu-worker/visible-contour/resources/manifest.json. Phase A files are outside this review.
- Kanban ticket: none; latest user AGENTS.md and dispatch require workstream tracking and prohibit Neuve shell/board.
- Correctness target: select only the adopted contour's canonical transaction descriptor; preserve mounted arrays and render-resource list; share the original128MiB budget with existing build admission while preserving one active/three FIFO queue semantics and releasing retired work safely.
- Dispatch scope: named four production files plus author proof/report. No browser, app edits, build, staging or commits performed by reviewer. Unrelated .gitignore preserved.
- Dependency/HITL status: Phase B authorized and reviewed independently of its author. Phase C consumer activation remains guarded by full default-device resident/candidate/output peak proof and query-owner lifecycle review. This verdict does not approve those future consumers or release status.
- Neuve HITL gate: not invoked under explicit current instruction; previous release gates remain separate.
- DoD checklist: deterministic worker/ownership/budget evidence and source/type/lint review pass for Phase B; no browser responsiveness or end-to-end query claim is made.
- Review lanes: descriptor/producer authority, mounted/private-buffer ownership, queue/cancellation/accounting/error paths, source changes and proof quality.
- Type/lint/doc gates: independently ran device and consuming web typechecks (exit0), scoped eslint on all four source files and check.ts (exit0), git diff --check (exit0). Public lifetime/reservation/descriptor APIs document borrowing and release conditions. New heterogeneous authority stamp uses existing comparison-only unknown[]; no new unsafe boundary cast.
- Git history/staging: coherent bounded resource/budget slice, separable from Phase A/C; no commit action by reviewer.
- Verification evidence: independently reran resources/check.ts (13 checks), existing collision/lifecycle.ts (21 checks), and collision/visibility tests (12 tests,733 assertions). Actual build and transaction workers/MessagePorts passed; final budget bytes/reservations and transaction accounting are zero.
- Decision-log status: scope and implementation report record the shared-budget and transient-build choices. Repo/global and023 decision files remain absent as recorded in the earlier independent projection review; no unrelated workstream loaded.

### Findings

- [INFO] No blocking finding in Phase B. preparePrint records the existing successful contour request key/input after the returned result kind is checked, then registers it on the borrowed adopted print. It retains the existing contour lease and leaves preparedStickerResources restricted to its prior surface/damage list. Material-only preparations produce no descriptor. The selector validates the existing geometry stamp plus exact field, byte-wear and position/UV backing identities before returning metadata.
- [INFO] Private contour delivery remains the existing acquirePrivateStickerTransaction boundary. The proof obtains real producer bytes via MessagePort, compares Float64 result data with canonical data, verifies independent buffers and non-detached mounted inputs, invalidates admission on UV revision, and releases both owners. Metadata is borrowed: Phase C must never transfer descriptor.input storage and must retain the private lease until recipient retirement.
- [INFO] Shared budget remains exactly134217728 bytes. Safe-integer/nonnegative admission happens before private build copying; queue-capacity rejection precedes reservation. Each reservation releases idempotently; FIFO order and one active slot are unchanged. Cancellation retires the active worker before pumping another owner, while pending cooperative copy/fallback work keeps its own charge until finally settles. Error, queued abort and unavailable-worker recovery paths pass independent regression evidence.
- [INFO] Accounting scope is accurately qualified. Existing build reservations remain transient; this does not retroactively charge every previously returned main snapshot. Phase C must reserve its actual private current/candidate/output overlap from this same pool before allocation, hold charges through actual retirement, and prove the real default-device peak. Passing a small-box worker test is not that peak proof.

### Suggestions (non-blocking)

- Consumers that acquire a new reservation immediately after cooperative fallback resolves should account for its pending-work finally microtask: retirement charge is intentionally retained until that finalizer runs. Do not interpret a transient capacity rejection as evidence that a new budget or larger cap is needed. Prefer an explicit readiness/retirement boundary if Phase C encounters this case.
- The resource proof's FIFO case checks final accounting and existing lifecycle tests cover bounded admission, but its Promise.allSettled result does not itself assert each surviving job succeeded. Future expansion can inspect each outcome to make that specific narrative claim more direct; source queue order and independent regression results support this review.

### Neuve Dogfood Feedback

- Commands run: none; explicitly prohibited by current user AGENTS.md and dispatch.
- Artifact refs: this review, Phase B report, resources/check.ts/check.json/manifest.json and existing collision/lifecycle.ts evidence.
- Kanban updates: not applicable; workstream tracker authoritative.
- HITL gate: none introduced; later Phase C/runtime/release gates remain open.
- Signal value / sticking points / format feedback / backlog signals: not applicable under tool prohibition.
- Feedback artifact: this section records the explicit exception.
