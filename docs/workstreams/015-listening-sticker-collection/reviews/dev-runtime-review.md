# Development startup incident review

## Verdict: APPROVE

Final independent checkpoint: the shipped development startup failure is fixed and both actual package-script launchers pass. No unresolved Critical or Major finding remains in this incident. The prior session/root approval omitted this launch path; this review supplies the missing proof rather than treating historical production tests as sufficient.

## Resolved finding — original reproduction

**Critical — Shipped dev script runs Start SSR under Node while server domain imports Bun** (`apps/web/package.json`, scripts.dev). `vite dev --port 3000` executes the installed `#!/usr/bin/env node` CLI. Independent `bun run --cwd apps/web dev --port 43873 --strictPort` created a Bun package-script parent and a Node Vite child. Requests to `/`, `/_spike/device` and `/api/stickers` all returned500 with `Cannot find module 'bun'`. This breaks the documented development entry and both actual device routes before renderer startup. Root dev delegates to the same app script. Existing browser gate launchers explicitly ran the Vite entry through Bun, bypassing this shipped script and masking the failure.

## Boundary diagnosis

- Reproduced actual process provenance with process IDs85012(Bun script parent)/85013(Node Vite child). These were reviewer-owned processes on isolated43873 and were terminated; no user server touched.
- The same broken server returned browser-transformed `/src/routes/api.stickers.ts`200 with `createFileRoute('/api/stickers')({})` and no sticker-handler.server import. Thus the screenshot's failure is demonstrably SSR runtime resolution, not by itself proof of executable client leakage. Startup dependency scan also reported unresolved bun; fixed startup must eliminate this and verify actual browser graph/errors.
- Canonical `/Users/vinicius/code/.better-coding-agents/resources/bun/docs/pm/bunx.mdx:61-70` documents respected Node shebangs and runtime override positioning. Installed `apps/web/node_modules/vite/bin/vite.js:1` has the Node shebang. Installed Vite8.2.2 `dist/node/module-runner.js:1023,1233-1236` delegates external imports through its evaluator, hence host runtime capabilities matter.
- Prior launch divergence: `apps/web/tests/playwright.config.ts:58` and `packages/panel/playwright.config.ts:51` run `bun node_modules/vite/bin/vite.js dev`; source test passing under this alternate entry did not validate scripts.dev. `scripts/w7-browser-evidence.ts` has another direct runtime launcher to assess under incident scope.

## Required acceptance scope

Actual root and app package scripts on isolated ports; browser-rendered production `/` and legacy device route; absence of Vite overlay/module errors; anonymous real sticker API through default server factory with temporary private DB and no live credentials; dev module response/import graph plus rebuilt production client boundary; types/lint; prior production native/browser tests. No injected entry/forced-runtime bypass in the regression. Keep synthetic Apple interception limited to prior production integration, never replace the dev API under test.

No implementation edits by reviewer; no key/environment-file/encrypted-design contents accessed. Repo law forbids Kanban/Neuve. Skills and canonical references from the session review contract remain loaded; no UI changes are currently proposed.

## First fix checkpoint (not approved)

Explicit Bun package-script launch corrected SSR host selection; browser gate siblings now delegate to that script. Independent `bun test apps/web/scripts/dev-startup.integration.test.ts` on the first frozen snapshot returned **0 passed / 2 failed / 1417 assertions**,59.64s. App renderer/API/loaded-module checks progressed, but exact warning assertion caught `Failed to run dependency scan ... bun ... could not be resolved`. This is the raw dependency optimizer traversing server-only workspace imports, separate from actual executable browser-module leakage. Engineer retracted freeze and added narrow canonical optimizer exclusion for the server-only workspace package, with no alias or persistence fallback.

Root launcher additionally failed readiness within45s. This was not treated as success or silently dismissed as the warning. Engineer added bounded credential-free startup diagnostics and removed nested executable dispatch from the final script; no unsupported Bun-internal cause is claimed. Both direct-script launchers and production regressions now pass independently as recorded below.

## Final source and canonical boundary review

- App scripts now directly execute installed pinned `node_modules/vite/bin/vite.js` with Bun for dev, build and preview. The real root scripts still delegate to the app. Tests invoke `bun run dev` itself, without a harness runtime override, alternate entry, API mock, or injected server.
- Both Playwright configurations and the w7 evidence launcher delegate to `bun run dev`, so their successful runtime can no longer differ silently from the documented command.
- Vite `optimizeDeps.exclude` contains only the server-only `@webpod/server-core` workspace boundary. Installed Vite8.2.2 `dist/node/chunks/node.js:2133,31674` verifies package/subpath exclusion and scanner externalization semantics. This avoids raw optimizer traversal; it does not alias Bun, disable normal browser imports, replace SQLite, or conceal a client exception. Actual transformed/loaded browser code is separately asserted clean.
- No UI, session domain, schema, credential behavior or material/physics source changed. Backend/router/global-patterns and pinned/local Bun/Vite/Start references frame this review. The previous UI review remains applicable to unchanged surfaces; no new subjective craft claim is made here.
- Reviewed subprocess harness isolation: credential-free source snapshots, frozen-lockfile installation, explicit empty Apple configuration, temporary private SQLite path, owned process group and settled browser/process cleanup. No existing user server/database or signing material accessed.

## Independently executed final checks

1. `bun test apps/web/scripts/dev-startup.integration.test.ts` — **2 passed, 0 failed, 2004 assertions,24.99s**. Actual root launcher12.26s; app launcher12.60s. Each starts its own shipped script on an isolated port, loads `/` and `/_spike/device`, reaches real T1 Canvas, and has no Vite overlay/page/module errors or failed same-origin module requests. Anonymous real `/api/stickers` returns401/no-store and creates the isolated SQLite file. Loaded executable scripts/transformed route contain no Bun/server implementation markers; exact dependency-scan warnings are absent. There is no internal retry masking startup failure or increased readiness timeout.
2. `bun test apps/web/scripts/sticker-browser.integration.test.ts apps/web/scripts/sticker-start.integration.test.ts apps/web/scripts/sticker-production.test.ts` — **3 passed, 0 failed,260 assertions,5.19s**, against the final rebuilt output. Covers real production browser cookie/sign-in/pointer placement/visible reload/reconnect/isolation, native generated Start earning/replay transport, and all60 static artwork SHA256 checks. Only this existing production integration uses trusted synthetic Apple/signing dependencies; the dev regression uses the default server path with no API injection.
3. Independently ran app, panel and scripts TypeScript configurations: **passed**. Scoped ESLint for modified config/launcher/test files: **passed**. `git diff --check`: **passed**.
4. Final rebuilt client JS search for `bun:sqlite`, `createLiveStickerServer`, `mintAppleDeveloperToken`, `APPLE_MUSICKIT_KEY_PATH`, `sticker_sessions`: **no matching files**. This targeted source-marker check supplements actual dev module graph/error assertions, not a standalone claim of universal security.

Engineer evidence in evidence/session/dev-runtime-checks.md records failed-before results, dispatcher limitation honestly, final repeated dev success and final rebuild. Reviewer independently observed the failures and final passes above. Minor pre-existing generic notFound-component warning during production browser run is unrelated to module loading and does not invalidate its successful renderer/API assertions.

## Final disposition

**APPROVE** for the development runtime/configuration/gate repair and its scoped regression evidence. The original Critical is resolved; optimizer warning and intermediate root readiness gaps are closed by the final direct-script implementation and independent root/app proof. Lead may commit the reviewed fix/tests and incident documentation. No deployment or user-process restart is implied by this approval.
