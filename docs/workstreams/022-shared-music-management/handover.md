# Shared music management handover

Implementation ready for strict re-review. No commits, pushes, account writes or deployment performed.

## Ownership delivered

`packages/music-management` owns accepted target/occurrence, queue context and view, playback reconciliation, shared transport coordination, paused seek/resume, progressive library orchestration and lifecycle fences in a Jotai vanilla store. App composition publishes one facade per adapter; navigation, Panel, physical controls and tool callbacks converge there. Panel retains navigation/scrub preview and visual projections; separate current/total subscriptions preserve counter DOM.

Native Apple/Spotify adapters own service I/O, validation, SDK timing/recovery, relinking and native queue offsets/UID evidence. Spotify native count is explicitly unknown; app submitted-count policy lives common. Apple offset windows explicitly advertise unknown native full count, preventing an absolute index being paired with a short-window total when application context is absent.

## Review fixes and proofs

All first-checkpoint findings have source corrections plus durable tests in manager.test.ts, apple-contract.test.ts and the dual native/managed Spotify fixture. See evidence.md for source/test mapping and exact command results. Shared complete-queue recovery, old queue replacement, session notification, station failure, progressive mutation, native station retirement and Spotify post-204 SDK failure are covered. Read reviewers' final files rather than treating this implementer handover as approval.

## Known evidence boundaries

After a target is confirmed, SDK events lacking generation attribution may represent legitimate external playback; D8 accepts them. Attributable old command/read/account subscription completions are rejected. Pause protection covers pending local starts and releases after those settle, so it does not permanently suppress remote playback.

No live DRM/audio verification by implementer. Lead owns local browser smoke on existing route/account; do not reauthorize, mutate playlists or expose tokens. Build/type/lint logs and full/focused test totals are in evidence.md. This refactor does not change authentication or add capabilities.

Final implementer checks:847 tests/4134 assertions,14/14 typechecks,changed-file ESLint,build,diff check pass. Latest queue siblings/pendinghandoff fixes and exact repeat mappings included. Source held stable for reviewers; remaining approval belongs to independent lanes and lead live smoke.

## Approved closeout

Both independent reviewers formally APPROVE the stable source. Lead live Apple smoke confirmed immediate middle-of-list metadata/index/total, advancing playback time, skip counter progression, and paused seek-and-resume through the common manager. Playback was paused after testing. Spotify restoration was signed-out, so there is no live Spotify audio claim; its real-adapter deterministic contract tests passed. Full details are in evidence.md.

847 tests pass;14/14 typechecks,scoped changed-file lint,build and diff checks pass. Source is unchanged by this documentation closeout. Lead owns final scope checkboxes and user handoff. No commit, push or deployment was performed.

## Spotify Play/Pause follow-up

Narrow response-contract fix ready for independent review: Spotify's successful200 opaque acknowledgement previously reached JSON.parse. Added api.command for play/resume/shuffle/repeat/append while leaving data/token JSON validation unchanged. Production physical-control regression reproduced failure before fix and now covers200 and204 start/pause/resume with actual adapter and shared manager. Broader regression511 tests/2349 assertions passed; final focused23 tests/77 assertions includes added401 retry.14/14 typechecks,changed-file lint,build,diff checks pass. No commits or push by implementer.

Apple parity extension is ready for independent review. Three physical-control tests exercise the real Apple adapter through the common manager: normal void-returning play/pause/resume with preserved selection, rapid pause during a deferred native start, and rejected resume followed by successful recovery. No Apple or common production changes were needed. The expanded regression run passed 515 tests / 2372 assertions across 20 files; 14/14 typechecks and scoped lint passed.

Live Spotify evidence confirms the successful opaque acknowledgement no longer throws JSON parsing errors. Its later loading state matched the native SDK's own loading state; audible Spotify playback remains unconfirmed. No speculative playback-status repair was introduced. Lead owns the final live Apple verification and reviewer sign-off.

Final follow-up review: the independent reviewer APPROVE includes the new Apple physical-control tests (independent run: 32 tests / 117 assertions, web typecheck, lint and diff checks clean). Current live Apple playback verification was blocked before transport by a library HTTP 403, including after a fresh Apple-mode page. No current live Apple play/pause pass is claimed; the earlier workstream smoke remains separate historical evidence. Spotify's opaque successful command response resolves without SyntaxError, but the native SDK remains loading, so live audible playback is unconfirmed.

## Login readiness follow-up

The welcome handler treated resolved authorization promises as successful login. The runtime catches initial library errors and can retain an authorized SDK session, so checking session alone entered the player despite an error phase. The runtime now returns an explicit operation-fenced readiness result; the shared predicate requires both authorized runtime phase and session. Welcome consumes that exact snapshot, and rechecks it after the exit animation. BrowserExperience applies the same readiness gate before mounting the player on direct/restored routes. Spotify callback already returns the landing route, so server OAuth remains unchanged.

The existing runtime logic is enclosed in an injectable controller, allowing the production welcome-entry coordinator to be exercised with the real Apple adapter. Required first-page failures remain blocking; empty successful libraries remain ready and subsequent pagination still runs in the background. Spotify error retry restores its own runtime; the alternate provider sign-in link remains available. Optional sticker bootstrap remains independent.

New regressions cover caught 403/500 with an authorized SDK session, rejected and cancelled authorization, retry success, both-provider restore failure and empty-library success, optional sticker rejection, provider change during authorization, and concurrent/stale animated entry. Expanded focused regression: 508 tests / 2244 assertions across 20 files, no failures (`/tmp/login-regression.log`). Final all-workspace typecheck/build results pending. No commit, push or deployment by implementer.

Final login checks: 14/14 workspace typechecks and production build passed; the final route guard edit passed web typecheck, scoped ESLint and diff check. Lead tested the real BrowserWelcome after a fresh Apple-mode landing: the actual Connect Apple Music button returned to an error state at `/`, playerMounted=false, retry button enabled. No exit into the unavailable player occurred. Screenshot: `/tmp/webpod-login-failure-fixed.png`. This is real failure-path surface verification; it does not claim successful live account authorization.

Lead also verified fresh direct `/webpod?music=apple`: initial required-library failure returned to `/`, runtime phase error, playerMounted=false. The guard prevents entry; underlying provider/server authorization failures remain outside this narrow transition fix.
