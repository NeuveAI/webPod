# Login transition review

## Verdict: APPROVE

No remaining Critical/Major findings. The production login transition now requires successful core runtime readiness and rejects stale attempts.

## Confirmed cause

`BrowserWelcome.signIn` awaits `authorizeAppleRuntime`, which catches authorization/library errors and publishes an error snapshot. The handler then tests only SDK session authorization, although an authorized SDK session can remain after initial library 403/500. The handler enters the device despite the runtime error. Rendered `signedIn` already checks runtime phase, so event and render gates disagree.

The animated `enterDevice` also awaits an exit before navigating and only checks DOM connectivity afterward. Readiness and attempt ownership need revalidation across that delay. Direct `/webpod` restore/Spotify callback paths must reject failed initial runtime loading without relying on the manual sign-in handler.

## Acceptance checks

- Successful SDK authorization plus rejected initial core library request stays on welcome with readable error/retry.
- Empty successful library is ready; optional sticker/bootstrap errors do not block core login.
- Manual sign-in, auto-restore and Spotify callback use one explicit readiness contract.
- Old authorization attempts/provider changes and failures during exit animation cannot enter via a newer or failed snapshot.
- Existing browser capability gates and device sign-out behavior remain intact.
- Actual transition/control tests prove no player mounting/navigation on failure, rather than testing only a relabelled Boolean helper.

No source edits, credentials, server auth changes, account mutations or unrelated scope included. Final verdict requires source/evidence handoff and independent tests/static checks.

## Independent implementation review

No Critical/Major findings identified. Read D9 and final source diff. Production `BrowserWelcome` calls the tested `createWelcomeEntry` coordinator; readiness checks use both phase and authorized session, and accepted snapshot identity is checked after asynchronous authorization and exit. Animation `finally` cancels the filled transform and removes `data-departing`; coordinator `finally` resets its entry lock. Cancelled entry therefore restores the visible, retryable welcome. CSS adds clipping for departing only, with no persistent opacity mutation.

`DevicePage` wraps `InteractiveDevicePage` in `BrowserExperience`; the readiness guard is outside the player effect owner, so direct/restored failures do not mount those effects. Capability gating remains alongside readiness. The injected controller executes the production runtime implementation rather than a test-only copy. Controller tests use real Apple adapter fixtures for authentication/library failures. Empty successful libraries and optional sticker rejection remain accepted; late background pagination retains existing progressive semantics.

Independent command: `bun test apps/web/src/welcome-entry.test.ts apps/web/src/browser-welcome-policy.test.ts apps/web/src/music-runtime.test.ts apps/web/src/production-device-view.test.ts` — **50 passed, 207 assertions** (`/tmp/login-transition-review-tests.log`). Web typecheck, scoped changed-file ESLint and `git diff --check` passed. No actual DOM animation/live DRM claim is made from the coordinator tests; visibility cleanup is verified by source and existing CSS, with lead live smoke separate.

Reviewed SHA-256 fingerprints: runtime `53d7281719aafff0c393891b1e4e0c854a9eb07c31fd7a2948abc2a9895c0821`; welcome component `bcff83a9a6fb23da979f070080061241237c47966782cd635cbbf108a50e29b3`; coordinator `9b9ed61645f8cd9d7e9d9a2dbfd86b5f6c46f8464da0251cb390fb91decb3058`; tests `5b4b07bf083f3ddc8ec6885a70da259cf3ee39545eca7862d327c23a615d1cb0`.

## Final gate

Reviewed the final BrowserExperience effect: non-landing failed/signed-out runtime replaces the route with `/`, while in-flight restoration stays put and development capture remains explicitly excluded. The render gate prevents player mounting before that effect runs. Final welcome fingerprint is `741284d89baa8592b4b9a224f41f6dd5b5f819dacfb5f2e5f479a2a45730e4f7`; runtime/coordinator fingerprints above are unchanged.

Final pipeline evidence: **508 passed, 2,244 assertions across 20 files** (`/tmp/login-regression.log`), **14/14 typechecks**, production build, final web typecheck, scoped lint and diff checks passed. Lead separately verified the actual browser: manual Apple connection with core 403 remains at `/` with error, visible enabled retry and no player; direct `/webpod?music=apple` returns to the same welcome/error state. Lead screenshot: `/tmp/webpod-login-failure-fixed.png`. This is failure-transition evidence, not a claim that the external Apple 403 or live playback is fixed.
