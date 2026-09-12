# Independent renderer motion protocol review

CPU-015, 2026-09-11. Reviewer: mobile_framing; protocol author: haptics. Source contract **accepted after two author corrections**. This unlocks CPU-016 implementation only. CPU-009 renderer implementation and CPU-012 coordinated visual/motion acceptance remain open. No browser, presentation, GPU timing, or full host lifecycle claim follows from this review.

Reviewed the complete gpu-worker scope, renderer-host plan and pose-coordination plan, `packages/device/src/device-render-protocol.ts`, and the notification interface in `render-channels.ts`. Compared the seed fields against current `apps/web/src/device-orientation-motion.ts`, `device-preview-orientation.ts`, `device-reveal.ts`, and `packages/device/src/control-physics.ts`. Installed Three 0.185.1/Fiber 9.7.0 remain the rendering dependency authority; this contract introduces no new library API.

## Findings resolved by the author

1. **Concurrent checkpoint settlement identity.** The first draft stored bare programs and only the pose's global lastAcceptedCommand. Wheel/select releases can coexist (`control-physics.ts:331`), so a replacement worker could not attribute each resumed program's settlement to its original command. `device-render-protocol.ts:64` now gives every program an origin containing commandSequence and motionEpoch. A later command no longer destroys the information required to settle earlier independent channels. Runtime channel cancellation remains the implementation's obligation.
2. **Control clock state was lossy.** The first draft represented control timing using elapsed/previousStep fields. The existing controller independently retains startedAtMs and lastTimestampMs and permits elapsed to regress while its monotonic comparison reference remains unchanged (`control-physics.ts:71`, `:341`). The final control seed at `device-render-protocol.ts:73` retains both timestamps and stalledFrames exactly, along with initialDepth, duration, contact angle and rest matrix. No reconstruction from an ambiguous elapsed field is required.

The reviewer did not author either protocol correction. The only separate application-source edit during this review was CPU-014's requested CPU-010 snapshot ownership TSDoc clarification, with no behavioral change.

## Accepted source guarantees

- `RenderCommandBase` (`:87`) embeds a full pose barrier. Pointer release/cancel carries the terminal sample and pointer identity on the reliable command path; an overwritten transient pose cannot erase that payload. Orientation release estimation stays on main, including the existing up-event update before velocity estimation (`device-preview-orientation.ts:344`). Its resulting closed motion seed retains unwrapped yaw, velocity, target and flick direction.
- Renderer envelope epoch, command sequence, motion epoch, pose sequence and scene/resource/layout revisions are explicit. The command pose can be validated against the exact immutable query/resource lease. Submitted projection packages camera/screen transforms and semantic pose together (`:101`). Public immediate intent is not implicitly declared displayed.
- Accepted/rejected and settled/cancelled responses are separate (`:137`). Projection acknowledgments and paint credits do not masquerade as action completion. The per-program origin survives checkpoint replacement; newer external authority can reject an older settlement without confusing it with another program.
- All wire timestamps declare `performance.timeOrigin + monotonic timestamp` (`:45`). Main converts event timestamps. Reveal remains a logical elapsed timeline with a previous-step checkpoint, while orientation advances by actual positive elapsed time and controls retain their original absolute start/last values. Runtime recovery must deliberately handle hidden intervals rather than accidentally adding them to the authored reveal curve.
- Reveal publicActive, settled and timelineComplete are separate (`:22`): the source can represent the 1900ms public settlement and continuing 3460ms hint. Reduced-motion changes, resume and cancellation are ordered commands. Nothing in the type requires reveal rotation to run on a clock independent from stage translation/glow.
- Wheel contact angle is a separate ordered record; release programs retain exact contact angle and rest matrix. Control visual updates remain independent from synchronous main media/haptics activation.
- `createLatestRenderChannel` bounds notifications to one in flight plus one latest pending value. Its acknowledgment affects only notification delivery. The protocol does not require worker motion/rendering to wait for a main-per-frame acknowledgment.

## Evidence and checks

Retained `evidence/gpu-worker/protocol/review.ts` and `review.json` exercise the actual notification helper: 1000 unacknowledged offers retain one pending latest, stale acknowledgments are rejected, pause/resume preserves the latest value, disposal prevents further sends. The fixture retains three distinct program origins through structuredClone and demonstrates representable regressing control time. This is a source-contract/queue experiment, not an implementation of the future worker scheduler.

Commands run independently:

```sh
bun test apps/web/src/device-orientation-motion.test.ts apps/web/src/device-preview-orientation.test.ts apps/web/src/device-preview-orientation-source.test.ts packages/device/src/control-physics.test.ts packages/device/src/orientation.test.ts
bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/protocol/review.ts
bun run --cwd packages/device typecheck
bun run --cwd apps/web typecheck
bunx --bun eslint packages/device/src/device-render-protocol.ts packages/device/src/render-channels.ts docs/workstreams/023-mobile-tactility/evidence/gpu-worker/protocol/review.ts
```

Existing tests: **59 pass, 0 fail, 1961 assertions**. Device/web typechecks and scoped lint pass. Logs: `/tmp/cpu015-tests.log`, `/tmp/cpu015-device-types.log`, `/tmp/cpu015-web-types.log`, `/tmp/cpu015-lint.log`.

## Implementation gates retained

Types provide the required information; they do not enforce numeric validity, matching nested revisions/epochs, ordered cross-port admission, capacity rejection, channel-specific interruption, or program uniqueness. CPU-009/016 must reject inconsistent barriers and stale generation replies, bound reliable commands, preserve final release before starting its seeded motion, retain same-turn/reentrant public writes, and distinguish command acceptance from actual settlement. A transport send exception must retire/recover the owner, since an in-flight notification cannot be silently abandoned.

Hidden/resume/replacement must retain or explicitly cancel each active program and preserve authored rest transforms without replaying media. Reveal needs one coherent presentation strategy for rotation, stage travel and glow, including the 32ms clamp and interruption phases. Notification credits must remain independent from animation progress. Exact final frame/rest restoration, actual settled tool promises, two owners, cancellation/reentrancy, reduced motion and resumed-input alignment still require the planned integration experiments and foreground Chrome comparison. CPU-015 does not approve those unfinished behaviors.
