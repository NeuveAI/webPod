# Native WebMCP evaluation evidence

Status: extended native suite **11/11 passed**, discovering all 16 tools and exercising both upstream deterministic smoke sequences with 24 explicit result assertions. Separate earlier Puppeteer CLI smoke passed five global core calls. Results apply to recorded snapshots; rerun after subsequent review fixes.

## Availability probe, 2026-09-07

Executed in `/Users/vinicius/code/.better-coding-agents/resources/webmcp-tools/webmcp-evals` using installed puppeteer-core@25.4.0:

```sh
bun -e 'import puppeteer from "puppeteer-core"; const browser = await puppeteer.launch({channel:"chrome-canary",headless:true,args:["--enable-features=WebMCP"]}); try { const page=await browser.newPage(); await page.goto("http://localhost:3000",{waitUntil:"domcontentloaded"}).catch(error=>console.log("navigation",error.message)); console.log(await page.evaluate(()=>({url:location.href,secure:isSecureContext,documentAPI:"modelContext" in document,navigatorAPI:"modelContext" in navigator,register:typeof document.modelContext?.registerTool,execute:typeof document.modelContext?.executeTool,get:typeof document.modelContext?.getTools}))); console.log("browser",await browser.version()); } finally {await browser.close();}'
```

Exit 0. Existing production `/` loaded at http://localhost:3000/. Browser `Chrome/155.0.8043.0`; secureContext=true; document.modelContext exists; navigator.modelContext absent; registerTool/executeTool/getTools are functions. No polyfill injected. This probe asserts browser availability, not application tool registration or served source identity; the later suite uses the repo snapshot fingerprint gate.

## Planned evidence

1. Author deterministic webmcp-tools smoke cases with explicit return-value expectations against the existing production root. Keep unauthenticated root interactions deterministic; use current legitimate menus rather than adding a test route.
2. Native Canary Playwright assertions: complete unique schema discovery; full list/selection consistency; input rejection; paced no-burst traversal; native execution AbortSignal stopping effects; read-only page-clock observations; normal trusted keyboard audio unlock followed by agent SFX counter changes; orientation deltas and settled flick; reload registration lifecycle.
3. For longer lists, use existing `installDeterministicAppleMusic` provider helper only in browser tests. This verifies production app flow with deterministic provider data, separately from external smoke on an unseeded root.
4. Use existing source-snapshot Playwright config and assertBrowserSourceIdentity. Record exact command, fingerprint and exit status after tools land. Record direct audio scheduling evidence as scheduling, never as proof that external speakers made sound.
5. Supplemental lifecycle/registration cleanup coverage stays in unit/integration tests where React unmount cannot be triggered through legitimate root UI. A full document reload establishes document lifecycle but is not proof of a same-document component unmount.

No model provider credentials, real user music data, or credentials from cert/ are required. Upstream npm wrapper scripts are not used.

## Completed native proof

Files: `apps/web/tests/webmcp-native.e2e.ts`, `apps/web/tests/webmcp-evals.json`, `apps/web/tests/webmcp-native-global-smoke.json`. No production files, package manifests, or repository lockfiles edited by this lane.

Command at repository root:

```sh
W5B_PORT=4329 bunx --bun playwright test --config apps/web/tests/playwright.config.ts webmcp-native.e2e.ts
```

Exit 0, **6 passed (32.3 seconds)**. Served immutable snapshot fingerprint `7e53af265197c248a4bf75cf1c298b667fab4c722be2356cec51c2743ef5563d`, 404 source files; base git HEAD `2f1001a0b72b1829a581123e4cc4691f0c60319e`. Each browser test calls assertBrowserSourceIdentity against the served snapshot and records its digest in test annotations. Provider is seeded only with existing installDeterministicAppleMusic (11 songs) on `/`; no diagnostic route, product-state API, native registry replacement or real provider credentials.

Final rerun after typed-import/read-helper cleanup: same command, exit 0, **6 passed (32.2 seconds)**, served fingerprint `86ca7a2f4e7603a657f7ea484c0961ff368ff6c2809f8b09cfd9403cba0cab52`, 405 source files. This is the final native proof for this lane; later core changes require a fresh run.

Passing checks:

- Unique native registry names and JSON schemas; truthful read-only flags; complete list count with selected row also present in items.
- External webmcp-tools `compileSmokeTests` / `runSmokeTest` executes 11 authored calls covering all seven core tools through native getTools/executeTool. Each output is matched against explicit fixture expectations with upstream `matchesArgument`. A deliberately wrong selected position 999 is confirmed to fail matching.
- Invalid counts (zero, fractional, >1000), direction, unknown properties, orientation range and wheel button reject without selection/orientation mutation.
- A real trusted Escape keyboard contact unlocks normal Web Audio. Eight subsequent native list steps produce eight separately observed visible selections, take at least 1600 ms and increase the real scheduling counter by at least eight. DOM timestamps have a 175 ms minimum assertion to allow rendering jitter; exact 200 ms scheduling/no-burst proof belongs to injected-clock unit tests. Scheduling does not prove audible speaker output.
- Native AbortSignal cancels a ten-step traversal after partial progress; selection remains unchanged during a further 550 ms observation, navigation state clears, and the next invocation succeeds.
- Relative pitch/yaw reflects actual orientation; back/front flick returns after motion settles and preserves existing pitch. Reload registers each tool once. Reload verifies document lifecycle, not React component unmount in the same document.

Observed browser implementation lag: Canary 155.0.8043.0 exposes JSON-string schemas in getTools and requires JSON-string input to executeTool. Initial direct current-draft consumer calls failed with `UnknownError: Failed to parse input arguments`. The test-only adapter branches on the observed schema transport and normalizes it; current-spec production registration is unchanged. This is browser implementation acceptance plus separate draft handler tests, not a claim that Canary's consumer transport conforms to the latest draft.

