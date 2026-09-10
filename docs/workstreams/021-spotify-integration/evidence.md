# Verification and handover

Branch: `codex/spotify-integration`. Changes are uncommitted and have not been deployed.

## Completed
- Landing has the `or use Spotify` text link alongside Connect Apple Music. Verified in the existing Chrome local-dev tab and visually at 1456 × 893.
- Spotify dashboard now contains `http://127.0.0.1:3000/api/spotify/callback` and `https://webpod.vercel.app/api/spotify/callback`, preserving the original callback.
- Link follows the server PKCE/state authorization flow to the real Spotify consent screen for webPod.
- `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` uploaded as sensitive production environment variables to linked Vercel project `perf-lab/webpod`; names and targets verified. Existing deployments require a future code deployment to use them.
- Local Vite binds to IPv4 loopback so Spotify's required 127.0.0.1 redirect works. `localhost` login redirects to loopback before setting the state cookie.
- Server domain service handles OAuth, AES-GCM encrypted HttpOnly session cookies, refresh, same-origin POST token access, logout and sanitized failure responses. No refresh token reaches browser JavaScript.
- Spotify provider supports library/navigation, current playlist item APIs, library saves, search, Connect playback, transport, queue and subscriptions. SDK loads only for an authorized Spotify session. Unsupported capabilities keep their existing matrix behavior.
- SDK artist URI mapping and positional playlist deletion preserve entity identity and original playlist positions. Playlist deletion checks snapshots before writing.

## Checks
- `bun run typecheck`: 13/13 projects clean.
- Changed-file ESLint: passed (app/runtime/routes/config, Spotify provider/API/tests, stub tests, server OAuth/tests).
- `bun test packages/providers packages/server-core/src/spotify.test.ts apps/web/src/music-runtime.test.ts apps/web/src/browser-welcome-policy.test.ts`: 436 passed, 0 failed, 1933 assertions.
- New request-boundary integration coverage: state mismatch, PKCE verifier, encrypted credential cookies, access-token refresh, no-store, cross-site rejection, tampering and logout. Uses fake credentials.
- New provider integration coverage: current REST playlist shape, SDK artist shape, stable keys, browser-device targeting, invalid cursor and disconnect on logout. Uses fake network/SDK.
- `bun run build`: passed. Existing large-chunk advisory remains.
- Browser bundle check: no Spotify secret value or SPOTIFY_CLIENT_SECRET variable in any of 11 generated JS/map/HTML artifacts.
- Repository-wide `bun run lint`: fails on 309 errors in pre-existing historical workstream evidence scripts. Those unrelated workstreams were not modified.

## Live verification completed
User approved Spotify consent. The old authorization page had expired; a fresh sign-in completed successfully without changing scopes. Real library loaded: 140 playlists, 62 artists, 71 albums, 660 songs. Session restored after a full reload without another consent prompt.

Played Teeth by 5 Seconds of Summer; SDK reported playing with artwork and metadata. Found a progress regression: the panel rereads provider.playback on progress notifications, but Spotify's getter returned the fixed SDK anchor. Fixed the getter to project current elapsed time without mutating the anchor. Browser evidence showed 0:05 then 0:10 with visible bar movement, pause holding 0:15, seek reaching 0:25, resume advancing to 0:34, and next transitioning to RATA-TATA by Royal Republic. Final player left paused at 0:15 on RATA-TATA.

Regression coverage now checks advancing playback snapshots, duration clamping and frozen paused position. Final checks: 436 tests pass (1937 assertions), 13/13 typecheck projects, changed Spotify-file lint, production build. No claim of independent audio capture; browser SDK and real transport/time UI were observed directly.

## Decisions
- Current Spotify API docs override historical stub endpoint descriptions; playlist writes use /items and library writes use /me/library.
- Canonical Playback SDK types plus validated minimal REST schemas avoid relying on obsolete SDK REST fields.
- Keep Apple authorization behavior and sticker import paths; Spotify does not invoke Apple sticker import.
- No merge, commit, force-push, or production code deployment performed. Suggested commits: server Spotify OAuth; Spotify provider/runtime and regression coverage; alternate sign-in UI and operational evidence.

## Paused scrub confirmation follow-up
User reported that selecting a scrub position while paused did not resume. Reproduced in the shared Panel integration test: the commit handler only called seek. Updated shared handler to serialize seek followed by play when playback was paused at commit. Previewing remains paused. Queue selection already invokes play(target); regression coverage now explicitly starts that selection paused.

Verification: mounted test failed with expected playing/received paused before the change; 25 panel/model tests (176 assertions) pass after it. Changed-file ESLint and all 13 typecheck projects pass; build passes. In live Spotify, paused Teeth at 0:13, previewed 0:18, confirmed and observed playing; returning to standard view showed playback continuing at 1:05. Shared behavior applies to Apple through the same MusicProvider contract; live Apple playback was not separately exercised.

