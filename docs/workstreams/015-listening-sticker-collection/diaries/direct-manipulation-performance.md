# Direct manipulation performance investigation

## Baseline status

Read-only product investigation complete; implementation is delegated to the collection owner. The actual user-requested Chrome DevTools MCP profiler was used. This is not a static performance guess or a replacement browser-test claim. Before/after acceptance remains pending the integrated revised source and matched after recording.

Read the direct-manipulation scope and designer brief, previous tactile scope/handover/material diary and current render/state/texture/gesture code. Modern Web Guidance was invoked first with Bun, then identify-inp-causes and identify-heavy-scripts were retrieved and read. Reused Interface Craft, all Interface Design Guardrails resources, Neuve Motion/global/Jotai guidance and the pinned R3F/Three references from the material work. Loaded runtime-review plus its runtime-fundamentals and checklist. Its recommendation to separate runtime verticals is satisfied by the lead's existing independent implementation/reviewer/profile lanes; this bounded client investigation does not fabricate a server-wide leak review. Research also checked primary V8 profiling/GC material; there is no inferred GC leak or universal engine timing claim.

## Reproducible environment and isolation

Source fingerprint `78f9687938df885fef966c105f25b3a8c6498b5bf1c8fcec2a232598ea6c511e`,376 files. The profiler created an independent source snapshot using the existing credential-excluding snapshot helper, installed its frozen lockfile with Bun and built its actual Start production route. Subsequent shared implementation edits cannot change this baseline. The owned profiling fixture reuses the same trusted synthetic Apple/signing seam and deterministic MusicKit helper as the native browser suite, native cookies and temporary SQLite. No live key, token, user server or user tab was inspected or changed.

Chrome DevTools MCP created isolated contexts on pages2 and3, leaving pre-existing page1 untouched. Chrome152 on Apple M4 Pro (ANGLE Metal),12 reported hardware threads, no CPU/network throttling. Desktop1280×900 DPR1; narrow viewport375×812 DPR1. The narrow run is desktop Chrome at phone dimensions, not a physical phone or Safari performance certification. The first desktop context encounters initial sheet rendering; the later narrow context has cold page resources but the browser/driver shader cache may already be warm.

## Observed failures and costs

| Measurement | Observed result | Attribution and limit |
| --- | --- | --- |
| First desktop liner reveal |146.1ms long animation frame,130ms main-thread task,115.9ms RAF gap |129.9ms attributed to R3F FrameRequestCallback bO→mO→gl.render. DOM sheet progress jumps from0.12 to0.93 after the stall. Forced style/layout duration0. This proves first-use rendering work; it does not exclusively identify shader compilation. |
| First desktop input metric | DevTools INP56ms:0.4ms input delay,2ms handler processing,53ms presentation | Mid-animation stall is separate from the slowest input event. A passing INP threshold cannot certify this animation. |
| Three warm desktop reveal/open/close cycles | No post-input long tasks or LoAFs;254 RAF samples, maximum interval18.7ms | Trace-startup frame before input excluded explicitly. Warm click Event Timing durations16–64ms; MCP's overall trace INP68ms. |
| Native MCP packet drag | No post-input long tasks or LoAFs; maximum RAF interval18.6ms | DevTools INP74ms,0.1ms input,1ms processing,72ms presentation. Native drag proves the existing packet path; no direct liner drag existed in baseline. |
| First narrow-context sheet use | Four sheet PNG requests begin~37ms after open input; request durations2.2–3.9ms in local fixture | Artwork wasn't prepared before motion. Open persistence itself1.9ms here; production network delay is not simulated by this measurement. |
| Narrow-context GL instrumentation | Four texture upload calls total9.5ms; two shaders compiled and one program linked | Transparent WebGL method timing wrappers are confined to the owned diagnostic page. Browser/driver shader cache is already warm, so this does not reproduce or fully apportion the initial desktop130ms stall. |
| Closing choreography | Liner first appears fully closed at200.5ms; packet first lowers at617.1ms; final tease at1200.7ms | An additional~417ms nearly invisible spring tail delays the handoff. This is a genuine controller/timing issue independent of the cold render task. |

RAF gaps measure callback delivery and bound visible update opportunities; they are **not a measured GPU dropped-frame counter**. No raw compositor-drop count is claimed. A115.9ms callback gap spans approximately seven60Hz intervals, but actual presentation/drop attribution needs an exportable trace. Repeated warm rendering does not support simplifying the96×96 paper geometry as the primary fix. No source optimization was applied on that suspicion.

## Actionable implementation handoff

The collection owner already owns all affected integration surfaces. Proposed minimal files: StickerSurface.tsx / StickerPackScene.tsx and a narrow preparation/cache helper for active artwork/material readiness; sticker-collection.tsx / sticker-interaction.ts / sticker-motion.ts for direct liner control and perceptual spring completion. No paper geometry edit is justified by the current profile.

1. Retain bounded subscriptions for the active collection's five textures through packet hiding/front-back changes. Prepare actual textures/material variants before admitting a usable lip. Do not preload all sixty assets or retain unrelated sessions indefinitely.
2. Pinned Three0.185.1 WebGLRenderer.js exposes `initTexture` specifically to move decode/upload overhead off first rendering, and `compileAsync(group,camera,targetScene)` to await shader readiness using KHR_parallel_shader_compile. That extension is available in the measured browser. Prepare actual earned/locked/backside material variants under the existing scene's lights/environment. Readiness must include completion, disposal/generation guards and context-loss behavior; no permanent render loop, alternate proof route or new light rig.
3. Separate owned-pack opening persistence from direct liner motion, as the designer brief specifies. A pending server write may block peeling sealed art, but should not freeze the hand.
4. Complete the closed-sheet→packet handoff at perceptually finished motion instead of waiting~400ms for an invisible residual oscillation. Preserve interruptibility, fresh momentum and cancellation, rather than only increasing stiffness.

