# Production browser session verification

The actual built TanStack Start `/` mounts the shared `DevicePage` and real `ProductionDeviceView`. The previous root redirected into a development-only route; extracting the existing component preserved its styles, orientation, settings and renderer. Capture controls, debug globals and playback diagnostics remain development-only. The production root assertion requires a T1 device and visible canvas, and confirms the debug global is absent.

`bun run --cwd apps/web build` passed. Built server SHA-256: `f4c5218a1abb57549e39816390d6fdb97b61ab2b11d601629b00b023e953aac4`.

`bun test apps/web/scripts/sticker-browser.integration.test.ts` passed: 1 test, 42 Bun assertions, 4.83 seconds. Additional Playwright assertions require actual rendered orange Rock sticker pixels on the rear before accepting placement and reload captures. An earlier capture was taken before canvas paint; the final capture uses the exact screenshot that passed the pixel assertion. No product lifecycle change was needed.

The harness serves built client assets and calls the built Start entry with trusted server context. It uses real temporary SQLite and native browser HttpOnly cookies. No `/api/stickers` or developer-token browser request is intercepted. Only the MusicKit SDK and injected server-side Apple upstream/signing dependencies are synthetic; no live keys, Apple credentials or user data are used. The test closes browser contexts, browser, server and database and removes its temporary directory even on setup failure.

Verified: anonymous 401; Apple sign-in and genre starter; rear rotation; pointer pull; earned pack opening; pointer peel and rear landing; saved placement; rendered reload persistence; sign-out revocation/401 while device credential remains; fresh verification and same collection on reconnect; second browser receives a separate collection. Cookie values and request bodies are never recorded. `browser-verification.json` records only safe route/status metadata and proof results.

- `browser-01-real-starter.png`: real starter pack tease.
- `browser-02-real-placement.png`: pointer-placed Rock sticker on rear.
- `browser-03-reloaded.png`: same sticker rendered after browser reload.

`bunx --bun tsc --noEmit -p apps/web/tsconfig.json` passed, including the new scripts. Scoped ESLint passed for the page, routes, structural tests, SDK helper and harness. `bun test apps/web/src/device-preview-orientation-source.test.ts apps/web/src/playback-diagnostics-view.test.tsx apps/web/tests/production-device-view.test.ts` passed 6 tests / 62 assertions.

The already-installed Playwright 1.62.1 is now a direct web development dependency to typecheck the harness and imported SDK helper via canonical package imports. There is no new production dependency.
