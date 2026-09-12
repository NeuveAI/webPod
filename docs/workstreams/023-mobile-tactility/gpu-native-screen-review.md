# Review: WEBPOD-CPU-021 — native screen image transport

## Verdict: APPROVE — bounded four-file source/interface review

The confirmed transferred-image acknowledgment timeout blocker is corrected and independently verified. No unresolved Critical/Major remains in the four-file source slice. This covers only native-screen-transport.ts, panel-projection.ts, html-in-canvas.ts and native-element-image.ts. The host's active dynamic DPR, full renderer lifecycle, native query scene and complete sticker work are not approved by this review.

### Correctness Check

- Read ticket show/context, gpu-worker-scope.md, full gpu-renderer-host-plan.md, gpu-browser-evidence.md and gpu-renderer-host-implementation.md. Source refs SRC-CLI-1789137012388-1/-2 are the dispatch context. Claimed the independent review ticket; no application edits, browser control, trace or commit by reviewer.
- Exact Chrome152.0.7977.83 ElementImage IDL exposes width/height/close and transferable Window/Worker ownership. GPUQueue IDL has the two-argument copyElementImageToTexture family used here. Exact tagged GPU queue source requires the originating canvas context; associated presentation canvas transfer before context creation is required. Host allocates that canvas and receiver context; the transport admits only its direct Panel child and never creates a detached staging canvas.
- Installed Three0.185.1 WebGPUTextureUtils uses backend-owned textures and native copy, then Y reflection for HTMLTexture. The adapter validates actual WebGPUBackend/GPUDevice/GPUTexture, exact rgba8unorm dimensions and uses a single StorageTexture allocation per raster generation. No needsUpdate/upload loop, source readback or per-paint texture replacement. UV repeat.y=-1/offset.y=1 reflects native top-left capture; installed TextureNode updates that matrix. NoColorSpace allocation pairs with the authored explicit LCD EOTF and toneMapped=false, so there is one decode. GPU driver execution remains represented by the prior real Chrome evidence, not a mocked GPU claim.
- The shared272×204→320×240 Panel fit preserves the original GL calculation. Independently ran5 existing HTML-in-canvas tests/39 assertions. No zero-test run is used as evidence.
- New independent reviewer-projection.ts executes the actual installed InteractionManager with canonical public element/camera fields, actual HTMLTexture/mesh and controlled DOM sizes.20 front/oblique/back/mobile/desktop/maxZ cases match every matrix element exactly, and shared authored Panel fit matches. It does not establish physical compositor/input alignment under a stall.
- New independent reviewer-transport.ts runs the actual transport with controlled native capture callbacks:10,000 paint notifications retain one owned image, stale acknowledgment is rejected, resize waits for old ownership, hidden/disposed paths do not capture, synchronous send failure closes once and retires, and detached Panel is not captured. Existing10-case channel proof also rerun. Native postMessage/GPU execution comes from the separate actual Chrome associated-canvas probes.
- Scoped source/proof lint passes after correcting an unused reviewer-proof import. Affected device/composite typechecks passed, and composite types were repeated after the final timeout correction. Parent owns combined build and full browser gates.

### Findings

1. **Major, corrected:** native-screen-transport.ts originally retained a transferred capture until exact acknowledgment without a deadline. Host readiness timeout clears after ready. A missing later paint-consumed can strand that credit indefinitely and freeze the LCD, with no failure transition. The15-second transferred-image watchdog now calls the existing failure owner, retires the transport and never opens another capture while the old receiver may still own the image. Exact acknowledgment alone clears it. Independent rerun of renderer-host/paint-watchdog.ts uses the actual timer and verifies missing acknowledgment retires once, late acknowledgment cannot revive, hidden outstanding ownership remains bounded, dispose cancels the timer, a10-second acknowledgment is accepted and no overlapping recovery capture occurs. Receiver image closure is simulated by the failure owner in that offline experiment; real host termination/recovery remains the final lifecycle gate.

### Duplication and integration limits

Source currently captures every eligible canvas paint regardless of changedElements/content revision. Host projection writes the Panel CSS matrix. The author now guards identical assignments in the host (outside the four-file verdict). Therefore any resulting native paint is eligible for another LCD snapshot/upload; neither the source nor the272ms preliminary live INP observation proves how often that happens or that it caused latency. Any future filtering must ignore only paints proven unrelated to Panel pixels. A root-only changedElements filter is not justified until actual browser evidence distinguishes projection from descendant CSS animation/paint: dropping marquee or artwork animation violates fidelity. The lead owns this bounded native observation and full source/performance gate.

