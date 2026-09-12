# Unified canvas density

Ready for independent review. Read full cpu-fixes-scope.md, follow-up result/trace/motion/sticker reports, local Jotai store documentation and installed Fiber9.7/Three0.185.1 source. Used modern-web-guidance search; it returned adjacent HTML-canvas topics, with no more specific DPR ownership guide. The source-linked Kanban task is claimed and has implementation evidence. Supervisor authorized the narrow existing-version Jotai dependency addition to the device package.

## Change and ownership

DeviceCanvas now owns an isolated Jotai store/primitive density atom. Its Canvas prop is always the current resolved number. CanvasPixelDensity publishes its physical measurement into that same owner rather than independently calling Fiber setDpr. Thus configure and the observer cannot restore different window/range and physical-box values. The observer does not request redundant invalidation: changed Canvas configuration follows Fiber's existing store/resize/invalidation path; identical atom values publish nothing.

The original physical resolver in pixel-density.ts is unchanged, including fractional box ratios, max against browser DPR, invalid-input fallback and1–3 clamp. Initial automatic density uses the existing configured range/window resolution; physical observations retain the previous resolver policy. Explicit numeric DPR remains exact and disables the observer. A semantic prop change creates a new isolated owner; unchanged inline range arrays do not. No density/renderer state is shared across canvases. Observer and viewport listeners disconnect on cleanup; stale callbacks stop before publication.

The native screen projection, camera fitting, renderer settings, geometry, lighting and textures are untouched. No rendering-quality reduction is introduced. This removes the source-level competing ownership; it does not establish the cause or savings of the earlier73.299ms sampled resize path. The observed DPR3 was already at the shared ceiling and no resize arguments were captured in that trace.

Files: packages/device/src/DeviceCanvas.tsx, CanvasPixelDensity.tsx and canvas-pixel-density-store.ts. packages/device/package.json adds Jotai2.20.3, already installed elsewhere. `bun install --ignore-scripts --offline` changed only one device workspace dependency line in bun.lock; no dependency version upgrades. No unrelated source/resources touched, no browser calls, no commits.

## Verification

Retained `evidence/cpu-fixes/density-lifecycle.ts/json` executes the actual observer with deterministic hook/ResizeObserver scheduling and the actual Jotai owner. Physical measurements are compared against the unchanged resolver. It covers fractional1.5024209486166007 physical density versus window1.5, repeated identical observation suppression,60 orientation configuration checks with no reset, DPR3 emulation, upper clamp, actual-size and viewport/zoom updates, independent canvases, explicit numeric observer opt-out, cleanup and stale callback rejection. The configure counter models installed Fiber's numeric inequality guard; it is not a live WebGL renderer or measured buffer allocation benchmark. Source wiring assertions ensure Canvas consumes the owner and the observer publishes into it. This is a retained experiment, not a new unit test.

49 existing pixel-density, screen-mesh and camera-fit tests pass,299 assertions across3 files. Device/composite/web types and scoped source/experiment lint are checked. Existing screen-mesh tests preserve native projection contracts; no synchronous readback or delayed projection was added. Supervisor owns permitted current-browser validation and independent reviewer owns approval.
