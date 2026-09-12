# Autonomous motion implementation

CPU016, in progress; source is not review-ready and no runtime/visual acceptance is claimed. Baseline for retained parity: f3d738f (accepted renderer protocol before this implementation). Parent CPU015 source contract accepted; full CPU009/012 joined acceptance remains open.

Read full dispatch F and pose-coordination plan; claimed source-linked ticket. Ownership excludes renderer/Canvas/protocol and CPU011's production/sticker integration until handoff. Main authority and pure/control files are owned here. Modern-web-guidance background-processing guidance searched/retrieved through bunx; Jotai reference store API and installed vanilla declaration read before state changes.

Initial changes: moved authored orientation equations into device/device-orientation-motion.ts with app re-export; moved exact reveal constants/curve into device/device-reveal-motion.ts with existing app call site using it; converted createDevicePreviewStore to a scoped Jotai vanilla store while retaining immutable snapshot, synchronous writes and reentrant return value. Parent approved existing source assertion to follow extracted motion ownership; it now reads the canonical pure file.

Early device-motion-runtime.ts and device-motion-driver.ts are under construction. They share exact curves and run in host renderer worker or equivalent fallback, with no separate motion worker. Driver output publication is independent of notification credit. Host interface agreement: per-device binding read/sendCommand/subscribe; stable node IDs device-model, device-model-content, wheel-assembly and select. Control program rest components require protocol refinement to avoid decomposition rounding; protocol owner haptics makes that edit, retains restMatrix for exact zero-depth restore. Driver needs final interruption, clock, live main caller and recovery integration before review.

Reveal coordination is unresolved implementation work, explicitly not waived: autonomous yaw cannot coexist with independently frozen DOM stage translation/glow. Coordinate complete presentation with host before enabling worker reveal. Plain CSS wall-clock substitution cannot reproduce the authored 32ms-clamped timeline.

Initial checks: 45 existing behavioral/source tests passed and one shell-name source assertion failed following concurrent host Device recipe extraction. Device/web typechecks passed at source-freeze checkpoint. Scoped lint passed. These are intermediate checks; final reference/lifecycle/provider proofs and integrated live callers are still required. No browser actions or commits by this engineer.

## Live integration checkpoint

Route now owns createPreviewMotionAuthority and passes it through the host author's explicitly coordinated ProductionDeviceView/Composite/Canvas prop. The orientation controller sends exact terminal pointer records and seeded releases/reset/flick to an attached complete renderer; without binding its established scheduler remains active. Binding uses one host command-sequence allocator shared with control producers. Accepted messages cannot settle tools. Stale progress/settlement and retired binding cleanup are guarded. Transport failures are contained before propagating into pointer/media callbacks.

The GL DeviceMotionBridge subscribes Jotai intent, mutates only the rigid model root and invalidates; it does not traverse descendants. Host author mounts it after Device in the committed scene. Ordinary production route reads an appearance-stable selector, while the tool store remains fully live; diagnostic routes retain detailed subscription. Main control release now shares advanceControlRelease with the worker path and attachMotion sends exact rest matrix/components, contact and timestamps. Host owns wiring that controller to its actual native input authority.

Lead resolved reveal ownership explicitly: retain one minimal main logical clock because stage transform/glow require DOM and the authored timeline clamps each frame to32ms. It publishes the same reveal progress/orientation to the renderer, with no independent worker reveal clock during entrance. This is main-coordinated entrance, not autonomous entrance. CSS glow/motes remain unchanged. Post-entry release/control autonomy remains required; lead will measure entry after heavy work removal before final acceptance.

Host/lead approved validated existing-route renderBackend worker/webgl override for development verification, defaultGL. Host owns route validateSearch and downstream rendererBackend props; this engineer only reads the validated value with TanStack useSearch strict:false in DevicePage and passes it. No raw parser or hidden route was added.

