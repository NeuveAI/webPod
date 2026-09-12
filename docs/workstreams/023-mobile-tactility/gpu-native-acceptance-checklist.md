# Existing-route native acceptance

Run on the current authenticated `/webpod?renderBackend=worker` route. Preserve the current account/catalogue; do not seed inventory or add fixtures. Use `/webpod?renderBackend=webgl` for the same-scene reference. This is a practical remaining-check list, not new scope. Lead already observed commit22437fc phone→desktop→phone, rear rotation and packet remaining worker without failure. CPU025's upcoming warmup lifetime refinement has separate author/reviewer ownership.

## Read before and after each group

- `[data-renderer-requested]`: `worker`; `[data-renderer-effective]`: `worker`; absent/empty `[data-renderer-failure]`.
- `canvas[data-wp-render-backend="worker-webgpu"]` with `data-wp-render-warm="ready"`, and `[data-device-reveal="complete"]`. Readiness alone is not visual success.
- `[data-sticker-stage]` also exposes `data-sticker-progress`, `data-sticker-sheet-reveal`, `data-sticker-peel`, `data-sticker-landing`, `data-sticker-turn`. Record settled values and visible state, not raw resource buffers.
- Existing `.webpod-device-preview` exposes `data-colourway`, `data-room`, `data-pose`, `data-orientation`; orientation attributes are React publication diagnostics, not a guaranteed per-frame worker pose feed.
- Host `inspect()` (`epoch`, `initialized`, `ready`, `disposed`) is an internal returned object, **not** a window/DOM API. There is no exposed live DOM worker-count/byte ledger. Native DevTools worker execution-context inventory can show surviving renderer workers across navigation, but do not equate that with complete resource accounting; existing retained owner proofs cover the latter.

## Short action sequence

1. **Entry/front/edge/rear.** At440×956,DPR3,6×CPU, reload and wait for complete entry. Verify intact chassis, LCD, wheel, lighting and no blank or simplified surface against GL. Focus `[role="region"][aria-label^="Three-dimensional iPod preview"]`: arrow keys rotate; Home resets. Also physically drag a visible outer edge, release into motion, and Option/Alt-drag to roll. Verify controls/glass do not become rotation handles and rear hit areas follow the visible device. Use `Reset view` to restore front. Repeat one phone→desktop2952×1636,DPR2→phone resize while observing LCD sharpness, fitted device and backend flags.

2. **Settings/materials.** Click `Settings` (`[aria-controls="device-settings"]`), inspect `dialog#device-settings`; choose `Silver`, then `Black` under Finish, and toggle `#light-room`. Close with the existing dialog close action/Escape. Check front/edge/rear materials, screen contrast and retained state; no old-color frame replaces the final selection.

3. **Wheel and playback.** On the visible front, use the actual wheel arc and the visible MENU/Select/previous/next/play-pause controls. Verify menu highlight follows rotation, Select enters, MENU returns, physical press/release rests correctly. Start an available track through the existing account/library, then pause/resume and next/previous; confirm audible playback and LCD agree. No new login or catalogue fixture is required. Include a control press during a device release motion, checking neither channel rewinds.

4. **Packet/liner/appearance.** Rotate rear. Use `[aria-label="Pull sticker pack into view"]`, then `[aria-label="Pull sticker liner open"]`; these are physical pull targets, with keyboard activation also supported. Verify sleeve, liner, neighboring sheets and all visible earned/locked/placed print appearances. `[data-sticker-slot][data-sticker-slot-state="earned"]` identifies an available earned print without assuming its name. Use `Previous sticker collection`/`Next sticker collection` once and return. Close via `Close sticker liner` or `Put pack away`; reopening must retain exact assets and usable hit regions.

5. **Peel/drop/cancel/edit/return.** Drag an earned `[data-sticker-slot]` onto the visible rear and release; verify peel, contact, edge/fraying, landing and final displayed placement remain coherent through save. Repeat a cancelled attempt (Escape or native pointer cancellation) without an obsolete save. Keyboard alternative: focus the earned button whose label begins `Peel `, use arrow keys to position and Enter to stick. Focus `[data-sticker-placed]`, Enter opens adjustments; inspect `[data-sticker-editor]`/`data-editor-phase`. Adjust `Sticker wear`, `Scale sticker`, a visible corner handle, and `Reset wear and straighten`; final geometry/contour/texture must agree. `Return to pack` (editor) or `Return to sheet` (detail) must peel/return and restore collection availability. Restore the original inventory state after this test where practicable.

6. **Hide/resume and fallback.** While a release animation or packet interaction is active, switch to another browser tab, then return. Verify current state resumes without stuck press/capture, stale completion, duplicate artwork or backend failure. Navigate away/back once to exercise owner teardown and clean recreation. If a genuine native failure occurs, retain its scalar `data-renderer-failure`, verify effective `webgl`, then repeat front controls and the current rear sticker interaction: fallback must preserve usable music/UI/inventory.

## Context-loss boundary

The reviewed existing route/host exposes **no user-facing or global nonpersistent WebGPU device-loss trigger**. Worker GPUDevice and host binding are private; WebGL `WEBGL_lose_context` cannot target that worker WebGPU device. Do not invent a debug button, inject a fake message, or present normal `renderBackend=webgl` selection as a loss test. If no genuine loss occurs in this run, mark induced-loss browser coverage unperformed; cite the already retained loss/retirement lifecycle evidence separately. The GL query parameter is only a valid visual/reference backend selector.

For each group retain a short result plus a settled screenshot where visual comparison matters. A failure/fallback during expected native operation remains a failure of that native action even if GL recovers. No new tracing session or benchmark is implied by this checklist.
