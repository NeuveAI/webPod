# Orientation implementation diary

2026-09-07. Ownership: `apps/web/src/device-preview-orientation.ts` and its existing test file only. Architecture mapping was saved separately in `evidence/interaction-research.md`. No sticker files, production-device-view, registration files, or commits were changed by this slice.

Read scope and decisions, global-patterns and its referenced global guide, modern-web-guidance, and interface-craft/storyboard instructions. Ran modern-web-guidance search/list and retrieved physics-based-easing; retained the existing JavaScript physical spring because CSS animation cannot own this Three scene's orientation. Reduced motion is respected at admission and on each frame. The lead/user's continuous implementation instruction and no-commit workstream decision govern this bounded slice.

Agreed API with core implementer:

- `DeviceOrientationControls.rotate(xDeg: number, yDeg: number): DevicePreviewState`: relative x=pitch/y=yaw degree deltas; validates finite input and finite sums, rejects active human capture/disposal, cancels existing spring, returns actual clamped state.
- `DeviceOrientationControls.flick(face: 'front' | 'back', signal: AbortSignal): Promise<DevicePreviewState>`: nearest requested yaw face, using the existing `advanceDeviceOrientationRelease` frame scheduler and spring constants. Returns actual state only at rest. Same-face/no-motion and reduced-motion cases resolve immediately.

Flick rejects simultaneous motion ownership, a pre-aborted signal, disposal, and invalid runtime face values. Once admitted, abort, human grab, stage keyboard action, blur, external orientation mutation, rotate, or disposal cancels and rejects with AbortError. Settlement removes the abort listener and pending frame. A generation check prevents an abort invoked synchronously by a store subscriber from reviving the animation after publication. Tools keep their own provenance; this controller does not forge browser events.

Focused regression: 46 tests pass, including 11 new tool tests. Focused ESLint passed. App tsc was attempted and failed only at a concurrently edited composite audio comparison (reported to core implementer); evidence records the exact diagnostic. No browser proof claimed: production registration/wiring is owned by core.

An initial test attempt hung because a Bun promise rejection assertion was attached before the synchronous interruption; it was stopped and rewritten to capture the rejection first and assert after interruption. The corrected full focused run passed.

Review boundary: inspect spring settlement/cancellation, finite rotation validation, lifecycle cleanup, nearest-face behavior, and core's use of this typed handle. Existing source-analysis tests and wider app gates remain in the main workstream verification.
