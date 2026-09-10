# Shared management review

## Verdict: APPROVE

All five recorded Major findings and their sibling cases are resolved in the final reviewed patch. No remaining Critical/Major findings in this lane. Earlier findings and failed-probe evidence below are retained as review history; they are not outstanding requests.

Baseline: production `36f0b97`. Reviewed scope and decisions D1–D6 before implementation. Final review will consume the Ready dispatch, subsequent decisions, diary and evidence.

## Acceptance checklist

- One managed instance serves list navigation, clickwheel, keyboard and tools. Cross-entry-point ordering works with no React mounted. Remove independent application command queues and accepted-intent policy from Panel and production-device-view.
- Rapid list selections A→B preserve B through late A events, queue reads, success and rejection. A failed command does not poison the next command.
- Duplicate queue `[A, B, A]` selected at index 2 immediately reports 3 of 3 and does not accept old A/index 0 observations as confirmation. Native skip and natural advance update the occurrence, not merely track identity.
- Rapid double-toggle during delayed start admits play then pause; using observed status alone must not admit two play commands. Skip admitted during loading cannot act on a superseding selection or provider.
- Paused seek-and-resume is a common transaction; UI owns scrub preview only. No dependency on mounted component closures for queue or playback truth.
- Current-position updates preserve the counter shell, total and `of` DOM nodes for unchanged context. Every list selection supplies exact occurrence before transport completion. Unknown remote positions remain unknown when shuffle or append makes them unprovable.
- Dispose, logout, provider switch and same-provider account change during pending commands/reads/timers invalidate late work, prevent new retired transport calls and clear account context.
- Native event recovery keeps metadata, artwork, progress and loading state synchronized. Resolved play promise alone does not prove audible playback.
- Progress ticks do not traverse entire submitted queues; no extra per-render timers or native subscriptions. Shared library/relationship loading preserves progressive browsing and artwork prefetch behavior.
- Final proof includes real adapters under controlled API/SDK fixtures, shared-manager race tests and existing mounted counter/navigation regressions. Run independent scoped tests, all project typechecks and changed-file lint.

## Review setup

Loaded strict-critique, review-protocol, Jotai state and Vercel React performance skill references. Jotai's referenced `~/code/agent-context` is absent; read the existing `/Users/vinicius/code/Neuve/agent-context/jotai-react-query.md` copy. Root cross-workstream `docs/decisions.md` and `docs/platform_decisions.md` are absent. No unrelated workstreams were read. Neuve/Kanban are explicitly inapplicable under repo law and D4. No source edits, credentials, account mutations or deployment actions are part of this lane.

## First-pass findings

- **Major — complete queue evidence cannot recover after mutation** (`packages/music-management/src/manager.ts:87`). `totalFor` returns null while any old context remains invalid, even when Apple/fixture `queueRead` describes a complete queue. Independent real-fixture probe: play 3 tracks and refresh gives total 3; append a fourth yields complete 4-item queue but null total/index. Preserve Spotify's explicit unknown evidence without discarding authoritative full-queue evidence from other adapters. D1/D2, acceptance criteria 3–4.
- **Major — new selection retains previous queue items** (`packages/music-management/src/manager.ts:208`). Selection updates playback/intent but retains the previous queue; confirmation compares against optimistic selected item/index and therefore does not trigger refresh when matching. Independent real-fixture probe: after loading a 4-item queue, playing an unrelated 2-item list exposes total 2 but leaves the previous 4 queue items. Tools can trigger this while NowPlaying remains mounted, so Panel's mount refresh cannot rescue it. D1/D2, criteria 1–4.
- **Major — managed logout swallows session notification** (`packages/music-management/src/manager.ts`, `unauthorize`). Deactivation detaches the adapter session subscription before logout emits, and the facade does not notify its own session subscribers. UI/tool bridges relying on the shared interface remain stale. Preserve session notification while fencing playback. D2, criterion 5.
- **Major — accepted target is not snapshotted consistently** (`packages/music-management/src/manager.ts`, `play`). The manager copies tracks for its context but stores/passes the caller's original target. Progressive library paging mutates source arrays while async activation/readiness waits; the adapter then receives a different queue from the shared counter. Independent deferred-adapter probe starts a 2-track list and appends one during the wait: managed total is 2, adapter sees 3, intent tracks length is 3. Use one immutable target snapshot for context, intent and transport. D1/D2, criteria 1/4/6; reproduction `/tmp/shared-target-probe.ts`.
- **Major — station failure never leaves loading** (`packages/music-management/src/manager.ts`, `stationStart`). The command sets loading and awaits native start without handling rejection. A rejected lookup/start leaves the shared state loading indefinitely. Station supersession also needs the same pause/new-target policy and adapter transaction guards; post-completion checks cannot prevent later native setQueue/play after a delayed lookup. D1/D2/D8, criteria 2–5. Native guard aspect relayed for adapter-lane verification.

