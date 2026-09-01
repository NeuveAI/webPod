# Review: volumetric owner correction — interaction / React-Jotai / verifier / Git scope

## Verdict: REQUEST_CHANGES

### Correctness Check

- Source of truth: loaded `AGENTS.md`, `scope-volumetric-device.md`, the W8 dispatch, the complete lane decisions and diary, the workstream decision log including D-058/D-059/D-064, the project review prompt, the owner-correction evidence and summary, the strict-review skill, and the team review protocol. Browser/R3F claims were checked against the installed sources under `/Users/vinicius/code/agentic-context/react-three-fiber`, especially `docs/API/events.mdx` and `packages/fiber/src/core/events.ts`.
- Kanban ticket: none. `AGENTS.md` says this repository has no Kanban board and no Neuve shell, so no ticket was invented.
- Correctness target: VD-31 requires gesture-only selection suppression and one exhaustive teardown across release, cancel, lost capture, blur, unmount, and thrown callbacks, while preserving outside native selection, focus, keyboard input, and hit testing. The implementation does not meet the thrown-callback half, and the browser verifier does not prove the touch/outside-selection half.
- Dispatch scope: the five requested commits stay within device, composite, the existing spike route/test, and W8 bookkeeping/evidence paths. No sensor permission UX, fallback renderer, credential path, or direct `design.pen` access was added.
- Dependency/HITL status: geometry/orientation work was allowed to proceed. Final material/aesthetic acceptance and phone-in-hand thumb occlusion remain owner-only and are not cleared by this review.
- Neuve HITL gate: unavailable by standing repo law; no Neuve/Kanban commands were run.
- DoD checklist: scoped typecheck, lint, package tests, build, and static gates pass. Interaction correctness and immutable browser evidence do not.
- Review lanes: this file covers pointer interaction, React/external-store structure, HTML-in-canvas native DOM behavior, verifier quality/source health, and Git scope only. It does not grant owner visual acceptance.
- Type/lint/doc gates: `packages/device`, `packages/composite`, and `apps/web` typecheck clean; repo lint is clean; exported lifecycle helpers have substantive documentation. No `useState` was introduced. The required naming sweep found an implementation comment containing `W8`.
- Git history/staging: commits `44dccdd`, `5b37c40`, `52fe26b`, `1107ae8`, and `fe9ecc4` have no prohibited trailers. `5b37c40`, `52fe26b`, `1107ae8`, and `fe9ecc4` are scoped. `44dccdd` combines two independent surfaces (shell topology and the product light rig), contrary to the scope's granular history plan, though the patch remains inspectable.
- Verification evidence: the saved owner-correction browser summary is a mutable worktree snapshot (`reviewedCommit` and `reviewedTree` are both null), not immutable evidence for `711f858..fe9ecc4`. Its touch and outside-selection assertions can pass without exercising the claimed native behaviors.
- Decision-log status: VD-29 through VD-31 record the owner correction. D-064 was applied to review reasoning: counterfactual plants were checked against their predicates before drawing conclusions. The modern-web-guidance helper could not be executed because that skill shells through `npx`, which `AGENTS.md` forbids; the Jotai skill's referenced `/Users/vinicius/code/agent-context/jotai-react-query.md` file is absent. Neither limitation is used as evidence for a browser or Jotai claim.

### Findings

- [MAJOR] A thrown start or move callback strands the active R3F capture and its listeners (`packages/device/src/click-wheel-input.tsx:287`) — `setPointerCapture`, the active slot, and the cancel/lost-capture/blur listeners are installed before `onArcStart` runs at line 322, but that call has no `try/finally`; `onArcMove` at line 331 is likewise unguarded. The composite catch at `packages/composite/src/CompositeDevice.tsx:195` only stops selection and rethrows, so it cannot clear the device slot, release capture, or remove the device listeners. The next gesture is then rejected by the non-null slot at line 275 until a later blur/unmount happens. This directly violates VD-31 and the owner's explicit thrown-callback teardown requirement; the green tests pass because the device suite never supplies a throwing callback and the composite suite invokes handlers without mounting the R3F capture layer.

