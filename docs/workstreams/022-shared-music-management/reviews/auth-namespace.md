# Auth namespace review

## Verdict: APPROVE

No remaining Critical/Major findings in the namespace, lifecycle and consumer-composition lane. All three checkpoint findings below are resolved; they remain recorded as review history.

Read Ready auth follow-up, architecture addendum and D10/D11, which supersede the earlier auth exclusion only within the authorized boundary. Existing D1–D9 playback/login behavior remains required.

## Acceptance checks

- `/auth` owns common attempt/readiness/cancellation lifecycle; adapters remain the only native session source. No duplicate copied session truth, provider-specific auth branches in UI, or hidden auth policy left in playback.
- `/playback` resolves the existing sole manager/store. Root compatibility imports and new subpath imports share instance identity; source migration must not accidentally create independent managers or subscriptions.
- Required initial library success remains distinct from SDK authorization and optional background/sticker completion. Exact ready result cannot be borrowed by a stale attempt or enter after exit-animation invalidation.
- Apple native authorize and Spotify redirect/restore remain distinct. Redirect initiation is never readiness; recovery requires a fresh user gesture, without automatic authorization loops.
- Provider/account/session changes, sign-out and disposal retire old playback, auth completions and library publications. Same-provider reauthorization is included, not only switching provider IDs.
- Parallel personalized-library authorization failures invalidate once per generation; old rejection cannot clear a newer session, and failed reset cannot admit a cached revoked session.
- Native error classification is evidence-based and reviewed separately by adapter lane: consumed Response plus ACCESS_DENIED/core personalized endpoint, excluding catalog/licensing/developer-token/generic 500. Namespace integration must exercise actual recovery rather than merely test a classifier helper.
- Existing physical play/pause, queue/counter, immediate selection, welcome failure/retry, empty library, optional sticker and animated-entry regressions remain green.

Final review will trace actual consumer imports and lifecycle ownership, independently run focused tests/typechecks/lint, inspect evidence and record source fingerprints. No source edits, credentials, server header/OAuth expansion, commits or deployment by reviewer.

## Moving-source checkpoint findings

No final verdict yet; implementation tests are still being added. Relayed these concrete lifecycle gaps to lead:

- Session changes during initial-data loading only retire playback; generation/state is invalidated only when phase is already authorized. An old-account load can publish ready against a new authorized session, or a null session can leave the controller signing-in indefinitely. Expected native session establishment must be distinguished from a subsequent change during required loading.
- Logout calls the same `begin` hook as login; app composition deactivates then immediately activates the same playback manager before awaiting raw native logout. This reopens commands/observations during logout. Logout must retain the retired playback boundary throughout pending native logout.
- `dispose` leaves the identical authorized snapshot visible and emits no state change. Previously accepted welcome-entry identity/readiness remains true after disposal. Publish a terminal nonready snapshot so disposal also invalidates consumer entry eligibility.

Required tests: delayed first-page load with same-provider account switch/null session, pending logout rejecting playback work, and accepted welcome-entry disposal during asynchronous exit. Native session source must remain the adapter.

## Final resolution and verification

`/auth` now owns the sole Jotai attempt/readiness state. App composition maps snapshots and owns optional stickers/storage/browser routing, without its own attempt generation. Native session truth is still read from adapter; auth retains only a comparison reference to detect change. `/playback` re-exports the existing manager implementation and creates no second store. Actual Panel/navigation/physical controls use the playback namespace; root compatibility paths resolve the identical manager.

Session change during required loading now increments generation and publishes a nonready state, preventing stale-account data and indefinite signing-in. Logout calls retirement without the login activation hook; pending logout cannot accept playback commands or repopulate progress. Dispose publishes a fresh signed-out snapshot and notifies subscribers, invalidating an accepted entry snapshot. Gesture versus redirect connectors are explicit; redirect authorization returns a URL and never marks ready or loads data.

Independent tests: **100 passed, 489 assertions across 7 files** (`/tmp/auth-namespace-review-tests.log`), including auth namespace, existing queue/playback, welcome-entry and mounted/production controls. **14/14 workspace typechecks** passed (`/tmp/auth-namespace-review-types.log`); scoped changed auth/consumer ESLint and `git diff --check` passed.

Independent real-Apple controller probe `/tmp/auth-namespace-probe.ts` verifies failed native logout leaves the native session authorized but the common phase error/playback retired; a new pause call rejects. It also verifies root and playback imports return the exact same manager. This matches the stated failed-logout policy: do not falsely clear native session truth, but keep controls retired until retry. Existing empty-library/optional-sticker and login failure regressions remain green. Source inspection confirms actual welcome consumers retain the tested exact-snapshot coordinator and readiness gate.

Reviewed source SHA-256:

- Common auth: `907b0de77b234294ba4fbed9c6d5c2c986972d95764c2cc0cab79ad48a0b16cd`
- Playback namespace: `d3392424bc58d2effc04367bbf94c78014bcb6083a548f21e4a2b69b4db6181e`
- Provider auth connectors: `c48a0838e3b952a3d8cd37544936f0777881ed15b8c43042bef22c324848bfb5`
- App composition: `6e9aedf9dbddf5e7578c7aca87088a13e4a2deef194b8b141b19c9f49fa1e75c`
- Welcome consumer: `2e687917efb7649cb0ce5c116531f7f6a2e829cde7f9a44f547304846b34c560`

D10/D11 boundaries respected; native recovery classifier and cached-credential mechanics are the independent adapter lane's responsibility. No header/server credential or OAuth scope rewrite is claimed. Lead reports an authorized populated live Apple player after the change, but the externally changed browser state does not establish the exact fresh-authorization sequence; this review claims deterministic lifecycle coverage only.

Final delta reaffirmed: a null session during initial-data loading remains an error, while external logout after readiness settles signed-out. Both paths still increment generation, clear source and retire playback. This restores the proper logout phase without weakening the loading/session fence. Final common-auth fingerprint is `42ab4d1b9b0335b17838ce2c0a61c620300082ddda219c33ec28a4c1d068bcf7`, superseding the earlier fingerprint above. Independent final auth/welcome rerun: **17 passed, 72 assertions** (`/tmp/auth-final-delta-review.log`). APPROVE remains in force. Lead's final broad pipeline reports 889 passed/4,294 assertions/45 files, with all 14 typechecks, scoped lint and build passed.