## Artist albums and playlist loading follow-up
Artist albums requested limit=50, exceeding the current Spotify endpoint maximum of 10. Changed to limit=10 and retained full pagination. Official reference: https://developer.spotify.com/documentation/web-api/reference/get-an-artists-albums . The supplied stack trace confirms HTTP 400 but contains no response body.

Live navigation then exposed a second issue: artist catalogue albums were absent from the runtime album lookup unless saved in the library. The progressive source now remembers discovered albums so their tracks can be opened. Regression coverage exercises an unsaved artist album and its tracks, plus two artist-album API pages.

Spotify observations now preserve selected track identity through explicit linked_from IDs and preserve queue occurrence indices for repeated tracks. A non-overlapping SDK getCurrentState read every two seconds while progress is subscribed recovers missed SDK events; revision checks discard reads superseded by a newer event or play request. Tests cover relinked duplicate selection and recovery when the state event is absent. These cover identified failure paths; the exact intermittent user failure was not captured before the fix.

Live Chrome after full reload: citron love albums loaded, magenta opened to its track list; Signalnoise: Playlist II played Kingdom with standard progress at 0:12, then King of the Streets at 0:09 and playing state. Neither remained in loading.

Verification: 425 tests pass, 0 fail, 1915 assertions (provider sources, runtime and OAuth suites); all 13 typecheck projects pass; changed Spotify/runtime ESLint passes; production build passes with the existing large-chunk advisory. Changes remain local and uncommitted.

## Progressive artist catalogue follow-up
Both Spotify and Apple previously drained every relationship page before resolving the artist album list. Added an optional cumulative onPage callback and pagination cancellation signal to relatedAlbums. Spotify requests ten at a time and follows each next cursor; Apple follows MusicKit continuation pages. Each response publishes an immutable album snapshot through the existing source revision subscription, so artist frames and their stored album collection refresh while preserving highlight and scroll position. The next request starts automatically without waiting for user input. Already-loaded albums can be opened while remaining pages load. Later-page failures keep those albums and display Menu/retry guidance; aborted or retired sources reject late updates.

Checks: 100 tests passed across runtime, navigation, Apple and Spotify provider suites, followed by 10/10 runtime tests after adding the later-page failure/retry case. 13/13 typecheck projects clean; changed-file ESLint and production build passed; git diff --check clean. Provider integration checks assert per-page snapshots for both services; the shared runtime/navigation check holds the second page pending and verifies the first page is visible before completion and selection is retained after append. Browser state was inspected without interrupting the user's active playback; no new live Apple account test was performed.

## Skip / stale Now Playing follow-up
A successful production skip now explicitly follows provider playback: it retires the previous selection attempt and clears the prior scrub/queue mode. A scrub control also tracks playback occurrence identity, discarding its preview when the provider changes tracks. Spotify reconciles its SDK snapshot immediately after next/previous commands, in addition to periodic recovery; pre-command asynchronous observations are invalidated.

Mounted regression covers a skip superseding an unconfirmed selection and scrub preview, verifying the new title, standard mode and current position. Spotify integration covers nextTrack completing without a state event and immediate metadata reconciliation. 17 mounted Panel tests pass (147 assertions); 13 provider/production transport tests pass (73 assertions). All 13 typecheck projects, changed-file ESLint and production build pass. Browser inspection showed live metadata transitioning between Motley Crue tracks, but no claim of a controlled post-fix physical-button replay is made. Changes remain local.

## Playback counter follow-up
Spotify's rolling queue endpoint omits history, so flattening it put every current track at position 1. Added optional queueTotal to the shared playback snapshot. Spotify publishes the known submitted-context total alongside its observed occurrence index; unknown, shuffled or subsequently extended contexts explicitly decline an exact count. Apple continues to derive its count from its full MusicKit queue.

The counter now has independent Jotai subscriptions for total and current position. Its memoized shell and static separator remain mounted across skips; only the current-position child subscribes to index changes. Existing queue contents are retained during background queue reads instead of emptying the counter. Mounted coverage verifies 1/3, 2/3, 3/3, 2/3 and preserves the exact wrapper, total text node and separator nodes. Spotify coverage verifies forward/backward indices with a fixed total and relinked duplicate totals.

Checks: 18 mounted Panel tests (161 assertions), 35 static Panel tests (183 assertions), Spotify integration (30 assertions) passed. 13/13 typecheck projects, changed-file ESLint and production build passed. Changes are local and uncommitted.

## Immediate selected-list counter
The counter now reads the accepted Now Playing frame's exact track list and selected index while its playback attempt applies. This immediately displays the selected occurrence and full list total even while the provider still reports the previous queue or an unknown position. Once the attempt settles, the observed provider position becomes authoritative. The independent current/total subscriptions and stable nodes remain intact.

Mounted coverage exercises album tracks, playlist tracks, Songs, genre tracks and search results: selecting index 2 from three tracks displays 3 of 3 before the deferred transport responds, stays 3 of 3 through loading and confirmation, and follows a later observed position to 2 of 3. Duplicate-occurrence coverage now expects the selected counter during loading while retaining the strict playback-confirmation checks. 23 mounted tests pass (196 assertions); all 13 typecheck projects, changed-file ESLint and production build pass.