- [MAJOR] The browser touch proof is vacuous and can pass when no touch gesture ever starts (`apps/web/tests/volumetric-device-verification.e2e.ts:210`) — after dispatching touch start/move/cancel, the test asserts only the terminal absence of the active attribute, non-`none` selection CSS, and zero ranges at lines 229–232. Those are also the initial conditions if the coordinates miss the annulus, CDP fails to synthesize Pointer Events, pointer capture never begins, or all three dispatch calls are removed. It never observes the active marker/capture after `touchStart`, never proves a touch detent, and never proves a subsequent real gesture works. Therefore the evidence claim that “real browser mouse/touch proof” verifies the interaction can be green for the wrong reason (D-058/D-064).

- [MAJOR] The claimed outside native-selection proof bypasses native selection entirely (`apps/web/tests/volumetric-device-verification.e2e.ts:234`) — the test constructs a `Range` and calls `Selection.addRange()` programmatically. CSS `user-select: none`, an over-broad `selectstart` cancellation, or broken mouse drag selection can all coexist with a successful programmatic range, so this does not prove the owner target that outside text remains natively selectable. The evidence overstates this at `docs/workstreams/002-implementation-spine/evidence/volumetric-device-owner-correction.md:86`. Use a real Playwright mouse drag over pre-existing outside text, assert the selected text, then exercise focus/keyboard/hit testing and another wheel gesture afterward.

- [MAJOR] The committed browser evidence is not bound to any reviewed Git object (`docs/workstreams/002-implementation-spine/evidence/volumetric-device-owner-correction/summary.json:8`) — both `reviewedCommit` and `reviewedTree` are null, while the prose calls the digest a source-health match at `docs/workstreams/002-implementation-spine/evidence/volumetric-device-owner-correction.md:105`. `expected === current` proves only that an isolated worktree snapshot did not mutate during that run; it does not let a reviewer reconstruct which source produced these images or establish that it was commit `1107ae8`/range head `fe9ecc4`. This is especially material in the dirty shared checkout. The repository already supports immutable `W5B_SOURCE_COMMIT` snapshots; the owner-correction evidence must use and assert that identity.

- [MAJOR] A workstream identifier leaked into production implementation commentary and the naming gate cannot see this variant (`packages/device/src/Device.tsx:458`) — the comment says “W8 targets,” contrary to the mandatory product/domain naming rule. The static predicate at `scripts/gate-core.ts:78` only scans `002`, `implementation-spine`, and `workstream`, which explains why `bun run gates` remains green. This is a concrete verifier hole as well as a naming violation: the required sweep must include dispatch-ID variants or the comment must use the actual product invariant (edge/flip continuity) without bookkeeping vocabulary.

- [MINOR] Commit `44dccdd` mixes independent shell-topology and lighting-rig changes (`packages/device/src/curved-shell.ts:1`, `packages/device/src/light-rig.ts:1`) — D-059 and the scope's Git plan require dependency-based boundaries; geometry continuity and lamp placement have no symbol dependency. The combined commit is still inspectable, so this is not the reason for the blocking verdict, but it weakens bisectability and independent replay.

### Suggestions (non-blocking)

- Preserve backward-selection direction as well as range endpoints when snapshotting selection; cloned `Range`s do not retain anchor/focus direction.
- Add a combined mounted test that wires `ClickWheelInputSurface` through `CompositeInputBoundary`, plants throws in start and move, proves the plant executed, and then verifies capture/listeners/selection state are clear and the next gesture succeeds.

### Gates I ran myself

