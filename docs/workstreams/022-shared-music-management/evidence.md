# Verification evidence

Baseline lead run: 469 tests, 2179 assertions on production/main 36f0b97.

Current full impacted deterministic run (`/tmp/webpod-manager-final2.log`):
`bun test packages/music-management/src packages/providers/src apps/web/src/music-runtime.test.ts apps/web/src/production-device-view.test.ts packages/panel/src packages/state/src packages/tools/src`

842 passed, 0 failed, 4114 assertions, 41 files. Includes unchanged native provider regressions, all panel/state/tools tests and both real adapters through common management. No real music-account mutations were performed by implementer.

## Exact regression mapping

- manager.test.ts: immediate [A,B,A] selection and stale A/index0; late A success/rejection after B; progress-only/no-React confirmation; stale queue read after replacement; same-track events during queue read; seek cancellation on new selection/deactivate/dispose/account switch; failed seek no-resume/recovery; invalid target does not mutate intent; loading skip invalidated by selection; logout fences callbacks and notifies session once; listener cleanup; shuffle/partial append; complete-queue append recovery and tool-selected replacement; station rejection; immutable accepted target during progressive source mutation.
- apple-contract.test.ts: actual createAppleProvider using the pre-existing MusicKit fake; exact duplicate index and descriptors, seconds conversion for paused seek, native event confirmation, 250-item context with 100-item native window (absolute175) and selected-only fallback (native1), and station seed lookup resolved after deactivation cannot call setQueue/play.
- spotify-provider.test.ts: full original real adapter fixture runs in native and managed modes. Covers REST device/offset payload, API pagination/schema regressions, duplicate UID/linked_from identity, natural/explicit skip, missed event recovery, interpolated position/clamping, native unknown versus managed full context. Managed branch additionally verifies successful HTTP play followed by SDK playback_error retains selected metadata/index and settles error, then subsequent playback recovers.
- Panel.integration.test.tsx: all album/playlist/Songs/genre/search immediate counters, mounted duplicate confirmation, stable counter nodes, queue mode selection, paused scrub, metadata/prefetch and invalid-artwork regressions. Confirmed duplicate retains its known counter rather than dropping the shell.
- production-device-view.test.ts: cross-entry-point root pause/skip order, loading skip invalidated by runtime replacement, immediate double-toggle pause plus compensation after delayed native start settles.

Canonical protocol sources and limitations remain in provider-contracts.md. Native confirmation timestamps cannot identify arbitrary external untagged events after confirmation; D8 intentionally accepts authoritative external changes while fencing attributable operation/subscription generations. The pause latch is bounded to outstanding local starts and releases external control after they settle.

A completed build passed before the last review fixes (`/tmp/webpod-manager-build.log`); final build/type/lint runs are being refreshed. Browser baseline availability is lead-owned; no claim of Apple/Spotify audible playback from deterministic mocks.

## Final verification checkpoint

- Full impacted suite `/tmp/webpod-manager-verified.log`: 843 passed, 0 failed, 4119 assertions, 41 files.
- After the final same-context pause/read fence adjustment, focused complete management suite `/tmp/webpod-manager-final-focused.log`: 28 passed, 0 failed, 80 assertions; includes the new pause/read regression and actual Apple tests.
- Earlier all-project typecheck: 14/14 clean; latest refresh is `/tmp/webpod-manager-final-types3.log`.
- Explicit changed-file ESLint `/tmp/webpod-manager-final-lint3.log`; includes new package, native adapters/tests and migrated panel/app files. This is not whole-repository lint.
- Final build refresh `/tmp/webpod-manager-final-build3.log`; prior `/tmp/webpod-manager-final-build.log` passed after native station/pause changes.
- Spotify queue fixture now includes episode data; native mapping filters unsupported episode items, retains supported tracks, and does not invent history.

Review-stage tests additionally cover managed logout exact notification, station rejection recovery, immutable progressive target, real Apple delayed station lookup cancellation and late pause completion superseded by resume. Native window/fallback explicitly reports unknown native full total when queueOffset>0; the common manager retains the known submitted total only while its context remains valid.

Second-review additions: `complete queue remove/reorder recovers and new target hides old items while pending` tests ensure all mutation siblings recover authoritative completeness and old queue rows cannot remain actionable during a new handoff. `Apple window append never combines absolute occurrence with native short-window total` proves absolute175/native101 yields unknown occurrence/total after mutation. Spotify native+managed fixture asserts repeat_mode 0→off, 1→all, 2→one against the official SDK mapping.

Latest verification pipeline logs use `/tmp/webpod-manager-review-final{,-lint,-types,-build}.log`. Source is held stable for both independent reviewers.

Final stable result: **847 passed, 0 failed, 4134 assertions across 41 files**; **14/14 project typechecks clean**; explicit changed-file ESLint clean; production build passed; `git diff --check` clean. All four `/tmp/webpod-manager-review-final*.log` commands completed successfully. Manager SHA-256 `80304d9d9db9e0e9b95ab9da16e8a0e7f016fc4571d6d4bffe6f0206f8f2ad97`; Apple adapter `2116604ae6f17c1fc343f9c58c846212bfeda80aa80f582a8e5542f4f3557860`; Spotify adapter `25d05568b5d7cc36ab38f026353cb10d40d67297aa3a223ee10424f1de74dfb7`.

## Lead live smoke and independent approval

Both independent review lanes now formally **APPROVE** the stable implementation fingerprint; see `reviews/shared-management.md` and `reviews/adapter-contracts.md`.

Lead exercised the existing local `http://127.0.0.1:3000/webpod` route with the restored Apple account:112 playlists,271 artists,461 albums,2726 songs. Playing the first five songs from index2 immediately exposed loading/index2/total5 and “A Change is Gonna Come”; later playback reported playing/17000ms/index2/total5. Next advanced to index3/total5 and “A Kingdom from a Spark…”. After pausing, common `musicManager(provider).commitSeek(10000)` resumed playing at10000ms/index3/total5. Playback was paused afterward.

Spotify session restoration returned signed-out with no songs, so live Spotify audio was not verified. Its actual adapter under controlled SDK/API fixtures passed the deterministic contract suite. Apple mode is being restored by the lead; no production deployment or account-content mutation is part of this refactor.

Final checks remain847 passing tests/4134 assertions,14/14 project typechecks,changed-file lint,production build and diff check clean. This closeout changes documentation only; source fingerprints above remain unchanged.
