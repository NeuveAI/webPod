# Missing-route recovery

The root now configures TanStack Router's `notFoundComponent`. Unknown URLs receive a concise page with a 404 label, heading, and typed `Link` back to `/`. No catch-all route, redirect, status override, warning suppression or application state was added. Existing root shell and player remain unchanged.

The warning alone does not identify the user's missing URL. In the isolated development test, explicit requests to `/missing-page`, `/_spike/device/missing-child` and `/favicon.ico` each returned 404. The actual browser response observer recorded `/missing-page`; it did not establish an automatic favicon request in that run. These are reproducible probes, not a diagnosis of the user's exact requested path.

Modern Web Guidance ran first for this task (no matching guide for router 404 recovery). Read TanStack Router skill and local reference `resources/tanstack/router/docs/router/framework/react/guide/not-found-errors.md`. Verified pinned Router 1.170.32 `src/renderRouteNotFound.tsx`: a configured root component takes the supported rendering path that otherwise emits the reported warning. Interface Craft and all Interface Design Guardrails resources informed the small recovery page: one clear action, existing neutral palette, readable heading and a 44px minimum link target with full focus ring. Neuve Motion requires purposeful motion; this static recovery page adds none. No Jotai/state change is needed.

Own verification:
- `bun test apps/web/scripts/not-found.integration.test.ts -t 'shipped dev'`: passed in 9.32s, with 11 Bun assertions plus actual browser checks.
- The harness uses the exact shipped root dev command on an isolated credential-free source snapshot and port. It checks real HTTP 404, no server/browser notFoundComponent warnings, and keyboard activation of Return to player reaching the actual T1 canvas at 375px.
- `bunx --bun tsc --noEmit -p apps/web/tsconfig.json` and scoped ESLint passed.
- `not-found-mobile.png` was visually inspected: heading and recovery link fit 375px and keyboard focus is visible.
- `not-found-verification.json` records safe source fingerprint and observed/probed paths.

`bun test apps/web/scripts/not-found.integration.test.ts -t 'built Start'` passed after the coordinated final build: 1 test / 15 assertions, verifying all three missing paths remain HTTP 404 with the recovery markup, valid root remains HTTP 200, and no configuration warning occurs. Built server SHA-256: `69bffc69915a3221d6207e9ee5d3e7c4ddd7c9e082ac4d5227bc46921919701d`. No user server, live Apple account, existing database, keys or environment files were accessed.