The engineer received the exact callback attribution, upload measurements and pinned source locations. No claim was made that a particular warm-up API has already fixed the measured stall.

## Tool artifacts and limits

Evidence lives in evidence/direct-manipulation/performance: actual MCP summaries for cold/warm/direct-pull/narrow runs, full bounded observer data, WebGL call timings, source/host metadata, build log and reusable fixture/instrumentation scripts. The MCP server rejected both absolute and relative repository trace output paths as outside its configured workspace roots. Tracing without filePath succeeded and produced real insights, but returned no raw trace file. The exact refusals and trace bounds are preserved in baseline-cold-devtools.md. No workspace-policy bypass was attempted.

## After plan

Wait for integrated source freeze and browser handoff. Build a new independent snapshot, run the same actual route/fixture, record source/build/runtime metadata, same desktop/narrow viewports and no throttle. Repeat the old equivalent open action for comparison and three warm physical packet/liner pulls as the new primary path. Record cold ownership-to-usable preparation separately from ready-input latency; preserve honest browser shader-cache conditions. Compare Event Timing subparts, mutation/frame cadence, LoAF tasks and perceptual close handoff. Add new rear lift/press/return sequences and delayed background refresh tests with the interaction owner's fixture.

Acceptance needs the observed cold stall removed from the ready gesture, no new warm long tasks, prompt handoff, and direct pointer/render agreement. Do not call a warmer browser cache an implementation win. The lack of raw MCP export remains a tool limitation unless its configured roots change through an authorized supported route.

## Bounded preparation lifetime implementation

The collection owner requested a two-file helper after adding active-asset preparation. Pinned Three185.1 `compileAsync` starts a timer that repeatedly reads `properties.get(material).currentProgram`; component disposal removes those properties. A generation check only in the promise callback cannot stop that internal timer from throwing after unmount/context loss. Cloning alone also does not make the built-in timer cancellable, and releasing clones immediately on success can delete the only warmed-program cache references.

Coordinated API before writing: `prepareStickerPrograms(renderer, root, camera, targetScene, requiredAbortSignal, optionalTimeoutMs)` returns Promise<void>. It compiles a copy with owned material clones and borrowed geometry/maps. Shader callbacks and custom program-cache keys are copied explicitly because Material.copy omits them. It captures and validates currentProgram readiness handles once immediately after public compile, then uses bounded cancellable polling. The adapter checks Three revision185 and the runtime program shape and fails closed. It never re-reads disposed material properties from a timer. Program method receivers are preserved.

Success stops polling but retains program-owning materials until the caller aborts the active preparation subscription or context is lost. Failure, timeout, abort and context loss release only owned materials exactly once. Synchronous reentrant cancellation cannot dispose resources in the middle of compile/isReady. No borrowed geometry or texture is disposed; no global renderer override, permanent frame loop or application broadcast was introduced. Without the parallel-shader extension, Three's readiness check is immediate; this helper cannot certify all deferred driver work and the after render profile remains required.

Owned sources: packages/device/src/sticker-program-preparation.ts and its .test.ts only. Initial eight meaningful tests/128 assertions pass for original unmount, pre/in-flight/reentrant abort, retained success ownership, context loss/restore, missing/invalid metadata, driver/compile errors and timeout/no late polling. Package TypeScript and scoped ESLint pass. Collection owner integrates required AbortController lifetime exclusively in StickerPackScene; reviewer independently audits the helper before acceptance. No commits made.

Baseline evidence follow-up: preserved the earlier actual narrow resource-timing response in baseline-phone-resources.json and direct-pull INPBreakdown in its DevTools report, explicitly marked transcriptions. Warm stop-trace overall INP is retained, but no warm-specific detailed breakdown was saved; no subparts were invented. Copied the existing ignored .log build output to baseline-build.txt for durable review. The original one-shot native drag is explicitly limited evidence; after profiling will measure continuous gesture windows and cold versus repeated rear alpha-mask pickup separately.

Independent helper review passed with the same eight tests/128 assertions. Reviewer inspected the integrated per-effect controller, supersession/loss/unmount abort and generation-guarded readiness and found no Major helper issue. This is lifecycle/source approval only; final actual-render performance and interaction acceptance remain pending. Frozen helper SHA-256:a3697fb7995c949726ada17d42bcea88c7b67fef90da54170020686ec19a8cc2; test SHA-256:332295e29ae29b3febdf5e8592a1454b245680b052dda46ae3cad5f8555b6401.

## Final reviewed candidate after profiling

Profiled immutable source 58fa8839…c261 /380 using the actual isolated production route and Chrome DevTools MCP. Full measurements, rejected attempts and limits are in `../evidence/direct-manipulation/performance/after-report.md`. Ready packet/liner geometry reached actual draw submission in 16.8/16.9 ms after movement. Three warm native pull cycles had no ≥50 ms LoAF; the invisible close handoff shrank from approximately 417 ms to 16.3–16.5 ms. Rear lift/return and narrow mouse gestures had no LoAF. Initial startup and rear admission still contain long frames, separately recorded before ready input. No geometry simplification was justified by the measured warm work.

The after trace helper consistently returned another origin despite explicit page IDs and selection; those INP summaries are rejected. Accepted after measurements are verified owned-page observer and renderer measurements obtained through DevTools MCP. Baseline persisted trace summaries identify their original fixture correctly. No compositor scanout time, completely cold GPU guarantee, continuous slow-drag sweep or new physical-mobile performance result is claimed. Source remained unchanged during after profiling; the fixture-only SDK injection repairs unreliable tool initialization and preserves the real route/native server context.
