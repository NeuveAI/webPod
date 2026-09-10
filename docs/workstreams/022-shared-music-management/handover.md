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