## Spotify mosaic artwork 403 follow-up
The supplied console log contained two /artwork 403 responses for mosaic.scdn.co playlist covers, alongside React DevTools, Three.Clock and Spotify DRM robustness warnings. Added the exact HTTPS mosaic host with a numeric size and one to four 40-character hexadecimal image IDs to the existing artwork source validation. Credentials, custom ports, redirects and unrelated-host restrictions remain enforced.

Both exact failing URLs now return HTTP 200 image/jpeg through the live local artwork route (26160 and 12940 bytes). Artwork proxy tests: 67 pass, 211 assertions, including allowed mosaic images and rejected malformed/host-spoofed/insecure sources. Changed-file lint and server-core typecheck pass.

## Rectangular artist artwork 502 follow-up
The supplied i.scdn.co image returned 502 upstream_content_invalid because the proxy required square images. Direct JPEG metadata showed a valid 268 x 320 artist portrait for px=320. Spotify image validation now accepts a rectangular image whose longest dimension exactly matches px; content decoding/type checks and byte bounds remain unchanged, and Apple/fixture square validation remains strict. The exact failed local URL now returns 200 image/jpeg (45265 bytes). 69 artwork proxy tests pass (213 assertions), including both portrait and landscape shapes; changed-file lint and server-core typecheck pass.

## Immediate artwork prefetch and album metadata
Artwork prefetch now begins immediately on the highlighted row, independently of the sustained-selection timer used for transport preparation. Pointer hover over any canonical list row also prefetches its artwork and relationship data. Both use the existing bounded deduplicated artwork/relationship caches, and artwork resolves at the same 176px request used by Now Playing. This shared path applies across providers and list kinds.

Spotify's album-track endpoint omits the album object; its normalized tracks now inherit the known parent album title and cover before playback. This fixes the Unknown album/empty cover placeholder during startup and gives the track highlight prefetch a real image URL.

24 mounted Panel tests (199 assertions) pass, including immediate highlighted and hovered artwork requests; Spotify integration passes (32 assertions), including album metadata inheritance. Changed-file lint and 13/13 typecheck projects pass.

## Empty artwork crash follow-up
The supplied log showed InvalidArtworkError during immediate prefetch, followed by the React route boundary remount and WebGL context loss. Spotify normalization now returns absent artwork for empty or unusable image lists. Panel artwork resolution catches only InvalidArtworkError and uses its existing missing-artwork placeholder for display and prefetch, including already-cached malformed refs.

25 mounted tests pass (201 assertions), including highlight, hover and Now Playing with empty fixed artwork. Spotify integration passes (33 assertions), including absent artwork for an empty album images array. All 13 typecheck projects, changed-file lint and production build pass. Local development tab was explicitly selected and reloaded after the fix.

## Unnamed playlist and fixed artwork follow-up
Live library inspection identified the screenshot's blank row as a Spotify playlist with an empty name, between My playlist #101 and Heavy as fak. Spotify denies its items request with 403; that response does not establish whether the playlist is deleted or access-restricted. Spotify normalization now labels empty or whitespace-only names Untitled playlist without changing access or removing the entry.

The latest supplied log also contained artwork failures for the exact image-cdn-ak.spotifycdn.com and image-cdn-fa.spotifycdn.com hosts. Added their /image/ paths to the source allowlist. Fixed Spotify image URLs do not resize to the requested render hint, and their declared dimensions may be absent; validation now checks decoded positive dimensions against the existing 3000px ceiling instead of requiring an exact hint match. Apple and mosaic sizing remains strict, as do image format, byte, host, port, credential and redirect restrictions.

All seven distinct artwork URLs in the supplied log returned HTTP 200 through the local proxy after the change. 75 targeted tests pass (267 assertions), including the unnamed playlist fallback, exact CDN hosts, spoofed hosts, fixed native sizes and oversized rejection. Changed-file ESLint, all 13 typecheck projects, production build and git diff --check pass. Spotify's playlist-items 403 remains an external access failure. Changes remain local.

## Reject invalid playlist entries
Supersedes the Untitled playlist fallback at the user's request. The Spotify playlist Zod schema now requires a nonempty trimmed name and ID. Library and catalog search lists safe-parse individual entries and omit invalid ones without rejecting valid siblings or losing the server pagination cursor. Playlist creation retains strict parsing. Missing names do not cause the items endpoint's 403: that request uses catalogId, not name; the prior live inspection established the name was already empty upstream.

The existing Spotify integration test now covers blank, whitespace, missing-name, missing-ID and null entries alongside a valid named playlist, continuation to the next page, catalog search filtering and valid playlist track retrieval. It passes with 38 assertions. Changed-file ESLint, all 13 typecheck projects and git diff --check pass. Changes remain local.