- `bunx tsc --noEmit -p packages/device/tsconfig.json` → pass.
- `bunx tsc --noEmit -p packages/composite/tsconfig.json` → pass.
- `bunx tsc --noEmit -p apps/web/tsconfig.json` → pass.
- `bun run lint` → pass.
- `bun test packages/device/src/click-wheel-input.integration.test.tsx packages/composite/src/CompositeDevice.integration.test.tsx` → 8 pass, 0 fail.
- `bun test packages/device/src packages/composite/src` → 175 pass, 0 fail.
- `bun run build` → pass; existing large-chunk warning only.
- `bun run gates` → pass, including 11/11 TypeScript projects and the repository test/static-gate sweep; the green result does not cover the findings above.
- `git diff --check 711f858..fe9ecc4` → one Markdown hard-break/trailing-space report in the evidence date line; no implementation whitespace failures.
- `git log --format='%h%n%B' 711f858..fe9ecc4` plus per-commit inspection → five requested commits present, no prohibited trailers.

### Neuve Dogfood Feedback

- Commands run: none; `AGENTS.md` explicitly says there is no Neuve shell or Kanban in this repository.
- Artifact refs: not applicable.
- Kanban updates: not applicable; no ticket was invented.
- HITL gate: owner visual/material acceptance and phone-in-hand thumb occlusion remain open owner gates.
- Signal value: not applicable.
- Sticking points: the generic strict-review skill expects Neuve, while repository standing law explicitly disables it.
- Format feedback: repository-local workstream artifacts supplied the necessary scope, decisions, diary, evidence, and lane boundary without a ticket layer.
- Backlog signals: none recorded outside this assigned review file.
- Feedback artifact: this review records Neuve unavailability as required; no separate artifact was permitted by the assignment.

---

## Re-review — commits `4564973` and `be5f485`

## Verdict: APPROVE

### Correctness Check

- Callback-failure lifecycle: `ClickWheelInputSurface` now catches start and move failures, runs the canonical capture teardown, dispatches cancellation to the composite runtime/selection controller, and rethrows the original error. Independent planted failures fired for both callbacks, capture was released, cancellation was recorded once, and a following gesture completed.
- Touch/browser path: the exact immutable snapshot observes the active gesture marker and `user-select: none` immediately after CDP touch start, observes an actual highlighted-row change after touch moves, cancels, verifies scoped style/attribute cleanup, and completes a later mouse gesture.
- Outside native selection: the verifier now uses a real Playwright mouse drag over text outside the device. It verifies that selection exists and is preserved while a subsequent wheel gesture changes the active row. No document/body-wide selection suppression was added; the capture-phase `selectstart` guard remains attached only to the composite root during an active gesture.
- Focus/keyboard/HTML-in-canvas: the same browser run retained the existing real DOM panel geometry, click focus, and keyboard navigation assertions before exercising wheel input. The panel remained on the native T1 DOM-in-canvas path.
- Naming: the `W8` implementation comment was replaced with product language. A fresh sweep of `packages/**` and `apps/**` found no initiative-id/title leak; remaining numeric matches are ordinary constants.
- Evidence provenance: the committed and independently regenerated summaries identify commit `4564973e10a655c4684189492afcdfaae042ca58`, tree `8fc7834ee389e60d1cfe1393c57e2980409de642`, fingerprint `87ab3b953956718881e6486430214f91cbfadb003591f4a7673243153e1bbe53`, and 180 source files. The regenerated summary is byte-for-byte identical to the committed artifact.
- Git scope: `4564973` contains the interaction implementation, deterministic tests, browser verifier, and the existing diagnostic route fixture needed for native outside-selection proof. `be5f485` contains the corresponding decisions/diary/evidence refresh. Both commit messages are trailer-free. The earlier non-blocking `44dccdd` boundary observation remains historical and does not block these corrections.
- HITL: owner material/aesthetic acceptance and phone-in-hand thumb occlusion remain owner-only and are not cleared here.

### Findings

- [INFO] All five prior Major findings are resolved. No new Critical, Major, or Minor interaction/verifier finding was found.

### Suggestions (non-blocking)

