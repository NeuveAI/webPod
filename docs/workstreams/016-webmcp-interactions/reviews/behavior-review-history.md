# Review: 016 — WebMCP interaction behavior

## Verdict: REQUEST_CHANGES (core behavior; orientation slice approved)

### Correctness Check

- Source of truth: repo AGENTS.md; scope.md criteria 6/8; decisions D1–D8; review-system-prompt.md; evidence/spec-research.md and interaction-research.md; diaries/orientation.md. Local physical motion implementation inspected in full. Current Web Interface Guidelines retrieved for animation interruption/reduced-motion guidance. Global-patterns, Jotai, interface-craft/design-critique, strict-critique and team review protocol loaded. No repo-wide docs/decisions.md or docs/platform_decisions.md exists.
- Kanban ticket: none; repo explicitly has no board.
- Correctness target: production orientation ownership, degree-delta clamping, physical face settlement, interruption and teardown.
- Dispatch scope: only device-preview-orientation.ts and its tests reviewed now; complete behavior/SFX/readiness lane pending core completion.
- Dependency/HITL status: orientation permitted under D8; no sticker review or implementation performed.
- Neuve HITL gate: unavailable per repo law.
- DoD checklist: orientation blocked on finding below; complete workstream not reviewed yet.
- Review lanes: this is the independent orientation subset of behavior lane; protocol lane separate.
- Type/lint/doc gates: scoped ESLint passed; app tsc failed in concurrently changing packages/composite/src/interaction-audio.ts:289 (TS2367, redundant system comparison), outside this slice. Exported orientation seam documents units and settlement; no new type escapes found.
- Git history/staging: uncommitted per D6; orientation source/tests form a coherent staged group.
- Verification evidence: independently ran `bun test apps/web/src/device-preview-orientation.test.ts apps/web/src/device-orientation-motion.test.ts apps/web/src/device-flick-regression.test.ts apps/web/src/device-preview-orientation-source.test.ts`: 49 pass, 0 fail, 248 assertions. `bunx eslint apps/web/src/device-preview-orientation.ts apps/web/src/device-preview-orientation.test.ts`: exit 0. `bunx tsc --noEmit -p apps/web/tsconfig.json`: exit 2 as attributed above. Read scheduler tests and traced real requestAnimationFrame ordering, including pre-abort, disposal, repeated front/back, changing reduced-motion preference and generation-based cancellation. Independent adversarial probe below reproduced missing ownership cancellation.
- Reviewed file fingerprints: orientation source `9436a9a95fd67a115dd4b4651a1137e86cc22c7a`; tests `13836c563ace47d40de3ce15650ab84bf2394832` (git hash-object).
- Decision-log status: D1 sound policy respected as review constraint; D2 degree mapping and D8 ownership observed. No visual/browser proof claimed for this controller-only review.

### Re-review evidence

The orientation blocker is resolved at source `730730a4f2ef1a2d1d57c315de9b432b19ccd46d`, tests `12551e25ccb0f5bc20ba5c2adea6000d771d3b5b`. The controller now compares the intended clamped publication value, allowing nested external values to interrupt ownership; generation checking prevents rescheduling after both intermediate and final-frame cancellation. Independently reran the same four focused files: 51 pass, 0 fail, 260 assertions; scoped ESLint exit 0; app tsc exit 0. New intermediate/settlement regression tests reproduce the original failure and now pass. Prior evidence below is retained as review history, superseded by these gates.

### Findings (resolved history)

- [RESOLVED MAJOR] External writes made synchronously during a frame publication fail to cancel the flick (`apps/web/src/device-preview-orientation.ts:436`; publication at line 247). The `publishing` boolean suppresses the controller subscriber for the entire `store.setOrientation()` notification cascade, including a nested external `store.setPose()` call. Consequently the external pose is visible briefly, then overwritten by the next physical frame, and the tool reports successful settlement. This violates scope criteria 6/8 and the diary's external-mutation interruption guarantee. Reproduction using the real preview store and a requestAnimationFrame-equivalent queued scheduler: register a subscriber that calls `store.setPose('edge')` once; start `controls.flick('back', signal)`; advance one 16ms frame. Observed `{pitchDeg:0,yawDeg:-90,rollDeg:0}` with `isAnimating() === true`; drain frames and the promise resolves successfully at `{pitchDeg:0,yawDeg:180,rollDeg:0}`. Distinguish the controller's intended publication from nested external mutation, cancel pending motion, reject with AbortError, and preserve the external state. Add regressions both during an intermediate frame and during final settlement; current external-write test only mutates between frames and misses this path.

