# Pose, reveal, control and main UI coordination

CPU-007 architecture follow-on for CPU-012, grounded in audit D and the current gpu-worker-scope.md. This is a proposed bounded implementation dispatch, not application changes or review of unfinished CPU-009/010 code. CPU-012 may start after independent acceptance of the stable CPU-009 typed pose/ordered-command source contract. It need not wait for CPU-009's full visual/motion acceptance, which necessarily remains open until this integration exists. No native preference or whole-goal completion follows from protocol acceptance.

## Execution ownership

Main keeps DOM events, pointer capture, keyboard focus, reduced-motion observation, public/tool-readable state, navigation, provider activation, haptics/audio and exact immediate query admission. Worker owns autonomous orientation release, control release and render scheduling using shared pure motion equations. Its published visual pose is distinct from the immediate command authority. Neither worker results nor a delayed React effect may undo a newer main command.

Proposed CPU-012 files: apps/web/src/device-preview-orientation.ts, device-orientation-motion.ts, device-reveal.ts, device-reveal-state.ts, production-device-view.tsx and narrow device-page.tsx subscription/reveal integration; packages/device/src/control-physics.ts and its binding scope/hooks; a shared pure motion module and typed pose adapter agreed with CPU-009. The device-page.tsx ownership expansion is necessary because its line170 useSyncExternalStore currently subscribes the page to the whole preview snapshot. Coordinate exact protocol/runtime edits with CPU-009; do not independently redefine renderer generation or resource adoption. Wait for CPU-010's control-physics/assembly mutation changes to freeze before editing those files. CPU-011 owns fitting/persistence and dense sticker work.

The existing preview store at device-preview-orientation.ts:59 is a mutable closure plus listener set. Preserve its synchronous immutable snapshot API and reentrant subscriber behavior while backing the public authority with a scoped Jotai store, as repo law requires for new state work. Do not introduce a parallel worker-owned product store. Store orientation, derived preset, command/motion revision and required admission metadata in one coherent publication; scalar selectors keep unrelated UI subscriptions quiet. Keep colourway/room changes independent from motion.

## Exact authored motion contracts

Orientation: preserve XYZ Euler convention, pitch[-45,45], roll[-18,18], normalized public yaw and unwrapped internal yaw. Direct pointer gains remain pitch0.28, yaw0.42 and roll0.18 degrees/pixel. The same up event is applied through updateGrab before release velocity is estimated (device-preview-orientation.ts:354). Keep the 12-sample bound,110ms velocity window,72ms stale cutoff,5000px/s jump rejection, reversal handling and roll-mode mapping. Cancellation/lost capture must not invent inertia.

Share beginDeviceOrientationRelease/advanceDeviceOrientationRelease unchanged across owners: decay7.5/s; spring13/s and damping0.82; flick thresholds700deg/s,14deg travel and1.5 horizontal dominance; overshoot3.5deg; settle2deg/s and0.08deg. Release uses actual positive elapsed seconds, unlike reveal's clamp. Preserve nearest-face target selection, reduced-motion behavior, custom drag poses and no backward assist after a completed face turn. Keyboard steps5/12 degrees and Alt roll retain target===stage admission; Home reset, blur, new grab and external/tool writes interrupt prior motion. WebMCP rotate returns the same-turn state; flick resolves on the actual current generation's settlement and rejects on abort/interruption, never on a guessed timer or resource acknowledgement.

Reveal: device-reveal.ts is the canonical curve and event order. Keep minimum warm1450ms; turn440/front1600/settle1900/wink2300/peak2720/return2800/complete3460ms; initial travel110%, yaw180,pitch-12,roll-5; wink yaw-32,pitch-5,roll2. Logical elapsed advances by min(frame delta,32ms), with zero first step. Do not replace this by wall-clock progress or silently shorten it. Full resources/paint/compile readiness gates start; a preparing canvas does not trigger the failed/no-canvas escape timer. Public reveal-active clears at1900ms although the hint continues to3460ms. Pointer/key interruption before settlement resets front; later interruption keeps the current pose. External store writes win immediately. Reduced motion shows front immediately.

Control: control-physics.ts keeps wheel rim travel0.006mm and select0.12mm; rigid wheel tilt uses asin(travel/radius), current contact angle, original rest quaternion and scale. Select is axial translation. Wheel/select releases remain120/96ms cubic remaining depth;24 nonadvancing timestamps safety-settle, exact rest restoration, reduced-motion release and demand scheduling only while active. Coordinate CPU-010 local assembly revision publication so query geometry follows adopted control transforms without rebuilding for whole-device rotation.

## Protocol and authority barriers

Every autonomous run needs rendererEpoch, motionEpoch and originating ordered commandSeq. A worker pose/submission includes lastAcceptedCommandSeq, poseSeq, scene/resource/layout revisions and logical animation state sufficient for interruption/recovery. Raw main and worker performance.now timestamps have different origins: use a declared shared time origin or explicitly relative durations; do not compare unrelated timestamps. Pointer event time remains main-owned for release estimation.

Press/start/reset/flick/release/cancel/visibility/preference/dispose are ordered commands. Each final release carries the exact final input pose/sample, gesture identity and motion seed, or a validated barrier with that payload already retained; latest-only pose coalescing must not drop it. Command acknowledgement means accepted/rejected, not physically displayed or saved. Motion settlement is a separate generation-matched record. Bounded queue overflow must retire/recover or explicitly reject a command, never discard final actions silently.