- The earlier suggestion to preserve backward-selection direction remains optional; current product acceptance concerns the selected content/ranges and native outside selection, both of which are now proved.

### Gates I ran myself

- `bunx tsc --noEmit -p packages/device/tsconfig.json` → pass.
- `bunx tsc --noEmit -p packages/composite/tsconfig.json` → pass.
- `bunx tsc --noEmit -p apps/web/tsconfig.json` → pass.
- `bun run lint` → pass.
- `bun test packages/device/src/click-wheel-input.test.tsx packages/device/src/click-wheel-input.integration.test.tsx packages/composite/src/CompositeDevice.integration.test.tsx scripts/browser-source-fingerprint.test.ts` → 21 pass, 0 fail; both planted callback exceptions fired and were observed before recovery assertions.
- `W5B_SOURCE_COMMIT=4564973e10a655c4684189492afcdfaae042ca58 bunx playwright test apps/web/tests/volumetric-device-verification.e2e.ts --config apps/web/tests/playwright.config.ts` → 1 pass against commit `4564973e10a655c4684189492afcdfaae042ca58` / tree `8fc7834ee389e60d1cfe1393c57e2980409de642`.
- Independent regenerated `summary.json` versus committed owner-correction `summary.json` → byte-for-byte identical.
- `git rev-parse 4564973e10a655c4684189492afcdfaae042ca58^{tree}` → `8fc7834ee389e60d1cfe1393c57e2980409de642`.
- Initiative-name sweep across `packages/**` and `apps/**` → no implementation leak.
- `git diff --check fe9ecc4..be5f485` → pass.
- Trailer scan for `fe9ecc4..be5f485` → no prohibited trailer.

### Neuve Dogfood Feedback

- Commands run: none; repository standing law still declares Neuve/Kanban unavailable.
- HITL gate: owner visual/material acceptance and phone-in-hand thumb occlusion remain open.
- Feedback artifact: this appended re-review is the only permitted review artifact.

---

## Final regression re-review — commits `325e8e4` and `0442b26`

## Verdict: APPROVE

- The canvas context now carries the same injected `DeviceFormParams` consumed by the visible device, and the click-wheel plane resolves its z position from that form. The planted 6.2/6.2 crown moved the mounted input plane by more than five model units while retaining the required 0.25-unit clearance from the visible wheel.
- The previously approved lifecycle remains intact: thrown start/move plants fired, capture/listeners were cleaned, the original errors were observed, cancellation ran once, and following gestures succeeded. Scoped selection restoration, focus/keyboard behavior, active CDP touch plus a real detent, post-cancel recovery, native outside mouse selection, and preservation of that selection through another wheel gesture all passed in the exact browser snapshot.
- The independent browser run identified commit `325e8e4eb8c070372b79ae7f12c59ae4eadc7244`, tree `2e67be51dc95456029aa2a88fc4ca5f3df8ebaa5`, source fingerprint `044acfeaaa75ee9eb6dfb73990559df0ee691b811399e70bad32bf6cc8930155`, and 180 files, matching the committed summary identity.
- [INFO] The regenerated summary differed only in the hash of `correction-room-corner-left-beauty.png` (`e811…` regenerated versus `f201…` committed). Source identity, geometry diagnostics, and every interaction assertion matched; this aesthetic screenshot variance is outside this interaction regression lane and does not block approval.

### Gates I ran myself

- Device/composite/web scoped TypeScript checks → pass.
- `bun run lint` → pass.
- Focused capture, selection, form-injection, and source-fingerprint tests → 22 pass, 0 fail.
- Immutable `W5B_SOURCE_COMMIT=325e8e4eb8c070372b79ae7f12c59ae4eadc7244` volumetric Playwright run → 1 pass.
- `git rev-parse 325e8e4eb8c070372b79ae7f12c59ae4eadc7244^{tree}` → `2e67be51dc95456029aa2a88fc4ca5f3df8ebaa5`.
- `git diff --check be5f485..0442b26` and trailer scan → pass.
