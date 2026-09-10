# Apple login diagnosis

Status: final native authentication and connector lane review complete.

Current patch review verdict: **APPROVE**. Historical blockers below are resolved by the final patch and independent verification.

User-reported failure concerns login/library availability, separate from the already-reviewed queue/playback refactor. Narrow authorization recovery is now authorized; no credential/server rewrite is justified by current evidence.

## Confirmed evidence

- Latest attachment reports native Apple library songs/playlists 403 and albums/artists 500, plus local optional sticker import 401. It does not include a sanitized Apple error body identifying the precise rejected credential or reason.
- Compared with production base `36f0b97`, the Apple adapter's configure/authorize/API authorization path is unchanged. Current app controller still calls the native provider's `authorize()` and native SDK `api.music`. The shared facade does not inject HTTP authentication headers.
- Public Apple documentation distinguishes developer-token 401, media-user-token/incorrect authentication 403, and server-processing 500. These statuses must not all become an empty library or an automatic sign-out. [Requests and responses](https://developer.apple.com/documentation/applemusicapi/handling-requests-and-responses)
- MusicKit Web decorates user API calls itself; manual duplication of the Music User Token into a new client HTTP layer is unnecessary. [User authentication](https://developer.apple.com/documentation/applemusicapi/user-authentication-for-musickit)
- Inspected the current publicly served [MusicKit JS v3 source](https://js-cdn.music.apple.com/musickit/v3/musickit.js), saved as public-source-only `/tmp/webpod-public-musickit-review.js`. Its `authorize()` immediately returns cached `storekit.userToken` if `userTokenIsValid`; that getter calls `validateToken`, which checks only nonempty string shape. `isAuthorized` reflects stored authorization state. Therefore calling authorize repeatedly does not prove fresh server acceptance. Its public unauthorize path resets stored authorization after attempting logout. This is observed implementation behavior, not a promise about future SDK versions.

## Working hypothesis and bounded next evidence

A stale or revoked cached user token can explain SDK authorization success followed by rejected library requests and repeated failed sign-in attempts. This is not yet proof of the user's precise failure. Lead is collecting sanitized response status and Apple `errors` code/title/detail, with a catalog-only control to distinguish developer-token validity from personalized access. Do not record header values, tokens, environment contents or signing keys.

The HMR persistence key changed from `musicRuntimeState` to `musicRuntimeController` during the refactor. A module-only hot update can create a new adapter around MusicKit's persistent singleton once; a full reload controls for that migration condition. No evidence currently establishes HMR as the root cause.

## Recovery review requirements

If a library response conclusively indicates invalid user authorization, clear that cached authorization once and expose reconnect through a real user gesture. Do not attempt repeated automatic authorization, assume a 500 means revoked consent, or erase a working session for an optional sticker failure. Preserve genuine library failure state instead of routing into an empty ready experience.

Required tests for any fix: restored nonempty token with rejected personalized API; SDK authorize cache short circuit; one bounded session invalidation; next explicit authorize performs fresh SDK flow; non-auth 500/403 remain ordinary errors; simultaneous initial collection failures do not trigger duplicate resets; successful library startup reaches ready; optional sticker 401 does not gate core library access. Any data extracted from SDK error shapes must be validated and sanitized rather than broad logging or unchecked casts.

No account mutation, real token inspection, or source edit was performed in this diagnostic lane. Queue/playback approval does not imply approval of a future authentication patch or proof of live login success.

## Sanitized live evidence supplied by lead

Personalized library responses include HTTP 403, Apple code 40300, title Forbidden and detail Invalid authentication. Occasional HTTP 500 uses code 50001 with an authentication-processing error. SDK local authorization and token-presence booleans are true, while an SDK catalog-only request succeeds. This supports invalid personalized authorization independently of developer-token catalog access; it does not establish why that user authorization became invalid. The 500 response alone must remain non-terminal.

## Actual SDK thrown error boundary

Further public-source inspection found `fetchMiddlewareFactory` parses the response JSON, then throws `MKError.responseError(response)` for a failed HTTP response. The parsed error JSON is discarded. `responseError` stores the original, already-consumed Response in `error.data`; it maps HTTP 403 to ACCESS_DENIED, 401 to AUTHORIZATION_ERROR and 500 to SERVER_ERROR. Name/reason and an errorCode getter carry this SDK reason, while message/description use status text or the numeric status.

A fixture shaped only as `{ data: { errors: [...] } }` would therefore miss the current real SDK boundary. Re-reading or cloning a consumed Response is not a valid way to retrieve code 40300. A patch must either use a supported structured response seam or narrowly classify the trusted core personalized-library response shape using validated HTTP status/path and SDK reason. Generic ACCESS_DENIED on catalog/licensing/lyrics must not invalidate the user's session. The live error-code evidence is diagnostic evidence, not a field assumed present in SDK exceptions.

## Requested common authentication namespace

The user's subsequent request expands the common library to a distinct authentication namespace. Preserve explicit Apple in-page authorization versus Spotify redirect outcomes, plus account-generation and single-flight recovery. Native adapters own SDK/session mechanics and error normalization; common authentication owns the coordinated public flow. Playback reacts to session changes through its existing lifecycle rather than implementing a second auth state machine. An obsolete failed request must not sign out a newly authorized account, and concurrent first-page failures must not perform repeated resets. Optional sticker authorization remains outside the core library readiness gate.

Lead verified the live thrown SDK shape directly: `data` is a Response with `bodyUsed: true`, HTTP 403 and pathname `/v1/me/library/albums`; `name` and `reason` are ACCESS_DENIED. Decisions D10/D11 accept bounded normalization for this trusted core-library boundary, without assuming access to the discarded JSON. The patch's initial classifier checks native Response identity, exact Apple origin/path, core library endpoint and ACCESS_DENIED/403. Catalog/licensing and 500 are excluded.

## Initial patch findings

- **Critical — late native authorize republishes logged-out session** (`packages/providers/src/apple/apple-provider.ts`, authorize). `authorizationGeneration` was incremented but not captured/rechecked across SDK authorization. Independent `/tmp/webpod-apple-auth-race-review.test.ts` configured the actual adapter, deferred the native authorize promise, completed logout, then resolved the old authorize. The provider session changed from null back to authorized: 0 passed, 1 failed, 2 assertions. The common auth generation cannot undo native publication/binding. Fence success and rejection after every asynchronous authorization boundary; do not clear a newer SDK session while correcting an obsolete completion. Durable native regression required.
- **Critical — account change during initial source load** (`packages/music-management/src/auth.ts`, session listener). Initial patch only invalidated generation in authorized phase. A session change during signing-in/library load could therefore publish an old account's source after the new session appeared. Shared reviewer independently reported this; lead reports an explicit loading flag patch and tests underway. Re-review final implementation before closure.

Initial review observed clear namespace separation and explicit redirect-vs-gesture connector types; neither alone establishes correct lifecycle behavior. No final approval until both races, reset failure/duplicate failure, next gesture, redirect readiness and current live core-library failure are covered by appropriate evidence.

## Rereview checkpoint

The original native post-logout resurrection probe now passes, and the common load/session race is fenced. Native cached-token recovery uses consumed Response fixtures, deduplicates reset and preserves non-auth failures. Independent native/common-auth suite plus the original probe: 115 passed, 351 assertions.

**Critical — obsolete authorization compensation cancels a newer pending login.** The new native authorize catch checks rejectedUserSession/currentSession-null, then increments authorizationGeneration and resets. Reproduce with A pending → logout → B pending → resolve A → resolve B. A's compensation cancels B even though B is the latest explicit login. `/tmp/webpod-apple-auth-newer-pending-review.test.ts` fails because B rejects instead of authorizing. The durable existing test only resolves B before A and therefore misses this ordering. Compensation must distinguish a latest logout from a latest in-flight authorize; it must not mutate that newer attempt's generation/session.

Lead reports successful live local Apple /webpod and real library counts. Exact fresh-popup steps were not witnessed; do not claim they were. Formal verdict remains REQUEST_CHANGES until this final native race is fixed and independently retested.

## Final approval

The final patch records latest native authentication intent independently of generation. Obsolete authorization completion cannot republish a session, invalidate a newer successful session, or reset/cancel a newer pending authorization. Compensation still clears stale SDK authorization when logout/recovery is the latest intent. The durable pending-B regression and both independent race probes now pass.

Independent final command: `bun test packages/providers/src/apple packages/music-management/src/auth.test.ts /tmp/webpod-apple-auth-race-review.test.ts /tmp/webpod-apple-auth-newer-pending-review.test.ts` — **117 passed, 0 failed, 355 assertions across six files** (`/tmp/webpod-auth-final-stable-review.log`). Providers and music-management typechecks, explicit scoped ESLint over native auth source/tests, connector and common auth source/tests, and diff check pass.

Inspected tests prove the current consumed-Response boundary, cached authorization short circuit followed by fresh native authorization after reset, parallel reset deduplication, failed reset blocking cached reuse, non-auth/catalog preservation, late library failure isolation, logout/authorize races, common initial-load session fencing, explicit Spotify redirect/no invented session, callback restoration, Apple gesture delegation and disposal. Claims remain bounded: deterministic gesture delegation does not prove a browser popup was manually completed. Lead reports real authorized local player/library access; exact fresh-popup interaction was not witnessed.

Approved SHA-256: Apple adapter `b453e9e6f397e2ef23071dcf8ee5174a05cb7e7cc592ef91bc938ecf900cee87`; Apple auth tests `2154f232326b06c0099c53aab4d612d2ec6c537be6128575f0bd1cb1a47f284d`; connector `c48a0838e3b952a3d8cd37544936f0777881ed15b8c43042bef22c324848bfb5`; common auth `907b0de77b234294ba4fbed9c6d5c2c986972d95764c2cc0cab79ad48a0b16cd`.

No unresolved Critical/Major finding remains in this native/auth connector lane. Common app composition/route and whole-build approval remain the other review lane/lead's responsibility. No production deployment or credential change was performed by this reviewer.