Retained intermediate proof: pinned f3d738f equation parity105 orientation cases +19 reveal boundaries; pinned original control controller versus worker step80 exact matrices with translated/rotated/scaled rest and timestamp rollback/NaN; actual controller/driver seam two simultaneous remote control releases, one rendererRAF/zero main controlRAF and exact settlement; actual main adapter/controller same-turn reads, accepted-not-settled, late settlement rejection, appearance snapshot stability and subscription cleanup. Existing behavioral suites54pass/1930assertions and Composite input suite15pass/94assertions. These do not establish native rendered quality or final source acceptance. Current work still needs model-reframe translation preservation and complete failure/lifecycle tightening before reviewer freeze.

## Approved native input ownership extension

Lead authorized extracting the existing ClickWheelInputSurface state machine into shared native-event code. This engineer owns click-wheel-input.tsx, click-wheel-input-core.ts and click-wheel-event-controller.ts. Pure geometry/capture helpers and public types moved unchanged to core and remain re-exported from the original entrypoint. The GL component now owns only its geometry, live-pose ref and committed callback adapter; both GL and native host use the same capture/arc/cardinal/Select controller. The host supplies the real canvas, current query ray, exact hit admission/occlusion and existing Composite callbacks/ControlPhysicsController. Native controller is not a fabricated Fiber RootState or ThreeEvent.

Existing mounted GL behavior passes after extraction, including planted start/move failures and lost capture. The existing control source assertion now reads the canonical shared event controller, retaining its one physical press and continuous contact checks. A retained native-input proof uses this same factory to verify cardinal acceptance once, cardinal-to-arc transition with original sample, cancellation/lost-capture idempotence and callback-failure cleanup. Actual native query admission and browser media activation still belong to host/live review.

Additional coordination fixes: imperative route motion also requires the invisible clickwheel input pose to move. A narrow approved clickwheel ref subscription now follows intent without React ticks. Host released Canvas orientation provider construction: a primitive visibleFace/frontInteractive subscription updates only semantic boundaries; an orientation getter remains live. Host added the approved per-carry-only PeelingPrint orientation subscription so geometry jobs remain current without broad scene renders. Device-model translation is preserved in adapter/driver orientation updates for sticker collection reframing; the authored model root scale is one.

During host inspection, found that worker acceptsPose required main's lastAcceptedCommand before accepting a later reliable command. This incorrectly rejects rapid commands before projection acknowledgment. Reported to host owner, who confirmed and is splitting resource validation from driver command sequencing. This finding is outside this lane's owned host source and remains a combined integration check until the fix is verified.

## Frozen implementation handoff (2026-09-11)

This section supersedes the intermediate readiness notes above. CPU016 source is frozen for independent review, not self-approved. Host complete-scene/native input integration and live visual/motion acceptance remain pending. No browser, trace, deployment, or commit was performed by this engineer.

The main authority preserves synchronous public Jotai/tool state and provider activation. Orientation releases/reset/flick and control releases use one bounded pure driver inside the renderer's scheduler after complete attachment; fallback retains the established main scheduler. The driver has at most three active channels and one frame handle, does not wait for projection receipts, and emits settlement with original command identity. Reliable command ordering, final pointer records, cancellation, pause, detach, exact rest restoration, reduced-motion settlement and stale response guards are implemented. Settlements already completed during a publication retain their original pose even if a callback starts an unrelated command. Model translation survives orientation updates.

Entrance remains explicitly main-coordinated: one authored 32ms-clamped clock updates CSS stage/glow and sends the same pose to the renderer. It is not advertised as autonomous worker entrance. Production uses a stable appearance subscription; rigid GL/query pose updates are imperative, with React publication restricted to semantic face/admission changes. The isolated carry subscription is owned by the host author.

### Exact owned source manifest

- App: `apps/web/src/device-motion-authority.ts`, `device-preview-orientation.ts`, `device-orientation-motion.ts`, `device-reveal.ts`; narrow `device-page.tsx` authority creation/prop, validated renderBackend propagation and appearance subscription.
- Device: `packages/device/src/device-motion-authority.ts`, `device-motion-runtime.ts`, `device-motion-driver.ts`, `device-orientation-motion.ts`, `device-reveal-motion.ts`, `control-motion.ts`, `control-physics.ts`, `DeviceMotionBridge.tsx`, `click-wheel-input-core.ts`, `click-wheel-event-controller.ts`, `click-wheel-input.tsx`.
- Shared `DeviceCanvas.tsx`: only live orientation provider getter, primitive face/frontInteractive selector and authority subscription were authored here; host owns all other Canvas/bridge mounting changes. File released to host.
- Existing assertions: `apps/web/src/device-preview-orientation-source.test.ts` follows exact extracted equation and two enclosure recipe input owners; `packages/device/src/control-physics.test.ts` follows canonical shared event-controller press/contact code. Host separately updated its assembly recipe assertions.
- This diary and `evidence/gpu-worker/motion/{parity,control-parity,driver,authority,native-input,provider}.{ts,json}`.

