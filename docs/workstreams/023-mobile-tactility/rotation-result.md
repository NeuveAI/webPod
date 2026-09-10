# Rotation and entry optimization

Status: implementation complete and independently reviewed on `codex/mobile-tactility`. These changes are local and have not been deployed. Earlier mobile/haptics/update and responsiveness changes remain intact.

## GPU preference

The device already uses GPU rendering through Three's WebGLRenderer. Prefer GPU work for visual deformation and shading; retain CPU work needed immediately by DOM interactions or collision consumers, avoiding synchronous GPU readback. WebGPU is not a drop-in renderer switch for this app: installed Three r185 requires the existing onBeforeCompile material hooks to be ported to TSL. Its HTMLTexture WebGPU path also depends on experimental copyElementImageToTexture support. No claim that changing API alone improves mobile frame time.

Verified source: https://github.com/mrdoob/three.js/blob/r185/manual/en/webgpurenderer.html and installed Three 0.185.1 sources. The existing WebGL path already sends model transformations, physical lighting and material shading to the GPU.

## Changes under verification

- Dense immutable front/rear procedural shell construction and exact indexing run in a bounded shared worker before the scene mounts. Unsupported/failed/timed-out work falls back to original CPU construction. No second geometry upload or visual detail reduction.
- Entry waits for the complete scene and real renderer warmup. Slow geometry preparation cannot falsely complete entry through the prior safety timer. Existing animation curve and duration remain unchanged.
- LCD DOM projection synchronizes once per rendered pose, including camera and viewport changes. A retained 60-pose real-source experiment reduces 120 synchronization calls / 480 layout reads to 60 / 240. These are deterministic operation counts, not browser timing or FPS.
- Expensive projection diagnostic traversal is explicitly opt-in; functional input projection and camera fitting remain enabled.
- GPU paper deformation uses a static full-detail grid with position/normal shader deformation. Curl updates a uniform instead of rebuilding/uploading geometry. Capability and actual-material preparation failures select the existing CPU worker path. Exact lazy CPU bounds preserve return-motion behavior without GPU readback.

The model is procedural, so there is no downloaded GLB whose lossless compression would address these costs. Exact indexing reduces decoded attribute/index payload without modifying expanded triangle attributes. Buffer byte totals are not measured driver VRAM or peak JS heap. Hardware mesh batching remains unchanged because preserving named picking/collision provenance needs a separate correctness treatment.

## Browser evidence limits

The native DevTools recording attempt did not yield a usable rotation trace; the mostly idle recording is excluded. The local browser tab subsequently returned ERR_BLOCKED_BY_CLIENT for both localhost and 127.0.0.1. Therefore there is no validated current phone FPS or before/after frame-time claim. Earlier production and local development observations must not be presented as a measurement of this final build.

Detailed evidence and independent reviews are linked from rotation-motion.md, rotation-geometry.md and rotation-rendering.md in this directory. Final combined build, 14/14 project typechecks, application/package/script plus current rotation evidence lint, and git diff whitespace checks pass.

## Verified implementation measurements

Final production geometry payload is **21,939,808 → 7,354,520 bytes**, saving **14,585,288 bytes (66.5%)**. Front/rear worker transfer preserves all expanded attributes, groups and bounds exactly; 840 picking rays retain parity. The earlier 69% figure describes a broader indexing prototype, not the final enabled implementation. The dense pair is shared with explicit lifetime and wrap-binding ownership.

Combined existing device/composite/orientation/reveal tests currently report456 passing,1 failing across71files. The remaining failure is the previously verified unchanged StudioEnvironment source-string expectation for the legacy route (`studioEnvironment={undefined}`); the prop lives in device-page. The two newly affected factory-location assertions were updated to inspect their actual new owner and pass. Full repository lint also reports old evidence-script violations in unrelated workstreams; application/package/script and current rotation evidence lint is checked separately without changing historical evidence.

## Final review

All three independent reviews approve source correctness. GPU paper preserves full topology and material inputs; 36 numerical GPU cases bound position and normal component error to approximately 0.0000318, with transparently qualified isolated-browser provenance in rotation-rendering.md. This is floating-point parity, not bit identity or a live visual comparison. All 1,512 CPU bounds comparisons are exact. The actual-material gate passes seven lifecycle cases: ready, delayed ready, failed link, missing handle, context loss, deadline and disposed stale poll. Lead independently reran that probe and its lint. Existing paper tests pass after final material changes.

No current live appearance or mobile frame-time validation was obtained because the permitted local browser is blocked. No deployment was made. A phone/profile verification remains necessary before claiming a frame-rate improvement.
