# Remaining lifecycle validation plan

Read-only source audit for the existing CPU009/016 lifecycle requirements. No application changes, tests, browser actions or board commands were performed. Latest checklist records completed final production interaction/resize gates, but minimizing Chrome produced no hidden event; reduced-motion and genuine induced GPU loss remain unperformed. Current user NightShift/PW-A01 placement must be preserved, not returned to inventory as test cleanup.

## Common bounded setup and evidence

Lead owns the existing current Chrome target. Record current URL/backend/warm state, source revision, media-query result and physical device state. Use the actually registered `document.modelContext.getTools()` metadata and `executeTool(toolObject, JSON.stringify(args))`; do not invent registration. `webpod_device_state` with `{}` returns current orientation/hold/animation plus saved placed records, held draft and pending saves. Retain only PW-A01's full placement, placed count, held ID, readiness and pending-save count. `webpod_page_state` and `webpod_list_status` provide navigation/readiness; avoid retaining music catalogue/library content. This placement snapshot is evidence for exact equality, not a replacement persistence backup or permission to rewrite inventory.

Only reversible sticker commands are needed: `webpod_get_sticker` with `{stickerId:'PW-A01',source:'placed'}` followed by `webpod_release_sticker` with `{}`. Get preserves the saved origin; release discards draft edits and does not persist. Do not call place/return/reset while testing lifecycle. Require pendingSaves0 first; never interrupt an actual save. If the test cannot restore held:null through the real release path, stop and preserve state for diagnosis.

Use one bounded temporary observation closure on the existing document, recording at most16 visibility/focus samples with monotonic timestamps and actual `document.visibilityState`; remove listeners and close only the temporary blank tab in finally. No performance trace is needed. Any result must distinguish an actual observed event from a sampled final state. Restore exact original media emulation/viewport and original tab. Keep NightShift placement byte-equivalent before/after, including width, rotation and wear.

## Actual hide and resume

1. Start on ready worker with original placement recorded. Register the bounded event observer. Begin a reversible orientation release or held placed draft using existing input/tools.
2. Create/activate a temporary `about:blank` tab in the **same Chrome window**, without inspecting other tabs. Record its returned target ID. Switching to a different window or minimizing is insufficient: Chrome can keep the target document visible.
3. Reactivate the original target after a short bounded interval. Require recorded `visibilitychange` to hidden then visible, not just blur/focus. If those events are absent, mark the attempt unvalidated; do not repeat a large matrix.
4. Read real device/page state; verify no held physical press/capture, no stale autonomous motion, ready worker or explicit healthy fallback, and exact saved placement. A held tool draft may remain according to its API; release it explicitly and verify the original placement. Perform one ordinary control action to demonstrate resumed admission.

Source invariants: device-render-host.ts synchronizeVisibility increments visibilityRevision, pauses pose and pixel channels, and sends an ordered final pose/cancel command. Worker visibility handler consumes that command before reading motion, pauses projection/motion and returns a hidden checkpoint. This is cancellation/settlement rather than a promise to resume the interrupted fling. click-wheel-event-controller.ts releases keyboard capture on hidden/blur; native orientation pointer ownership clears on blur. Host terminal pose adoption updates query/Panel before listeners. Disposal removes visibility listeners, retires candidate owners and bounds worker shutdown to250ms. Existing motion/channel/controller and carry lifecycle proofs cover these contracts; live event evidence is the missing layer.

Local CDP Page.setWebLifecycleState supports only `frozen`/`active`; this is not a substitute for observed hidden/visible. It may suspend script execution and should not be added to this minimal gate.

## Browser reduced-motion emulation

Use actual target-scoped CDP `Emulation.setEmulatedMedia` with `features:[{name:'prefers-reduced-motion',value:'reduce'}]`, preserving any other features already controlled by the lead. Confirm `matchMedia('(prefers-reduced-motion: reduce)').matches` is true and observe the query change if toggled live. Restore the previously configured override, or clear only this override through the original feature list; do not force no-preference if the user's underlying OS prefers reduction.

Exercise one Select/MENU press/release after a previous ordinary release, and one controlled orientation change/flick. Verify immediate control rest, no continuing coast introduced by stale worker projection, and correct public state. Then a reversible packet open/close or placed get/release can demonstrate exact draft preservation. Do not infer that every animation must disappear: preserve the existing authored reduced-motion policies. Native input subscribes to media change and calls ControlPhysicsController.setReducedMotion; this forwards a reliable command and settles local releases. Orientation reads current media at release. StickerCollection's media listener cancels its current interaction; editor and packet springs use their own existing reduced-motion branches. Reveal uses the media setting at its own setup, so testing reduced-motion entrance requires a separate same-route reload with the emulation already active; the late-toggle test alone cannot certify entrance.

Retained reviewer-reduced-control.json proves exact local and renderer rest for the actual controller/driver under controlled RAF after earlier worker release. It does not prove browser emulation or live visuals. The smallest live closure is one late-toggle control/orientation case plus, if entrance is included in the claim, one clean same-route reduced-motion entry; preserve the saved placement across both.

## Genuine GPU loss: available mechanisms and boundary

