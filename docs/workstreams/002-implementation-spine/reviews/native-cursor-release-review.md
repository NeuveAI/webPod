# Review: native cursor release — semantic native cursors

## Verdict: REQUEST_CHANGES

### Correctness Check

- Source of truth: owner delegation, `scope.md`, `hitl-decisions.md`, `decision-log.md`, `review-system-prompt.md`, `review-lanes.md`, the native-cursor decision/diary/evidence, and the glove cancellation decision/diary were read. The owner cancellation and native cursor mapping are binding; the glove work was not reopened.
- Kanban ticket: not applicable. `scope.md` explicitly records that this repository has no Neuve shell/board and uses workstream artifacts instead.
- Correctness target: checked against the required default/pointer/grab/grabbing vocabulary, fine-pointer containment, keyboard/focus preservation, lifecycle cleanup, and deterministic/browser proof requirements.
- Dispatch scope: commit `0f56d9a` stays within `packages/device/**`, `apps/web/src/styles/app.css`, and this workstream's own artifacts. It does not touch panel, providers, server-core, device geometry/materials/lighting, audio, navigation, credentials, or `design.pen`.
- Dependency/HITL status: the glove cancellation is settled. Owner visual sign-off remains open, as required.
- Neuve HITL gate: not applicable by the repository's explicit no-Neuve ruling.
- DoD checklist: focused tests, device/web typechecks, lint, and the current repository gate are green; required mounted/computed-style cursor evidence is absent.
- Review lanes: interface and render/interaction paths were traced through the R3F shell, orientation owner, click-wheel input surfaces, canvas attributes, and app CSS.
- Type/lint/doc gates: no new type escape, lint disable, `useState`, or missing lifecycle cleanup comment was found. Exported cursor APIs have concise contract comments.
- Git history/staging: `0f56d9a` is a coherent cursor-only implementation/docs commit with no trailer. The working tree contains unrelated later/dirty work, which was not modified.
- Verification evidence: the 33 focused tests pass (181 assertions), both affected TypeScript projects pass, lint passes, and the current full gate passes (1163 tests). These checks do not close the missing mounted cursor and browser computed-style proof below.
- Decision-log status: the owner cancellation is recorded consistently in the native-cursor and glove-cancellation records. No repo-level `docs/decisions.md` or `docs/platform_decisions.md` exists.

### Findings

- [MAJOR] Orientation cursor state is implemented as a second lifecycle/state machine instead of being derived from the existing orientation owner (`packages/device/src/cursor-intent.ts:13`, `packages/device/src/DeviceCanvas.tsx:149`). The new controller independently stores `grabbable`/`active` and registers its own terminal-event listeners (`packages/device/src/cursor-intent.ts:14-16`, `packages/device/src/cursor-intent.ts:36-50`), while `bindDeviceOrientationControls` already owns and publishes the accepted drag state as `data-orientation-grab="ready|active"` on the stage (`apps/web/src/device-preview-orientation.ts:175`, `apps/web/src/device-preview-orientation.ts:180-192`). The route also still turns that original state into `grab`/`grabbing` (`apps/web/src/routes/[_]spike.device.tsx:387-394`). This creates two cursor authorities with different cancellation rules and directly violates the release contract to derive active cursor from existing interaction/drag state rather than create parallel state. The implementation must expose/consume one authoritative orientation state, not infer the same lifecycle twice.
- [MAJOR] The required deterministic and browser evidence for the integrated cursor behavior is missing (`packages/device/src/cursor-intent.test.ts:26`, `docs/workstreams/002-implementation-spine/evidence/native-cursor-release.md:30`). The only new tests call `DeviceCursorIntentController` and `setDeviceControlCursor` directly; none dispatches R3F `pointerover`/`pointerout` against the mounted annulus/Select, mounts `DeviceCanvas` to prove bind/unmount behavior, verifies the interaction between the legacy stage cursor rules and the new canvas rules, checks computed styles under fine versus coarse pointer media, or proves outside text selection/non-I-beam device text. The evidence explicitly says no browser capture was produced and then treats helper-observed attributes as primary proof (`docs/workstreams/002-implementation-spine/evidence/native-cursor-release.md:32-36`). That does not satisfy the delegated acceptance criteria for mounted idle/grab/grabbing/cancellation transitions, clickable controls, selectable outside text, coarse-pointer containment, and computed-style evidence on `/_spike/device`.

### Suggestions (non-blocking)

- Keep the wheel-control hover marker scoped to the canvas, but give it mounted R3F coverage that crosses annulus ↔ Select boundaries and verifies unmount cleanup.
- Consolidate or remove the pre-existing inline preview cursor rules when establishing the single cursor authority; otherwise browser cascade behavior remains harder to reason about than the data attributes suggest.

### Neuve Dogfood Feedback

- Commands run: none; the active workstream explicitly forbids inventing a Neuve board/ticket for this repository.
- Artifact refs: not applicable.
- Kanban updates: not applicable.
- HITL gate: owner visual sign-off remains open; no tool-generated human-routed unit exists.
- Signal value: not applicable.
- Sticking points: the `/global-patterns` skill points to `~/code/agent-context/global.md`, but this repository's canonical reference root is `~/code/agentic-context/` and no global file exists at either root.
- Format feedback: not applicable.
- Backlog signals: none.
- Feedback artifact: unavailable by explicit repository convention.

### Gates I ran myself

- `bun test packages/device/src/cursor-intent.test.ts packages/device/src/click-wheel-input.test.tsx packages/device/src/click-wheel-input.integration.test.tsx packages/device/src/orientation-grab.test.ts` → 33 pass, 0 fail, 181 assertions.
- `bunx tsc --noEmit -p packages/device/tsconfig.json` → pass.
- `bunx tsc --noEmit -p apps/web/tsconfig.json` → pass.
- `bun run lint` → pass.
- `bun run gates` → 16 automated gate classes pass, 1163 tests pass; U14 and U15 remain manual.
- `git diff 0f56d9a^ 0f56d9a --check` → pass.

### D-038 consistency questions

1. No finding contradicts the method used here: the missing-proof finding is based on direct inspection of every new test plus independent command execution, and the duplicate-state finding is based on tracing both event/state machines and the final CSS cascade.
2. The reasons support the conclusions rather than merely arriving at the same result: green helper tests prove helper transitions, but cannot prove mounted R3F event routing or browser computed styles; the source trace demonstrates two independent owners of the same orientation cursor fact.
3. Evidence class: test/type/lint results are structural execution evidence for their scoped assertions. The cursor UX conclusion remains unverified because its required mounted/browser assertions do not exist. Owner aesthetic/visual acceptance is human-judgment evidence and remains open.
