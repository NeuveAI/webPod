# Playback verification

Before fix, a read-only Bun stdin reproduction using the real Apple provider and fake MusicKit emitted:

```json
{"native":"playing","nativeMs":4000,"managed":"loading","managedMs":4000,"intent":null}
```

Event sequence: configure provider; set valid song, time zero, native loading and emit playbackStateDidChange; construct manager; set native playing/time four seconds; emit playbackTimeDidChange only. This is now covered in playback-recovery.test.ts with managedPlaybackPresentation asserting ready/playing/4000.

Checks:

- `bun test packages/music-management/src/manager.test.ts packages/music-management/src/playback-recovery.test.ts`: 34 tests pass after correcting test fixture metadata and awaiting the intentional initial queue refresh before counting clock-only notifications.
- `bunx tsc --noEmit -p packages/music-management/tsconfig.json`: pass.
- `bunx eslint packages/music-management/src/manager.ts packages/music-management/src/manager.test.ts packages/music-management/src/playback-recovery.test.ts`: pass.
- Broader `bun test packages/music-management packages/providers/src/apple/apple-provider.test.ts packages/providers/src/spotify/spotify-provider.test.ts packages/panel/src/playback-presentation.test.ts`: 124 pass; one concurrent paging test fails (`bounded Apple relationship pages preserve library scope, limit and continuation ownership`, Apple continuation validation). All playback tests passed. Lead notified; paging is separate implementer ownership. Output saved temporarily at /tmp/webpod-playback-tests.log.

No production-provider session or audible playback was exercised. Tests prove the described observation/recovery paths, not a unique live-session root cause for every 0:00 report.

After the lead-authorized progressive-playback integration: `bun test packages/music-management/src/manager.test.ts packages/music-management/src/playback-recovery.test.ts` passes 42 tests / 111 assertions. Package typecheck and isolated ESLint pass. Tests now also verify synchronous play invocation before the full-list promise resolves, native playing at position zero remaining pending until progress, suffix order, no append after newer play/pause/queue mutation/deactivation, source mismatch rejection, later load failure preserving playback, and supersession during an in-flight append preventing all remaining requests.

Latest broader rerun after paging implementer fixes: `bun test packages/music-management packages/providers/src/apple/apple-provider.test.ts packages/providers/src/spotify/spotify-provider.test.ts packages/panel/src/playback-presentation.test.ts` passes all 138 tests / 539 assertions. The earlier concurrent paging failure is resolved.

Reviewer-requested append scheduling fix: 43 focused tests / 112 assertions pass; package tsc and isolated ESLint pass. Added held append → foreground seek → second append ordering regression. Broader final integration is performed by lead/reviewer after this fix.