Current native worker installs renderer.onDeviceLost to call its failure path. Installed Three0.185.1 WebGPUBackend.js262 subscribes to actual device.lost **but immediately returns for reason `destroyed`**. Hence pausing the worker and calling its real GPUDevice.destroy() does not exercise the application's normal onDeviceLost fallback. Calling onDeviceLost manually, throwing in the worker or selecting `renderBackend=webgl` would test synthetic failure/manual selection, not genuine device loss. WEBGL_lose_context applies to GL, not this WebGPU device.

The locally available CDP browser_protocol.json exposes Browser.crashGpuProcess, which crashes the shared GPU process and can affect other Chrome tabs. Page.crash kills the target renderer and loses the application that would need to fall back. There is no per-target genuine WebGPU loss command in this inspected protocol. Neither action meets the requirement to preserve other tabs and validate a living current-page fallback. Do not use a GPU process crash in the shared user Chrome session.

Therefore a safely scoped, deterministic genuine-loss trigger is **not established** for this existing instance. Keep this live gate explicitly unperformed pending lead/user disposition or an isolated browser instance expressly authorized for destructive GPU testing. No new loss API/debug route is justified. A spontaneous genuine loss can be validated if it occurs: retain actual reason, require complete worker retirement, same live player/provider/Panel state, effectivewebgl, ready GL, exact PW-A01 placement and ordinary control/get/release success. Existing source and earlier real native preparation-failure recoveries support complete fallback but are not evidence of a genuine GPU-loss event.

## Source and local capability references

- packages/composite/src/device-render-host.ts: visibility, ordered disposal and terminal query adoption.
- packages/device/src/device-render-worker.ts: actual GPU loss callback and visibility command handling.
- packages/composite/src/CompositeDevice.tsx: failed backend atom switches the complete renderer to GL while preserving shared outer UI/provider ownership.
- packages/device/src/device-native-input.ts; control-physics.ts; click-wheel-event-controller.ts: media and capture owners.
- apps/web/src/device-preview-orientation.ts; device-reveal.ts; sticker-collection.tsx: authored reduced-motion and cancellation policies.
- apps/web/src/device-state-webmcp.ts; packages/tools/src/stickers.ts: real state and non-persisting placed-draft release.
- Installed node_modules/.bun/three@0.185.1/node_modules/three/src/renderers/webgpu/WebGPUBackend.js: destroyed-loss exclusion.
- /Users/vinicius/code/.better-coding-agents/resources/agent-browser/cli/cdp-protocol/browser_protocol.json: Emulation.setEmulatedMedia, Page.setWebLifecycleState, Browser.crashGpuProcess and Page.crash capability descriptions. This local protocol inventory is planning evidence; lead must verify availability in the connected current Chrome before issuing commands.

These are bounded remaining gates, not a new full performance or visual matrix. A functional event observation does not measure renderer/GPU frame rate, and controlled lifecycle proofs do not replace actual hidden/visible or media-emulation evidence.

Loss-reason qualification: the installed backend forwards non-destroyed loss as `{api:'WebGPU',message,reason:info.reason||null,originalEvent:info}`. The worker calls Three's previous onDeviceLost callback with this detail, then emits only the generic `Native GPU device lost` failure message to main. Thus the current fallback UI/error does not preserve the original unknown reason; actual worker console/device-lost evidence is needed to distinguish a natural loss from another failure. No alternate recovery route exposes a safe loss trigger. Prior reports should be cited as natural-loss evidence only where they actually retain that event/reason; generic preparation failures remain a different supported fallback case.

## Lead production checkpoint at e940356

Clean production worker on currentChrome with6×CPU, originalNightShift placement preserved. Same-window newblanktab was observed hidden and closingit returnedvisible. Visibilityevents retained visible547736.2→hidden553184.5→visible569714.4ms; beforemanualtouchCancel cleanup, actualdevice reportedisBeingHeldfalse,isAnimatingfalse,heldnull,pending0,effectiveworker and exactsavedplacement equality. Temporarytab closed; observer/listener/timeoutremoved.

Earlier missingevents were explained by installed chrome-devtools-mcp McpPage.init forcing emulateFocusedPage(true) for everypage. Target-focusedemulation fromanindependentCDP session didnot override theconnector's session. Stopping the task-ownedMCPbridge and disablingfocus emulation on the remaining scopedCDPconnection restoredactualvisibility. NootherChromeinstance oruser tabs were closed. RawCDPremains attached to the same originaltarget. Previous missingeventattempts are not passes.

NativeDevTools Renderingdrawer showedallmediafeatures atNoemulation. Changedonlyprefers-reduced-motion toreduce, verifiedmatchMediatrue, existingregisteredcenter/menu andback/fronttools succeeded, finalorientationfront/isAnimatingfalse/isBeingHeldfalse/heldnull/pending0 with exactplacementequality. Same-route reload withreducealreadyactive reachedworker/revealcomplete/noalerts. Restoredthatdropdown toNoemulation andclosedonlyRenderingdrawer, leavinguser's originalPerformancecapture andRecordoff. Finalqueryworker integration still needs a regressioncheck; these observations establish the underlying lifecycle baseline.

Evidence lives under evidence/gpu-worker/feature-complete-lifecycle/. No genuineGPUloss was induced, nofulltrace started andno appdiagnosticAPI added.
