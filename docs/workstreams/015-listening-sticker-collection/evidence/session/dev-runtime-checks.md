# Shipped development runtime regression

Engineer investigation; independent review remains a separate release gate.

## Failure and root cause

The regression test launches `bun run dev` through the actual root and app package scripts. Before correction, both returned500 at `/` with `Cannot find module 'bun'` (2failed cases,15.81seconds; bounded `dev-runtime-before.log`). Reviewer separately reproduced500 for `/`, `/_spike/device` and anonymous `/api/stickers` and verified a Node Vite child beneath the Bun script parent.

The app script was `vite dev --port 3000`. Installed Vite8.2.2 `bin/vite.js:1` uses `#!/usr/bin/env node`; Bun package execution respects that interpreter. Installed Vite `dist/node/module-runner.js:1023-1024` executes external modules with `import(filepath)`, so Start's SSR server imports encountered Node without Bun builtins. Canonical local reference: `/Users/vinicius/code/.better-coding-agents/resources/bun/docs/pm/bunx.mdx:61-70`. This was a server runtime failure; the broken server still returned a transformed browser sticker-route module without server handler imports. The screenshot alone did not prove client leakage.

An initial package-level `bun --bun run vite` correction made both renderer paths and SQLite transport work, but a tightened assertion caught a separate raw dependency-scan warning: the optimizer crawled server-core before Start's browser handler stripping. A narrow `optimizeDeps.exclude: ['@webpod/server-core']` keeps that ESM server-only workspace package and its subpaths out of browser prebundling. This is Vite's documented optimizer boundary, not an alias or storage fallback. References: local Vite `docs/config/dep-optimization-options.md:15-19`; installed Vite package/subpath matching and scanner verified independently.

Nested executable dispatch also intermittently remained alive45seconds before producing any Vite startup output. The bounded readiness failure includes exitCode and last2000bytes from the credential-free child (`dev-runtime-dispatch-hang.log`). App-only diagnostics passed, so no unsupported Bun-internal cause is asserted. Final package scripts directly execute the installed pinned Vite CLI with Bun, removing that intermediate dispatch path. No test timeout was increased or failure retried inside the regression.

## Final change

- App dev/build/preview: `bun node_modules/vite/bin/vite.js` followed by the corresponding Vite command. All three now choose Bun explicitly. Build executes configuration/plugin code; preview may execute compiled Start server code and therefore also requires Bun. Existing production start already invokes Bun directly and is unchanged.
- Root dev/build still delegate to the app package script; real root invocation is tested. The root environment-file behavior remains unchanged for the owner.
- Both Playwright gate launchers and `scripts/w7-browser-evidence.ts` now invoke canonical `bun run dev`, retaining snapshot metadata, argument forwarding, fixed ports and strictPort. They no longer bypass package scripts with a different runtime launcher.
- Vite excludes only the server-core workspace package from client dependency optimization. Start still strips server handlers from executable browser modules. No server implementation/identity/domain behavior changes, UI edits, new framework, secrets, dependency version changes or fallback persistence.

## Regression boundary and isolation

`apps/web/scripts/dev-startup.integration.test.ts` creates a worktree source snapshot through `prepareBrowserSourceSnapshot`, which preserves exact root/app package scripts, source bytes and bun.lock while excluding credentials, .env files and private runtime state. Frozen-lockfile installation creates the isolated dependency graph. Each case launches only `bun run dev --host 127.0.0.1 --port <reserved ephemeral port> --strictPort`; the harness never chooses Vite's runtime or injects another Start entry.

The child receives PATH, an isolated private SQLite path, and explicitly empty Apple configuration. It cannot access the owner's key or environment files. No browser endpoint is mocked. Chrome must render the actual T1 device and Canvas on both `/` and `/_spike/device`, without a Vite overlay, page/module errors or failed same-origin script requests. Anonymous `/api/stickers` must return401/no-store and create the real SQLite file. Every loaded same-origin executable script and the transformed sticker-route module are checked for Bun imports and server implementation/signing markers. Startup output rejects the exact unresolved dependency-scan class as well as module/runtime failures.

Cleanup uses settled browser/process operations so browser teardown failure cannot skip the owned detached process group. Only that group is terminated; stdout/stderr streams are drained and the isolated directory removed. No existing user server or database is stopped or changed.

## Checks

- Before shipped scripts:2fail/0pass, exact root+app500 Bun module error.
- Final shipped scripts plus optimizer boundary:2pass/0fail,2004assertions,20.68seconds. Exact command: `bun test apps/web/scripts/dev-startup.integration.test.ts`. Both cases use distinct isolated snapshots/ports.
- Root `bun run typecheck`:12/12 projects clean; app includes scripts. Explicit scripts TypeScript and scoped ESLint passed. New harness cleanup diagnostics were checked again after final edits.
- Source snapshot regression:6pass/42assertions, preserving script/archive identity and private state exclusions.
- Production rebuilt through root `bun run build`; native Start transport, static asset smoke and actual browser/API/SQLite integration passed3tests/260assertions before the final optimizer/direct-entry adjustment. A final same-scope rebuild/rerun and repeated dev run follow below, with independent reviewer results in reviews/dev-runtime-review.md.
- Executable rebuilt production client JS scan for `bun:sqlite`, `createLiveStickerServer`, `sticker_devices`, `webCryptoAppleTokenSigner` and `APPLE_MUSICKIT_KEY_PATH` found no matches. Browser-loaded development graph is asserted dynamically by the regression.

Logs are bounded non-secret local evidence under this directory with prefix `dev-runtime-`. Existing production browser proof files may be regenerated by their existing tests; preserve review checkpoint history separately from rerun timing/image noise.

## Final engineer checkpoint

After the direct package CLI and narrow optimizer exclusion were frozen, the complete shipped-script regression passed again:2tests/2004assertions/24.97seconds. The independent reviewer separately passed the same two cases/2004assertions/24.99seconds. These repeats specifically addressed the earlier observed readiness uncertainty; no in-test automatic restart or timeout increase occurred.

Final `bun run build` passed using the shipped root→app direct Bun CLI. Final `bun test apps/web/scripts/sticker-start.integration.test.ts apps/web/scripts/sticker-production.test.ts apps/web/scripts/sticker-browser.integration.test.ts` passed3tests/260assertions/6.75seconds. Rebuilt executable client scan again found zero Bun/SQLite/server-signing implementation markers. Reviewer was released to independently rerun these production checks after all engineer-owned processes completed. Lead reports final root types12/12 and diffcheck clean. No commit by engineer; independent approval and lead cleanup/commit remain separate.
