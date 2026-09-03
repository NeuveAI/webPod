# Native cursor release evidence

**Date:** 2026-09-03

## Automated evidence

`bun test packages/device/src/click-wheel-input.test.tsx packages/device/src/click-wheel-input.integration.test.tsx packages/device/src/orientation-grab.test.ts`

- Includes a mounted R3F test that moves through the annulus and Select, observes
  `data-wp-cursor-control="true"`, and proves unmount cleanup. Existing integration
  coverage continues to exercise cardinal/Select input, cancellation, lost
  capture, keyboard Select, and click-wheel capture regressions.

`bunx tsc --noEmit -p packages/device/tsconfig.json`

- Pass.

`bun run lint`

- Pass.

`bun run gates`

- Types, lint, and all 1,160 unit tests pass.
- 15 automated gate classes pass. U8 is red on unrelated concurrent work in
  `apps/web/src/music-runtime.ts:105`; the cursor patch does not touch that file.

## Browser evidence

`bunx playwright test --config apps/web/tests/playwright.config.ts apps/web/tests/native-cursor.e2e.ts`

- 2 passed in Chrome with the production html-in-canvas feature enabled.
- Fine pointer: one mounted canvas; stage `cursor: default`; preview button
  `cursor: pointer`; outside note `user-select: text`; wheel R3F hit publishes
  `data-wp-cursor-control="true"` and computes `cursor: pointer`.
- Orientation edge: authoritative stage state changes `ready → active`, with
  canvas computed cursor `grab → grabbing`; dispatched `pointercancel` clears
  active state and the grabbing cursor.
- Coarse pointer: the same mounted wheel hit still publishes interaction intent,
  but the fine-pointer media query does not match and computed cursor remains
  `default`.

Screenshots are not authoritative for a native system cursor; DOM attributes and
computed styles are the primary browser evidence. Owner visual sign-off remains open.
