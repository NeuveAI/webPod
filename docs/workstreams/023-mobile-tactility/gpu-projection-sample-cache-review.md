# Review: exact sticker projection sample reuse

## Verdict: APPROVE

### Correctness Check

- Source of truth: frozen `packages/device/src/sticker-transform-projection.ts`, SHA256 `6a0069cbbd654e4f72a18e4d581f1bdb4c03cd35fbc5993e94064af7d3080840`; baseline `8d95ff9`. Independently verified archived baseline equals the original file with only its Three import rewritten.
- Kanban ticket: none; latest user AGENTS.md and dispatch explicitly require the workstream tracker and no Neuve shell/board.
- Correctness target: exact nine UV sample choices with live position reads, unchanged clipping/winding/area results, bounded weak ownership and conservative public-geometry fallback.
- Dispatch scope: only the named production file changes. Author proof/implementation report and lead scope/feature-complete plan consumed in full. Unrelated `.gitignore` and concurrent evidence files left untouched.
- Dependency/HITL status: scoped implementation was authorized; lead-approved live-position refinement is recorded. This narrow code approval does not resolve the independent browser/performance or release gates.
- Neuve HITL gate: not invoked under explicit current instructions. Previous release gates remain separate.
- DoD checklist: deterministic behavior, type/lint and source review pass; actual browser measurements remain lead-owned and no performance win is asserted here.
- Review lanes: independent source, mutation/lifetime, caller coverage and deterministic proof. Strict-critique and team review protocol consumed. No further reviewer decomposition warranted for this single pure-math file.
- Type/lint/doc gates: independently ran device and web package typechecks (exit0), scoped eslint on source/proof (exit0), and `git diff --check` (exit0). Added helper documents admission and live-position invariant. The heterogeneous dependency array is used only for identity comparison; no unsafe type escape or new boundary cast is added to production.
- Git history/staging: coherent single-source optimization plus proof/docs, ready for one scoped commit. No commit or staging performed by reviewer.
- Verification evidence: reran `bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/projection-cache/check.ts`:36 exact comparisons; first97×97 scan188,180 UV scalar reads and20 warm pose queries0 UV reads. Reran existing projection tests:6 pass,45 assertions. Inspected proof rather than treating output as exhaustive coverage.
- Decision-log status: repo `docs/decisions.md`, `docs/platform_decisions.md` and workstream023 `decisions.md` are absent. Binding choices are in the scope, implementation report and feature-complete plan; unrelated workstreams were not loaded.

### Findings

- [INFO] No blocking correctness finding. Original min/max, nearest-sample threshold and strict `<` comparison are preserved, so equal-distance ties retain first-index order. Null/invalid sample behavior and all projection math are unchanged. Cached values hold indices only; deformations and replacement position attributes remain live even without a position version bump.
- [INFO] Admission is checked for every call through `preparedStickerContourWear`. Lost geometry dependency authority falls back to the original scan. Within admitted geometry the UV stamp includes backing array/buffer/view, layout, normalized state, interleaved data/version and getters. WeakMap ownership has one entry per live UV attribute with no camera/pose history or geometry retention. Versioned UV mutation and replacement cannot reuse the previous selections. Raw unversioned writes to an already-published prepared UV are outside the established immutable producer contract; unknown/public geometry always scans.
- [INFO] Canonical source inspection supports that contract: `sticker-prepared-damage.ts:33–77` borrows completed arrays and registers contour authority only after preparation; `sticker-surface.ts` creates UV before publication; `sticker-free-carry.ts` deforms positions while reading UV; `sticker-carry-computation.ts:141` publishes position revisions; `sticker-paper-transfer.ts:35` restores fresh UV attributes. Installed Three0.185.1 `src/core/BufferAttribute.js:155` increments version only on needsUpdate; `InterleavedBufferAttribute.js:102,286,302` forwards version and implements normalized strided reads. The implementation uses these actual types/getters.
- [INFO] Coverage includes native equipped (`packages/composite/src/native-sticker-resources.ts:85`), carry (`native-carry-resources.ts:22`), normal pack queries (`native-pack-resources.ts:83`) and GL (`packages/device/src/sticker-prepared-damage.ts:91`) through contour-enabled preparePrint. Material warmup can omit contours and remains uncached. No runtime hit-rate percentage is claimed.

### Suggestions (non-blocking)

- The retained proof exercises several mutations after prepared authority has already become invalid, so those cases primarily prove fallback parity. Future proof expansion can explicitly re-register preparation between successive mutations and add a duplicate-UV fixture, independently exercising cache admission renewal and tie order. Current code inspection and exact selection preservation establish these narrow invariants; this does not block the change.

### Neuve Dogfood Feedback

- Commands run: none; current user AGENTS.md and explicit dispatch prohibit Neuve shell/board use.
- Artifact refs: this review, implementation report and `evidence/gpu-worker/projection-cache/{baseline.txt,check.ts,check.json,manifest.json}`.
- Kanban updates: not applicable; workstream tracker is authoritative.
- HITL gate: no new gate introduced; browser and existing release review stay separately owned.
- Signal value / sticking points / format feedback / backlog signals: not applicable under current tool prohibition.
- Feedback artifact: this section records the explicit exception.
