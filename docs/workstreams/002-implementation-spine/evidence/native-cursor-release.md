# Native cursor release evidence

**Date:** 2026-09-03

## Automated evidence

`bun test packages/device/src/cursor-intent.test.ts packages/device/src/click-wheel-input.test.tsx packages/device/src/click-wheel-input.integration.test.tsx packages/device/src/orientation-grab.test.ts`

- 33 pass, 0 fail, 181 assertions.
- Covers idle → grab → grabbing → grab, rejected starts, pointer cancellation,
  lost capture, disposal cleanup, wheel pointer intent, cardinal/Select input,
  keyboard Select, and click-wheel capture regressions.

`bunx tsc --noEmit -p packages/device/tsconfig.json`

- Pass.

`bun run lint`

- Pass.

`bun run gates`

- 15 automated gate classes pass, including types and lint.
- The aggregate test class is red from an unrelated pre-existing dirty change:
  `packages/providers/src/apple/apple-provider.test.ts` expects `Night` and
  receives `undefined` in “loads provider-neutral album and artist
  relationships.” Cursor-targeted tests remain green.

## Browser evidence

The `/_spike/device` Vite route started successfully at localhost. The configured
Chrome computer-use surface was unavailable, so no native browser capture could
be produced. Screenshots are not authoritative for a native cursor in any case;
the test-observed `data-wp-cursor-control` and `data-wp-cursor-orientation`
transitions are the primary evidence. Owner visual sign-off remains open.