Protocol rest components/channel additions, exports, Production/Composite prop forwarding, WorkerDeviceCanvas, native query view, renderer worker/host, canonical route validation and PeelingPrint subscription are coordinated host-owned companions, not silently included in this lane's approval. Native event host uses `createClickWheelEventController({controlPhysics, callbacks, point})` with actual capture host and exact admission; GL consumes that same state machine. Listener attachment/cleanup and frame publication remain host lifetime responsibilities.

### Verification

Pinned baseline is `f3d738fca7806f86c31cc849c2312ce2d9de54e8`, not moving HEAD. Each retained proof can be reproduced with `bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/motion/<name>.ts`:

- `parity`: 105 exact orientation steps and 19 reveal boundary frames against original source.
- `control-parity`: 80 exact original-controller/worker matrices, transformed rest frames and rollback/NaN timestamps.
- `driver`: actual control controller + driver, two channels/one renderer frame/zero main control frames, exact rest, distinct origins, stale command rejection, pause/dispose, rapid commands with unacknowledged lastAcceptedCommand, and model reframe translation preservation.
- `authority`: actual adapter/controller, immediate state, accepted-versus-settled distinction, cancellation/late response rejection, stable appearance snapshot and listener cleanup.
- `native-input`: same controller factory, accepted cardinal once, cardinal-to-arc original sample, cancellation/lost-capture idempotence and callback-failure cleanup.
- `provider`: actual CompositeInputBoundary and shared controller, next-track provider invoked synchronously before any renderer acknowledgement. This is deterministic integration, not a real browser autoplay claim.

Final existing command: `bun test apps/web/src/device-preview-orientation-source.test.ts apps/web/src/device-preview-orientation.test.ts apps/web/src/device-orientation-motion.test.ts packages/device/src/control-physics.test.ts packages/device/src/click-wheel-input.test.tsx packages/device/src/click-wheel-input.integration.test.tsx packages/composite/src/CompositeDevice.integration.test.tsx` — **103 pass, 0 fail, 2,278 assertions**. Log `/tmp/cpu016-final-existing.log`.

`bun run --cwd packages/device typecheck` and `bun run --cwd apps/web typecheck` pass. `bunx --bun eslint` over every owned source, the shared Canvas file, both changed assertions and all six retained proof scripts passes. Logs `/tmp/cpu016-types.log`, `/tmp/cpu016-web-types.log`, `/tmp/cpu016-lint.log`. All six proofs rerun successfully; driver/reference proof lint repeated after final evidence-only extension.

Host confirmed the reported reliable-command projection-ack gate was removed; retained driver evidence proves its own contract, while complete host runtime verification remains separate. No measured GPU speed, browser performance or complete native scene fidelity is inferred from these deterministic checks.

### Independent review correction: reentrant publication

CPU018 found an actual same-turn nested-listener case: outer yaw10 publication resumed after a listener published yaw20 and sent stale yaw10 with a newer epoch. Corrected only device-motion-authority.ts: publication identity is checked after Jotai listeners before transport; projection callbacks require unchanged active owner and intent; settlement preserves the active record through intent notification and rejects superseded progress; reentrant binding replacement during previous-owner settlement cannot install a stale subscription. Existing authority proof, scoped lint and web typecheck pass. Source refrozen for the independent reviewer's own reproduction; this author does not approve the correction.