Actual Chrome associated-scale proof establishes copy extent and six stripe RGBA centers, not glyph/pixel parity. First fitted native frame supports upright front-view extent, not full color/alpha/oblique appearance or input alignment. Fresh raster texture/paint/compile adoption, hidden generation recovery, full teardown and preferred-backend activation remain host acceptance obligations. These four modules cannot establish those moving caller contracts alone.

### Source references

- https://raw.githubusercontent.com/chromium/chromium/152.0.7977.83/third_party/blink/renderer/core/html/canvas/element_image.idl
- https://raw.githubusercontent.com/chromium/chromium/152.0.7977.83/third_party/blink/renderer/modules/webgpu/gpu_queue.idl
- https://raw.githubusercontent.com/chromium/chromium/152.0.7977.83/third_party/blink/renderer/modules/webgpu/gpu_queue.cc
- Installed packages/device/node_modules/three/examples/jsm/interaction/InteractionManager.js: update viewport/pixelToLocal/MVP order.
- Installed packages/device/node_modules/three/src/renderers/webgpu/utils/WebGPUTextureUtils.js: native HTMLTexture copy/Y-flip and owned allocation.
- Installed packages/device/node_modules/three/src/nodes/accessors/TextureNode.js: default UV matrix and update semantics.

### Neuve process

Ticket validation route is agent-delegable, but no code proof clears the separate manual/source-correlation ledger. Focused HEAD→HEAD include-uncommitted sources: `.neuve-artifact/sources-1789137343-697012000-16859.json`; focused blame triage: `.neuve-artifact/triage-1789137346-23266000-17200.json`. Both remain advisory source/check-correlation diagnostics. Local feedback `.neuve-artifact/feedback-record-1789137447-329298000-17947.json` records the useful focused path and missing correlation without copying source. Passed source evidence is recorded against the exact ticket labels; lead retains final manual/process ledger. get_review_model and a tool-search capability are absent from the current callable inventory; lead already owns the unresolved MCP/manual process ledger. No waiver, whole-host approval or ticket completion is inferred.

### Final evidence and limits

Independent reviewer viewed worker-fitted-frame.png: upright Music content fills the front LCD. This supports only the stated front extent, not whole appearance/pixel parity. Final independent commands passed: five HTML tests/39 assertions;10 existing channel cases; actual transport ownership proof;20 exact installed projection comparisons;6 real-timer watchdog cases; scoped four-source/all-new-proof lint; device and composite types; diff check. Retained independent proof pairs are evidence/gpu-worker/native-screen/reviewer-{transport,projection}.{ts,json}; author watchdog pair is evidence/gpu-worker/renderer-host/paint-watchdog.{ts,json}. No application files were changed by reviewer. This approval enables the narrow source milestone, not preferred native activation, full dynamic raster transition acceptance or CPU009/012 completion.

### Native paint provenance follow-up and dependency acceptance

Supervisor's bounded observation in the existing native Chrome route: stationary Music produced no paints; one visible edge rotation produced one paint with changedElements containing exactly DIV.wp-composite-panel-host and one style mutation; Select changing Music→Songs produced one paint with the SAME host identity and zero style mutations. Listener/observer were removed and no trace was recorded. This establishes that filtering solely on changedElements=[host] is unsafe: that identity also represents real content changes. It also confirms a projection-related style change can coincide with a capture-eligible paint. It does not establish marquee behavior, per-frame rates, capture cost or the cause of272ms INP. Lead retains the observation and probe in browser evidence; keep any optimization conditional on richer pixel-change provenance and preserve content/animation paint.

Dependency-only follow-up: APPROVE packages/device/package.json and bun.lock addition of pinned @webgpu/types0.1.72. Full two-file diff contains only one device devDependency, its matching workspace lock entry and one dependency-free package resolution/integrity entry; no unrelated upgrades. Installed package confirms0.1.72 and types=dist/index.d.ts, with no shipped runtime entry or installation hook. Native adapter's triple-slash type reference consumes these canonical declarations. Prior device/composite typechecks passed with this exact installed dependency. This extends the narrow source commit manifest only; no renderer activation or full-host approval follows.

Report is frozen for the lead's source commit after this append. Final Neuve manual/process ledger remains lead-owned.
