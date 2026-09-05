# Production WebGL material and recovery evidence

2026-09-06. `bunx --bun playwright test --config apps/web/tests/playwright.config.ts apps/web/tests/sticker-material.e2e.ts`: 1 passed, 27.5 seconds. Served worktree snapshot fingerprint `0203ee3bcc0b4006c8b15e0f2f44c9bbc6fa4b47e4cc652e751c0b264c47cc3b`, 279 browser source files. Actual production `/`, existing deterministic Apple fixture, mocked sticker inventory API; no real Apple calls or new proof route. Chrome with CanvasDrawElement enabled,1280x900. Separate browser context and serialized snapshot runner coordinated with UI engineer.

## Captures inspected

1. `01-dark-bright-ivory-rear-finished.png`: Night Shift (dark), On Repeat (bright pink/multicolor), Off Beat (ivory-heavy) equipped together on actual rear.
2. `02-dark-bright-ivory-rear-base.png`: identical pose/art with only clearcoat disabled through existing development calibration action.
3. `03-dark-bright-ivory-oblique-base.png`: yaw146,pitch10,roll-2, base.
4. `04-dark-bright-ivory-oblique-finished.png`: identical oblique pose with clearcoat enabled.
5. `05-context-lost-fallback.png`: real WEBGL_lose_context extension, tier T4.
6. `06-context-restored.png`: same context restored, tier T1, all three sticker silhouettes visible again.

All six inspected as images. Dark outlines, bright ink, ivory lettering and holes retain their identities; no rectangular reflection or crop halo appears around the cut shapes. At these roughly90–120px sticker widths type remains identifiable. Oblique values become softer/lighter in the large production chrome highlight, consistent with a physical finish. Coat is restrained rather than wet/glittering; no added sticker light. Base/finished pixel-difference analysis confirms visible effect localized within occupied artwork bounds: rear21960changed pixels in box(514,255)-(755,649); oblique20874 in(514,260)-(718,643). No finish-only changes outside these occupied collection bounds. This numerical localization supplements visual inspection, not a claim of per-pixel alpha-mask certification.

## Runtime checks

Three distinct artwork HTTP responses succeeded. Instrumented actual WebGL2 drawElements/drawArrays calls before initialization, then checked GPU draw count equality across700ms after settling, both before and after context recovery. Both assertions passed. This proves no permanent drawing in the observed stationary scene, beyond merely inspecting `frameloop="demand"`. Context loss moved real composite tier to T4; restore moved back to T1 and rendered the three persisted placements. UI's separate passing interaction suite supplies real pointer peel/cancel/place, explicit transient PNG retry, keyboard and375px reduced-motion evidence; do not confuse these material captures with gesture proof.

## Context-loss correction and remaining boundary

Initial capture exposed a blank T4 surface. Lead authorized a bounded semantic restoration status, while retaining Canvas for real restoration. Latest `05-context-lost-fallback.png` now shows centered “Restoring device view…” on the existing dark tone; sticker controls are unavailable until T1 returns. Inspected updated05 and06: status disappears and all three sticker prints recover. This is context-loss handling, not a full alternative T4 device renderer. Restored screenshot still shows the right body wall darker than the pre-loss capture; sticker art and geometry survive. Full underlying device environment parity is not asserted by this sticker-specific recovery check.

## Final combined run

UI engineer ran both interaction regressions plus this material test: **3/3 passed,58.7s**, fingerprint `e714a9f35b3ec45a82e7f3520356de66d95b0a85acdfaac8425195232e8ba190`. Current six PNGs and `material-runtime.json` are from that run. Inspected numeric artifact: draw counts991→991 before loss;1123→1123 after restoration; each interval700ms,3 successful artwork responses. The material readiness assertion now waits for actual successful sticker session bootstrap, correcting the independently diagnosed earlier race between GPU T1 and provider authorization. Reviewer is independently repeating the material test before final disposition.

App TypeScript check and ESLint for the new material test passed. Source changes limited to new apps/web/tests/sticker-material.e2e.ts; no device material tuning was made solely to amplify evidence.
