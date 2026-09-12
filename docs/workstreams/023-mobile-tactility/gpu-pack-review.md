# Review: CPU024 — shared sticker pack assembly

## Verdict: APPROVE — bounded frozen source only

### Correctness Check

- Source of truth: dispatch G and recorded architecture decisions in gpu-worker-scope.md; gpu-renderer-host-plan.md; original Scene archive pinned to 789c8f096741c530b8e17307c8f120f8e302afbd and its handed-off local changes.
- Kanban ticket: WEBPOD-CPU-024, in-progress, source references SRC-CLI-1789138517245-1/-2 read before review. No parent dependency; explicit eight-source freeze unlock satisfied.
- Correctness target: exact hierarchy, geometry, materials, query/carry integration and bounded single-producer resource lifetime. Source acceptance does not activate native rendering or satisfy the final visual/performance gate.
- Dispatch scope: only the eight files in `/tmp/webpod-cpu020-frozen-20260911/manifest.json`. Patch base 6aeb023a4aeca9409fa72c6a583d4c8f24cf8ed0; patch SHA256 d2046456c6e949f62a19177cbef7fcc010b183afee467135089e9f0e0a482411. The active host Scene and projection changes are excluded.
- Review lanes: this reviewer did not author the pack implementation. All three lifecycle/admission findings below were corrected by the author and independently reverified.
- Verification so far: independently reran all four retained pack probes: 36 exact geometry cases, 108 hierarchy cases/1,296 world matrices, 54 archived material constructor comparisons, and existing actual-worker/private-port lifecycle. All pass; the additional reviewer cancellation case exposes a missing lifecycle scenario.
- Type/lint and affected existing behavior checks: the corrected eight-source snapshot passes TypeScript in an isolated source overlay, plus ESLint via each frozen source on stdin with its real project filename. Current web/composite types pass. All 33 existing pack/paper/carry/return tests pass (941,136 assertions). Every retained pack TypeScript proof and the reviewer proof pass scoped lint. Initial overlay checks needed explicit root type resolution and a composite dependency link; those harness configuration errors were corrected without changing application source.
- Git history/staging: no reviewer application edits or commits. Final archive is `/tmp/webpod-cpu020-reviewed-fix-20260911/`; patch SHA256 `a7a963ac3dd18f93f4a1c61c35296dcedb75707635456737cb3d2304d494cc31`, same base6aeb023. All eight file hashes and patch hash independently verified. Only pool corrections differ from the original frozen source; the archived Scene is unchanged.

### Findings

- **RESOLVED MAJOR — final cancelled work leaves an empty worker alive.** Frozen `sticker-paper-pool.ts:68` returns immediately when the queue is empty. A last dynamic owner terminates while its job is active (`:95–98`), or a last immutable owner releases its active resource (`:114`). Completion clears `active` (`:34` or `:55`) then calls `dispatch`, but never re-enters idle eviction. There is no resource idle timer when the cache is empty. Actual Bun worker reproduction leaves clients, entries, queued work and active work all zero, yet `worker:true`, for both cancellation paths. This violates dispatch G's cleanup requirement and the diary's final-release claim. Retained `evidence/gpu-worker/pack/reviewer-cancel.ts` and `.json` reproduce it without a browser or explicit idle cleanup before observation.
- **RESOLVED MAJOR — detached active paper loses its work reservation.** Frozen `sticker-paper-pool.ts:18` charges dynamic work only through `clients.size`; `:95` deletes a client while its native operation intentionally continues. The same reproduction observes `active:'paper'`, `worker:true`, but `accountedBytes:0`. A subsequent admission can consume the full advertised budget while the detached operation is still executing. Preserve its charge until actual completion/retirement, without destroying unrelated canonical leases.

- **RESOLVED MAJOR — cold private acquisition bypassed owner admission.** Original `sticker-paper-pool.ts:120–129` checked the32-owner limit only after awaiting shared geometry. One hundred same-input calls retained one hundred pending ports/listeners while reporting zero private owners. Corrected code reserves the owner slot before acquiring or waiting and releases it once on abort/failure. Independent actual-worker admission probe confirms only32 owners are admitted and final counts return to zero.

The corrected pool calls idle eviction when its queue drains and includes detached active paper in work count/byte admission. Independent `reviewer-cancel.ts` now observes4,194,304 charged bytes during detached work, then zero bytes and `worker:false` for both dynamic and immutable final cancellation. Author `cancellation-admission.ts` was also independently rerun, along with the original private-port lifecycle. Results match source semantics. No remaining Critical or Major source finding in these eight frozen files.

### Exact reviewed source manifest

All under `packages/device/src`: `StickerPackScene.tsx`, `sticker-paper-pool.ts`, `sticker-paper-preparation.ts`, `sticker-paper-worker.ts`, `sticker-pack-recipe.ts`, `sticker-pack-graph.ts`, `sticker-pack-resource-data.ts`, `sticker-pack-resources.ts`. The immutable factory inputs,24-segment parked prints,96-grid paper, geometry attribute/index/groups/bounds, material order and complete authored wrapper/liner/neighbor/pocket transforms remain exact. Carry and asynchronous final-save logic are unchanged relative to the handed-off original Scene. Main wrappers borrow cache bytes; renderer-private payloads are cloned in the existing paper worker and transfer without detaching main arrays. GPU bound overrides are per-wrapper and restored on cleanup; native allocation and Three constructor stages in exceptional cooperative fallback remain indivisible, with no mobile duration guarantee.

The source intentionally rejects native private acquisition if canonical paper ownership is lost; complete GL recovery is the host obligation recorded in dispatch G. This approval does not validate the evolving native host, assembled sticker textures/damage/carry, physical appearance, browser failure recovery, resizing or6× responsiveness. Those mandatory gates remain open.

### Suggestions (non-blocking)

- None.

### Neuve Dogfood Feedback

- Commands run: owning `kanban show` and `kanban context` on webpod-cpu-fixes; focused `sources --mode usage --source packages/device/src/sticker-paper-pool.ts --base 6aeb023 --head HEAD --include-uncommitted`. The source references and explicit frozen archive made the host/pack review boundary clear.
- Kanban updates: original REQUEST_CHANGES checkpoint plus final bounded source proof/evidence. Ticket/full goal are not completed by this reviewer.
- HITL gate: supervisor retains the final Neuve manual/source-correlation ledger and native browser acceptance. No process waiver is inferred and no full-goal approval is granted.
- Sticking points: a moving checkout cannot stand in for the reviewed eight-source snapshot; the manifest and patch hash are authoritative. Source correlation cannot be inferred from passing probes.
- Artifact: `.neuve-artifact/sources-1789138805-908039000-20806.json`. The source command reported SourceGuardLimit/MetadataOnlyRange/ProviderUnavailable and missing TypeScript semantic provider; no correlated source context was selected. This does not clear the supervisor’s process ledger. The frozen archive plus independent source/probe checks establish this bounded source disposition. Feedback recorded separately below.