Two initial fixture assumptions were corrected to match the intended contract: select may truthfully return loading before the next read, and physical flick preserves pitch instead of resetting it. These were expectation errors, not product changes.

## Separate upstream CLI smoke

Owned isolated dev server: `bun run --cwd apps/web dev --host 127.0.0.1 --port 4328 --strictPort` (no environment-file loading). Command in reference webmcp-evals directory:

```sh
bun src/bin/webmcp-evals.ts smoke -u http://127.0.0.1:4328 -e /Users/vinicius/code/webPod/apps/web/tests/webmcp-native-global-smoke.json --chrome-channel chrome-canary --timeout 30000 -v
```

Exit 0, **5/5 calls passed** through actual Puppeteer page.webmcp/tool.execute. Unseeded `/` returned page status unavailable with null elapsedMs and zero loaded items; list read, rotate, back flick and front flick all executed. This run validates global tool discovery/execution without an account, not functioning live Apple Music or interaction readiness. The direct dev server is mutable, so only the snapshot browser run above carries immutable served-source proof.

**Upstream limitation:** bare CLI smoke discards expectedCall.result when compiling cases; it does not validate return values. That is why the main native suite wraps its exported executor with explicit result matching and a negative control. CLI PASS alone is never counted as behavioral proof.

## Static checks and limitations

`bunx --bun eslint apps/web/tests/webmcp-native.e2e.ts` exits 0.

Standalone strict test compilation attempted with `bunx --bun tsc --noEmit --moduleResolution bundler --module esnext --target es2024 --lib es2024,dom,dom.iterable --jsx react-jsx --esModuleInterop --resolveJsonModule --allowImportingTsExtensions --skipLibCheck apps/web/tests/webmcp-native.e2e.ts`. Exit 2, remaining errors only in existing `apps/web/tests/source-identity.ts`: untyped direct index.mjs import (TS7016 line 1) and indexed object access (TS7053 lines 84–88). New test uses typed @playwright/test import and runtime narrowing of existing preview getter; no remaining errors attributed to the new file. The app tsconfig excludes browser tests; do not mistake app typecheck for browser-suite type coverage.

Full five-button playback semantics, provider loading/progress lifecycle, in-document mount cleanup, simultaneous mutations and human-interruption ownership require the core unit/integration suite and strict reviewers in addition to this bounded native lane. No model-selection evaluation ran because none is needed for deterministic coverage and no provider credential was requested.

## Sticker extension and approved-core regression

After both core review approvals, the same full six-test native command passed again: exit 0, 6 passed (32.3 seconds), immutable served fingerprint `4cd0cc89e5b62eb74d659505195eb90945307b9345c7ac77e314467f64a3e198`, 409 files.

The native suite is extended to 16 registered tools, with a second authored upstream smoke sequence covering the nine sticker names. Test-only `webmcp-native-stickers.ts` uses the existing /api/stickers network seam: PW-A01 earned in an opened pack, PW-B01 already placed with exact rotation/width/wear, PW-C01 sealed, remaining catalog locked. It validates outgoing placements with canonical isStickerPlacement and supports failed/delayed writes. Production route and native registry remain real.

Browser assertions additionally cover full catalogue statuses, rejected locked/sealed grabs, zero pack-claim writes from opening UI, placed-origin release without persistence, failed placement/retry preserving width/rotation/wear, reload persistence, real human pack-close/front-flip cancellation and abort during a pending server write. Preparation-sensitive smoke steps poll actual sticker page-state readiness, not guessed animation timers.

Initial extension run: 7/11 passed on fingerprint `c2986d549c4c2e66d95dfe6e3898ceef94fae31159c085f2ad14abcdfd1726b4`, 411 files. Corrected two test assumptions using actual UI contracts: newest sealed rock collection opens initially and collection navigation wraps across three available genres; successful persistence returns before visual landing finishes, so tests await read-only held-state clearance. No production changes were made for those fixture corrections. Final results follow when the extension finishes.

Focused sticker rerun command: `W5B_PORT=4329 bunx --bun playwright test --config apps/web/tests/playwright.config.ts webmcp-native.e2e.ts --grep 'Carry, edit|sticker catalog|held placed|human pack|abort during persistence'`. Exit 0, **5 passed (34.0 seconds)**. Served fingerprint `fe1e3a1d841671badf1e89c18e968f6ee19e6f2f535dbfea06945a5b44d3be13`, 412 files. The sticker upstream smoke contains 13 calls; the core smoke contains 11. Explicit result matching and negative controls are applied to both.

Scoped ESLint for `webmcp-native.e2e.ts` and `webmcp-native-stickers.ts` exits 0. Standalone strict TypeScript still reports only the previously recorded existing source-identity.ts diagnostics, with none in either new test/helper file.

Review coordination caveat: sticker production fixes for pre-persistence cancellation and save ownership were actively in review during this lane. Each passing run certifies only its recorded immutable fingerprint. Rerun the full command after the final reviewed production changes; native success does not replace those targeted race tests or independent review.

Full extended command: `W5B_PORT=4329 bunx --bun playwright test --config apps/web/tests/playwright.config.ts webmcp-native.e2e.ts`. Exit 0, **11 passed (59.1 seconds)**. Served fingerprint `aa604bd3dd49c2801f2a99b1fb987706ae1d4459eca74fa34b402187aad3dbaf`, 413 files. Includes malformed held rotation/wear/place inputs rejecting without changing the draft or persisted origin. Server started and stopped automatically by snapshot config; no owned dev server remains running.
