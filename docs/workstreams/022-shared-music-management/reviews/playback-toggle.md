# Playback toggle regression review

## Verdict: APPROVE

No Critical/Major findings in the narrow fix. Independent tests and static checks pass.

Scope: reported production play/pause JSON parsing failure, starting from `aef80c4`. Attachment inspected with payload fragments redacted. No identities, credentials or response body fragments copied into this artifact.

## Diagnostic findings

The shared manager, production toggle and Panel occurrence identity path do not parse opaque IDs as JSON. Spotify API request handling currently parses every nonempty successful non-204 body with `JSON.parse` (`packages/providers/src/spotify/api.ts:128`). The token route uses `response.json`; SDK internals may also parse their own responses. The log's caught error alone does not establish the exact failing HTTP response.

The official [Spotify start/resume contract](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback) specifies a no-content success. Any tolerant handling of a successful non-JSON acknowledgement should be narrowly scoped to command endpoints whose response is unused. Catalogue/token JSON still needs validation; HTTP errors must still reject. Do not change queue/identity logic to fix a response-decoding fault.

## Required proof

- Actual production toggle → shared manager → real Spotify adapter path accepts the observed successful control acknowledgement shape, retains native confirmation semantics and does not produce a false playback error.
- Empty/204 command success, JSON read success, malformed JSON read failure and non-2xx command failure remain covered.
- No response body fragments escape into console errors; auth/token failure handling remains intact.
- Independent targeted tests and changed-package type/lint checks pass; review final source fingerprint before approval.

## Reviewed fix and proof

Lead's live diagnosis identifies `JSON.parse → api.request → adapter.play`: the play endpoint returned HTTP 200, no Content-Type and a 27-character non-JSON acknowledgement. Only response metadata was supplied; no live body/headers were read or copied by this reviewer.

`api.command` explicitly selects acknowledgement handling after the same authentication, 401 retry and non-2xx checks as JSON requests. Play/resume and sibling playback writes use it. Catalogue/queue reads, token validation and playlist creation retain JSON decoding. No catch-to-null fallback or playback state change was added. Source audit confirms the changed call sites are void playback operations; entity-returning methods retain `api.request`.

The production regression calls `toggleProductionPlayback` through the common manager and actual Spotify adapter with controlled SDK/fetch boundaries. Both opaque 200 and empty 204 start, pause and resume pass, and successful acknowledgement remains loading until native evidence. API tests preserve malformed JSON read/create/token rejection and 403/429/500 command failure. Existing full Spotify native/managed fixture also passes. The opaque acknowledgement is synthetic and does not copy live data.

Independent verification: **24 tests passed, 167 assertions, 3 files** (`/tmp/playback-toggle-review-tests.log`); `bunx tsc --noEmit` for both providers and web passed; ESLint for all four changed code/test files and `git diff --check` passed. Lead owns live post-fix confirmation; deterministic success is not claimed as live audio proof.

Final SHA-256 fingerprints:

- `api.ts`: `80db01a60a4d2b47e6cbd2d5f4f276d87debb003106d2412623e22b6ea0bd430`
- `spotify-provider.ts`: `d4fcf157ea906b56af7726e91d7da39fbcacf4b3160421e1e4ea71f26db2cb3e`
- `api.test.ts`: `cf8fe4877aae4406114a519d2d11724aad83d27d893e59fafddb0cb5b6eb27ab`
- `production-device-view.test.ts`: `4e4231786427ab4b69f572d854b7bb31eebb594f3509267211bb259253a74562`

Review follows existing D1–D8 and narrow regression scope. No source edits, account mutations, credentials, commits or deployments performed by reviewer; no Neuve/Kanban per repo law.

## Apple parity addition — APPROVE

Reviewed the user-requested Apple tests through the same actual `toggleProductionPlayback → manager → createAppleProvider` path. They exercise native Promise<void> start/pause/resume, retained selected index/total and native seconds-to-milliseconds observations, immediate pause during a delayed start, and rejected native resume followed by successful recovery. These assertions observe native calls and shared outcomes; they do not replace the real adapter with a renamed provider mock. The existing MusicKit fixture supplies the native SDK boundary. No Apple or common production source changed.

Independent added-coverage run: **32 passed, 117 assertions across 3 files** (`/tmp/playback-toggle-apple-review.log`), comprising physical controls, Apple managed native contracts and Spotify API response tests. Web typecheck, changed test lint and diff check passed. Reviewed the additional Spotify 401 test: one failed request triggers exactly one token refresh/retry, then accepts opaque success. No new Critical/Major findings.

Updated physical-control test fingerprint: `796098d541c0e22580005c2a340b037346d64a9550d70f4bce947b23a4789dbc`. Both production Spotify source fingerprints above remain unchanged. Lead-reported Spotify SDK loading after accepted HTTP is correctly treated as unconfirmed playback; this review does not request a fabricated playing status. Live Apple account/audio availability remains explicitly separate from deterministic contract coverage.