Further bounded reviewer corrections: direct publishIntent now explicitly rejects an active standalone release before transport, so stale projection/settlement cannot later restore its old pose even without the app-store binder. Added this actual adapter case to authority.ts; it rejects the pending release and ignores both old response kinds. On frontInteractive admission loss, the shared GL clickwheel wrapper now cancels both pointer owners and clears its cursor, and keyboard capture is attached only while admitted, preserving the former Select child unmount lifetime.64 affected existing tests/408 assertions and focused lint pass; independent CPU018 reviewer verifies these fixes. No native/browser acceptance is inferred.

## Native channel correction (implementation in progress)

Baseline driver archived in evidence/gpu-worker/motion/channel-correction/driver.before.txt, SHA256 f47b7476f8c57de4b703b5923073a2f40a44193b5a30bf51a177afbcdf831595. Independent delayed-projection proof showed a wheel contact overwriting autonomous coast yaw. Main host review is paused with REQUEST_CHANGES; this correction requires Aristotle's independent review.

Command/channel merge table, written before source changes:

| Incoming operation | Exact incoming authority | Preserve from current worker pose |
| --- | --- | --- |
| Same-epoch pose/reframe | Nonanimated nodes and model translation | Active orientation rotation/reveal; active wheel/select node matrices |
| Pointer start/release/cancel | Orientation final sample and model matrix | Unrelated active wheel/select |
| Control down/up/cancel/contact | Target wheel/select matrix/contact | Active orientation/reveal and other active control |
| Motion start | New program's channel final sample/seed | Other active channels |
| Motion cancel one channel | Target channel final sample | Other active channels |
| Motion cancel all (including hidden/unmount) | Entire final pose | None; all programs cancel |
| Motion resume | Entire checkpoint pose | None; checkpoint replaces programs |
| Reduced motion | Nonanimated pose fields | Active channels until exact existing settling equations run |
| New motion epoch | Incoming orientation/reveal and nonanimated fields | Independent control releases unless explicitly targeted; old orientation program cancels |

Model rotation preservation copies its existing linear transform entries while retaining incoming translation, avoiding decomposition and allowing packet reframe during coast. No protocol expansion or changed curve equations is intended.

Correction frozen for independent review: only packages/device/src/device-motion-driver.ts application source changed. The exact reviewer coast/contact reproduction now keeps yaw5.6899237048919105 through the command and advances to8.06196463810584 on the next frame. channel-correction/check.ts exercises three simultaneous channels, exact targeted matrix, model translation17 during coast, newer orientation epoch, independent control cancellation, hidden/unmount final samples and reveal preservation. Existing motion/preview/control/orientation suites:59 tests,1,965 assertions pass (/tmp/cpu016-channel-tests.log). Existing retained motion/driver.ts passes. Device/composite/web typechecks and scoped source/proof ESLint pass. No browser or performance claim; independent reviewer must approve, including completed-but-unreported channel semantics before acceptance.

Independent review extended the delayed-message case beyond settlement and found the first active-program-only merge insufficient. Final rule supersedes the table's “active” qualifier: same-epoch orientation/reveal remain authoritative after completion, until a new epoch or explicit orientation/all target. Control node ownership remembers at most two node IDs after release completion and preserves their current matrices for unrelated updates. This stores no historical samples/programs and clears on dispose. The reviewer completed-coast proof now retains26.666666666666668 degrees through the delayed wheel command. Exact explicit target, newer-epoch orientation, full hidden/unmount final samples and reframe translation still pass; device types/scoped lint and both authored driver proofs rerun pass. Source refrozen for independent approval.

Final caller audit refined control ownership: control-down transfers that control to main-held ownership; control-release transfers it to worker ownership, which survives settlement. Reliable unrelated commands preserve either owner's current target matrix. Generic pose updates admit main-held controls, necessary because the existing reduced-motion release publishes exact rest via native invalidation without a release program. At most two stable node IDs and two held flags are retained; explicit channel/all cancellation clears corresponding held ownership. No protocol or control-physics edits.

Actual controller/driver control-ownership.ts proves first simultaneous press, completion to exact rest, and a subsequent reduced-motion press/release after worker ownership was established. It uses the real controller and a controlled binding/query invalidation, no browser. This and both previous channel proofs pass; device types and scoped driver/proof lint pass. This refinement supersedes unconditional retention of all control matrices during generic pose updates. Independent approval must target the new frozen hash, not the previous9ff5e220 revision.