Main applies external/tool mutations synchronously, increments the command/motion authority revision and invalidates old motion before publishing the command. Worker replies older than that authority cannot update public state, finish a pending flick or change input admission. Reentrant synchronous writes made by other subscribers must still win (existing publishingOrientation value comparison at line465). Adopt current visual state and DOM/query projection together from one submitted bundle. Public intent and submitted visual/admission pose remain explicit; do not project newest intent onto an older displayed query geometry.

For automatic animation, a small accepted progress publication updates the Jotai public snapshot without routing orientation through the complete ProductionDeviceView subtree. A pending tool/input call sees coherent last-adopted progress and can supersede it immediately; no round trip before media activation or pointer capture. Worker animation never awaits main progress-notification credit. Store public state cannot update while main is stalled; neither matching sequence numbers nor autonomous rendering proves resumed-input alignment, so retain CPU-009's baseline-comparison gate.

## Per-frame main minimum and reveal coordination

The minimum remains applying one coalesced submitted projection bundle: Panel CSS matrix/functional clip data, query transform records and small public scalar progress; native paint requests only when dirty. No full scene traversal, geometry cloning, assembly descriptor reconstruction, broad React render, viewport layout measurement or DPR publication from orientation ticks. ProductionDeviceView:160/178 currently recreates prepared-sheet and sticker-scene graphs on render; split stable resource descriptors from pack/pose motion records and subscribe each only to its actual revisions. Preserve StickerCollection's functional orientation behavior via a narrow subscription.

Reveal has a special integration obligation: device-page.tsx:483 translates the entire stage via --device-reveal-y while device-reveal.ts:75 updates parent portal glow and orientation. Moving only rotation into the worker lets rotation advance while canvas translation/glow freeze during a main stall. The host must choose and prove one coordinated presentation strategy for the same logical curve: worker-owned model translation with equivalent projection/viewport/clip behavior plus coordinated compositor presentation, or explicit minimal main DOM updates from the same logical progress. A plain wall-clock CSS animation is not automatically equivalent to the32ms-clamped timeline. Do not claim all reveal work is worker-owned while retaining an independent main curve, or demand per-frame main acknowledgements that freeze worker animation. This is an integrated visual/motion gate; any necessary CSS ownership expansion must be explicit.

Media remains unchanged: CompositeDevice.tsx:538 invokes onTransportPress synchronously inside dispatchPhysicalPress before awaiting its result. Preserve hold checks, attachment-generation checks, abort handling, accepted action and previous/next fallback paging. Rendering commands are an independent side effect and never gate the provider call, AudioContext resume, haptics or navigation. Canvas replacement keeps the same input/controller/store/Panel authority and cancels incompatible held gestures without replaying accepted media commands.

## Verification before acceptance

Run existing suites, retaining behavioral assertions:

```sh
bun test apps/web/src/device-orientation-motion.test.ts apps/web/src/device-preview-orientation.test.ts apps/web/src/device-preview-orientation-source.test.ts apps/web/src/production-device-view.test.ts packages/device/src/control-physics.test.ts packages/device/src/orientation.test.ts
bun test packages/composite/src
bun run typecheck
```

Run scoped bunx --bun eslint on every changed source/proof and the lead's combined build. Retain deterministic reference experiments for all curve boundaries,32ms reveal clamp, nonuniform/invalid timestamps, opposite-face/unwrapped yaw, release final sample, reduced-motion toggle, subscriber reentrancy, same-turn tool reads, stale worker progress/settlement and control rest matrices. Run two independent owners to prove no shared motion state. Protocol lifecycle evidence must cover hidden/resume, command coalescing barriers, lost capture, abort/new gesture before late settlement, replacement worker epoch, and no frames after settlement/disposal. Provider spies must show invocation before any render acknowledgement or promise wait; no new fake media path.

The lead owns existing-Chrome matching-condition traces and actual-route entry/rotation/wheel/sticker/native-hit comparisons. Show the steady main work count, descriptor reconstruction count, outstanding notifications and physical raster dimensions; do not infer responsiveness or full visual parity from offline tests. CPU-009/012 full acceptance remains open until coordinated rise/rotation/glow, fast-motion resumed hits, immediate playback and failure recovery preserve the original behavior.

## Early CPU-009 typed protocol review

Reviewed the author's early device-render-protocol.ts draft, without reviewing moving host implementation. It supplies motionEpoch/lastAcceptedCommand, exact pose barriers, separate projection acknowledgement and stamped capture lifetimes. These are suitable foundations. Sent the following bounded additions to the author for the stable contract gate:

- A closed autonomous motion-program union for reveal, orientation release and wheel/select channels. Reuse existing pure equations and their exact seeds/checkpoints, including unwrapped orientation, velocity, target yaw, flick direction, contact angle, initial depth and logical elapsed. Extract shared pure code into the device package; do not make it import application modules.
- A control contact/move angle record; cardinal button identity alone cannot reproduce the wheel's continuous tilt under an arc finger.
- Distinct command accepted/rejected and motion settlement messages. An accepted control or motion command is not settled. Include ordered reduced-motion changes and a compatible resume/checkpoint contract.
- Distinct reveal settled/public-active and timeline-complete semantics, since1900ms clears active while3460ms ends the hint.
- Scene/resource identity in the pose barrier, or an explicit validated association with its immutable query lease, so a final sample cannot act on retired geometry. Existing projection records contain these stamps, but command poses alone currently do not.
- A declared timestamp domain/conversion. Raw timestampMs must not imply that main event timestamps and worker clocks are interchangeable.

These are proposed protocol refinements, not a frozen-source verdict. The engineer owns changes and a later independent contract review; CPU-012 implementation still waits for that acceptance.
