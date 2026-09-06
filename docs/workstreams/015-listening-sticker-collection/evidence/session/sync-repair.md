# Sticker import and request cancellation repair

Status: implementation frozen for independent review. No live MusicKit authentication, credentials, private key, existing user database, or owner browser state was inspected. The owner's precise sync outcome remains unconfirmed: the former banner represented both a failed import and the intentional bounded partial sample.

## Confirmed defects and repairs

The importer required every pagination query value to be a short decimal number. Apple's endpoint schema defines `offset` as a string. A synthetic opaque cursor reproduced rejection; regression now follows encoded opaque offsets while retaining a fixed Apple origin, exact library-songs path, bounded cursor/URL lengths, unique allowed query keys, and100-row pages. Credentials are never forwarded to arbitrary URLs. The official example's albums `next` path is inconsistent with its songs endpoint; this implementation deliberately does not follow another resource path.

Imports explicitly request `include=catalog` on each page and accept the documented catalog relationship when library play parameters contain only a library identifier. Catalog metadata supplies genre/duration where available. Uploaded/library-only songs without a verified catalog ID remain ineligible; no IDs or listening minutes are invented. The25-page/2500-row cap remains a bounded starter-taste sample, not a resumable background sync. The independently owned UI distinguishes that partial sample from failure and removes the misleading partial Retry action.

A finite `sticker_import` diagnostic reports only status, reason, pages, received, accepted and skipped counts. Failure reasons distinguish authorization, upstream rate limit, rejected request, timeout, unavailable transport/server, malformed response, invalid pagination, cancellation and unexpected failure. No token, owner/device/catalog ID, cursor, URL, upstream body, exception stack or user metadata is logged by this diagnostic. Import failure retains prior grants and placements. Immediate retries against an active failed inventory now return429 instead of a misleading200 replay; a later retry performs fresh verification/import and recovers without duplicate packs.

## Actual development cancellation reproduction

Launched the shipped app `bun run dev --host 127.0.0.1 --port 43987 --strictPort` on an owned isolated subprocess group with blank Apple signing configuration and a new temporary database. Sent JSON POST headers and only a prefix of the declared1000-byte body to `/api/stickers/session`, then disconnected. Before repair the dev server emitted `error: aborted`, `code: ECONNRESET`, `status:500`, `unhandled:true`; subsequent anonymous GET still returned401. After repair the same experiment produced no unhandled cancellation error and the same healthy401. Only the owned subprocess group and temporary database were removed.

Pinned srvx0.11.22 binds request cancellation to connection close. Start1.169.31 checks `request.signal.throwIfAborted()` after the route handler. Its `requestHandler` passes rejected errors into h3-v2's `toResponse`; h3 logs unknown errors before returning500, so an outer app fetch catch cannot prevent that log. H3's error hook is invoked after the log and Start exposes no pre-conversion hook here.

The Bun patch for `@tanstack/start-server-core@1.169.31` changes source and distributed request-response modules. Before H3 conversion it returns empty499 only when the incoming request is actually aborted AND the rejection is strictly identical to that signal's reason. It retains the original request and signal, adds no listeners, and does not swallow unrelated errors. Explicit regressions verify independent errors during cancellation and different AbortError instances still return/log500. The package/lock changes contain only the pinned patchedDependencies declaration, with no dependency upgrades. Patch bytes participate in source fingerprints and optional historical archive inputs; clean frozen installation applies them.

## References consulted

- Repo AGENTS, session dispatch and dev-runtime incident contracts; global-patterns, effect-services, database-drizzle and tanstack-router skills. No visual changes owned in this lane.
- Local reference library at `/Users/vinicius/code/.better-coding-agents/resources`; installed sources govern version differences.
- [Apple Get All Library Songs](https://developer.apple.com/documentation/applemusicapi/get-all-library-songs), including the public documentation JSON endpoint's string-offset/query schema.
- [Apple LibrarySongs Relationships](https://developer.apple.com/documentation/applemusicapi/librarysongs/relationships-data.dictionary) and its catalog relationship definition.
- Installed `@tanstack/start-plugin-core1.171.39` Vite dev plugin, `@tanstack/start-server-core1.169.31` request-response/createStartHandler, `srvx0.11.22` Node adapter, and `h3 2.0.1-rc.20` response conversion. Installed Effect4 RC remains unchanged.

## Verification

- Before-fix actual app POST disconnect reproduced the reported class of unhandled cancellation500; this experiment does not establish the owner's exact request timing.
- `sync-dev.integration.test.ts`: actual root package dev command, copied source and frozen dependency installation, native HTTP body/cookie transport and temporary SQLite. Only the isolated copy's trusted Start context supplies a synthetic upstream; no production auth flag, alternate server or intercepted sticker API. Tests incomplete body disconnect, admitted Apple import cancellation with upstream abort marker, no session activation, subsequent healthy new-device request and same-device retry after the admission window. Passed1test10assertions as part of42tests252assertions15.83s.
- `request-cancellation.test.ts`: exact request cancellation499; unrelated error during aborted request500; same-name different AbortError500; unconnected AbortError500, with logging assertions.
- Final focused domain/import/session/patch suite:35tests206assertions. Official-shape relationship/opaque cursor fixtures, untrusted next URLs, safe diagnostics, incomplete snapshot preservation, cooldown/retry and placement preservation covered.
- Snapshot regression confirms patch mutation changes runtime source identity; existing snapshot tests pass, including historical extraction.
- Scoped lint and app/server-core typechecks pass. Production rebuild passes; actual built Start/native transport, production server/assets and physical browser pack/place/reload flow pass3tests260assertions5.24s. Independent normal-dev and sync suites pass3tests2014assertions33.44s. Final streamed-body timeout classification regression passes alongside the other importer contract tests (4tests44assertions). Independent production verdict is recorded in reviews/sync-radio-review.md.