## Independent first-pass verification

- Checkpoint SHA-256: tracked diff against `36f0b97` = `249e833911f76917dfa75fa3279981062e21c7d0f67816ac046fdf135babab67`; new manager source = `98630f759b786ec2838eebaf94eff99228325082e5f7a937e19e40e7bc5dba29`. The manager is untracked at this point and therefore has its own fingerprint.

- Shared package, mounted panel/presentation, production controls and runtime tests: **71 passed, 350 assertions**. Log: `/tmp/shared-review-tests.log`.
- All project typechecks: **14/14 clean**. Log: `/tmp/shared-review-types.log`.
- Scoped changed consumer/shared-library ESLint: clean. Log: `/tmp/shared-review-lint.log`.
- Independent complete-queue/new-selection reproduction: `/tmp/shared-manager-probe.ts`. No tracked source modifications.
- Ready dispatch, D1–D8, architecture, API contract research and diary read. Test changes examined: duplicate counter expectation strengthens behavior; SSR setup now explicitly creates managed intent; production rapid-toggle test requires immediate pause and reassertion. No removed assertions were accepted solely on implementer claims.

## Second-pass status

Independent full impacted run: **844 passed, 4,120 assertions across 41 files** (`/tmp/shared-review-final-tests.log`); **14/14 typechecks**, scoped consumer/shared lint and diff whitespace checks clean. Confirmed target snapshot probe now gives managed/adapter/intent length 2. Complete-queue append probe now gives total 4/index 1. Managed logout emits one session notification; station rejection reaches error and real Apple lookup cancellation prevents native queue/play writes.

Two original findings still need their full correction before final approval: complete-snapshot `queueRemove`/`queueReorder` still set only `contextValid=false`, leaving full totals unrecoverable (real fixture probe `/tmp/shared-remove-probe.ts`: 3-track queue → remove index 1 → total null, 2 queue items). New selection now refreshes after confirmation but retains previous queue items with ready status during the pending handoff; reset or replace this stale queue immediately on accepted intent. Final source fingerprint requested after these patches.

## Final resolution and evidence

The second-pass remaining requests are now resolved. Remove/reorder use common context invalidation and recover authoritative complete snapshots. New targets immediately clear previous queue items and mark the queue loading; confirmation refreshes the new native queue. Append remains honestly unknown for Apple's offset window and Spotify's partial queue. Accepted target arrays are snapshotted before native asynchronous work. Managed logout notifies subscribers while retired playback is fenced. Station failure reaches error, and Apple's pending station lookup cannot call native queue/play after cancellation.

Independent final probes report append total 4/index 1, remove total 2/items 2, matching target/intent/adapter list length 2, and no stale selectable queue items during handoff. Final focused suite: **68 passed, 337 assertions** (`/tmp/shared-review-last-tests.log`). Final shared/consumer lint and diff check clean. Earlier independent full impacted suite: 844 passed/4,120 assertions, with 14/14 typechecks. Inspected final implementer pipeline logs: **847 passed, 4,134 assertions, 41 files**, **14/14 typechecks**, changed-file lint and production build passed (`/tmp/webpod-manager-review-final{,-types,-lint,-build}.log`). Tests added after the independent full run were covered by the final focused run or adapter review lane.

Final source SHA-256: manager `80304d9d9db9e0e9b95ab9da16e8a0e7f016fc4571d6d4bffe6f0206f8f2ad97`; manager tests `2896a6ab8eef9b399410defed1addd3af9aeb996a0da3a7036e8861079731b99`; Apple managed contract tests `baae065c2729068bebed1539c33cffb798fa4c3a81b41d5db55f205a74c1f161`; tracked binary diff from `36f0b97` at final code review `4309c0003db9830b25778a812b336369ed65d262ee41013c960221c1c0c90a85`. Review/documentation edits may change whole-tree fingerprints without changing source.

Scope/decision compliance: D1–D8 verified; duplicate Panel/device command queues removed, common manager owns intent/queue truth and lifecycle, production composition passes one facade to UI/control/tool paths. Counter leaves remain granular and mounted regressions pass. Native event ambiguity remains explicitly bounded by D8; arbitrary untagged external events are not falsely attributed. No new auth/capability/deployment scope or unjustified production type escapes found. Architecture, diary, evidence and handover read. API-specific review remains the separate adapter lane's responsibility. This approval establishes deterministic behavior/refactor correctness; live DRM/audio verification is not claimed by this reviewer and remains a lead smoke-test evidence boundary.