### Suggestions (non-blocking)

- None.

### Neuve Dogfood Feedback

- Commands run: none; repo AGENTS.md explicitly states no Neuve shell or board.
- Artifact refs: this review, orientation diary and source/mapping evidence above.
- Kanban updates: not applicable.
- HITL gate: no applicable tool-generated gate.
- Signal value: not applicable.
- Sticking points: none.
- Format feedback: not applicable.
- Backlog signals: none.
- Feedback artifact: unavailability recorded here.

### Core review in progress (not a final core disposition)

Independently ran tools interactions suite: 12 pass, 96 assertions; state detent/feedback/store, composite interaction audio and page-readiness suites: 122 pass, 624 assertions. Core implementer states Panel/readiness, physical contact lifecycle and tests are still changing. Relayed three areas for final verification: provider loading with an existing current track must not inherit presentation-ready classification; agent/human shared physical contacts must not release each other; stale feedback type-test suppression must be replaced under D1. No uncompleted core behavior is approved by the orientation-only verdict.

### Open core findings

- [MAJOR] Agent cleanup releases the replacement human physical contact (`packages/composite/src/CompositeDevice.tsx:549`). Human center input first calls `controlPhysics.pressSelect()` (`packages/device/src/click-wheel-input.tsx:861`), then invokes Composite's `onSelectStart`, which aborts the agent operation. Agent's async `finally` subsequently calls `releaseSelect()` on that same controller, releasing the still-held human button. Wheel/arc handoff has equivalent ownership overlap. The added admission check at Composite line 525 only checks center/cardinal pointers, not already-active arcs or keys. Additionally normal completion releases at line 542 and unconditionally again at line 549 after awaiting provider work, so a delayed completion can release a later human contact. Scope criteria 5/8 require preserved physical human interaction and bounded ownership. Cleanup must be exact-once and must not mutate a newer owner's contact; deterministic integration proof must check actual physical hold/depth and human/agent semantics in both arrival orders.
- [MAJOR] New loading episodes inherit an earlier operation's wall-clock start (`packages/panel/src/Panel.tsx:91`, `:365`). Every activity supplies `operationIdentityAtom.startedAtMs`, but it changes only at provider reset (null) and list selection (Date.now). Later scrub commit, queue selection/load, or provider rebuffer therefore resets the clock using the previous track-selection timestamp; elapsed includes time spent listening. When that timestamp is null, a newly observed operation remains without elapsed even though the application can capture its start. This contradicts criterion 4/D4's actual-operation wall clock. Associate operation identity/start with each newly begun real operation and verify at least two separate loading episodes through mounted Panel behavior, not only the isolated clock reducer.

The previously reported existing-track loading misclassification is now patched at Panel.tsx:85; its final integration proof remains pending. The findings above were relayed directly to the implementer and lead while core remains in progress.

Latest fix follow-up: Composite contact cleanup now skips all physical release whenever any human contact exists (line 558 at inspection), which strands independent channels: agent center interrupted by human wheel arc never releases select; human wheel end only releases wheel. Reverse arrival strands wheel. This is the same open ownership Major until channel-specific cleanup and actual physics regressions pass. The clock now resets same-key ready-to-busy transitions at now(), addressing the stale-time mechanism; mounted evidence is pending before closure.

Clock re-review: provider context publication now precedes replacement operation identity reset, avoiding the transient-state false timestamp. Independently reran Panel integration plus clock tests: 18 pass, 143 assertions; app tsc exit 0. The mounted test verifies existing-track buffering, two separated episodes, frozen completion duration, error and initially-loading replacement with unknown elapsed. Clock Major and initial buffering misclassification are resolved.

Physical re-review: per-channel generation counters now protect same-channel human takeover and release unrelated channels exactly once. Newly added mounted physics test initially checked wheel z, although real wheel travel is quaternion tilt (control-physics.ts:152). Test correction requested before closing ownership finding; center z remains correct. Current independent Composite result: 14 pass, 1 fail at the inaccurate wheel assertion.

Additional actionable-failure issue relayed: if Hold engages during the agent's 80ms press, dispatch returns false while pageState still reports ready; select_item should provide a truthful failure reason (criterion 3), not an unexplained accepted:false. Protocol lane flagged the contract; behavior lane confirmed the concrete Hold race.
