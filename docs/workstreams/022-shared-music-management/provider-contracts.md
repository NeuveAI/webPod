# Provider contracts and regression matrix

Inspected 2026-09-10. This is research for the shared music manager refactor, not approval of an implementation. API facts, current implementation choices, and proposed shared policy are distinguished below.

## Evidence and source limitations

The required `/Users/vinicius/code/.better-coding-agents/resources/` directory is absent. Inspected installed Spotify types at `/Users/vinicius/code/webPod/node_modules/.bun/@types+spotify-web-playback-sdk@0.1.19/node_modules/@types/spotify-web-playback-sdk/index.d.ts` and its package metadata. These are community types, not the normative API specification. No installed MusicKit types were found. The local `MusicKitInstanceLike`, `MusicKitQueueLike`, and `MusicKitGlobalLike` interfaces in `/Users/vinicius/code/webPod/packages/providers/src/apple/apple-provider.ts` are application-owned test seams, not independent proof of Apple behavior.

Apple's current v3 instance documentation is a JavaScript-rendered page: the web opener exposed only the shell, but the official site's indexed text exposed the method contracts cited below. Native Swift MusicKit results were deliberately excluded; they do not establish MusicKit JS contracts.

## API facts that constrain the boundary

| Surface | Verified provider facts | Consequence for tests |
| --- | --- | --- |
| Spotify observations | `getCurrentState()` may return null; state events occur at irregular intervals. SDK queue windows vary in length. Millisecond seek; volume 0–1. Repeat 0=off, 1=context, 2=track. Ready/not-ready, autoplay, authentication, account, initialization and playback errors are distinct signals. [SDK reference](https://developer.spotify.com/documentation/web-playback-sdk/reference) | Test null, delayed observations, short windows, conversions and all repeat values. Do not infer an absolute index or total from window length. Installed type comments describe repeat ambiguously; follow the official mapping. |
| Spotify play command | The start endpoint targets a device; offset positions are zero-based. It warns that ordering with other Player endpoints is not guaranteed. [Start playback](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback) | Assert browser device targeting and command payloads. An accepted HTTP request is not proof that the requested track is now audibly playing. Exercise delayed/superseded observations. |
| Spotify queue | GET queue returns current item and upcoming tracks/episodes, with no full-context count or absolute position in that response. POST queue takes one URI. [Read queue](https://developer.spotify.com/documentation/web-api/reference/get-queue), [append](https://developer.spotify.com/documentation/web-api/reference/add-to-queue) | Preserve ordered appends and partial failure. Do not fabricate full history/count or unsupported insertion/reordering. Explicitly handle unsupported media types at the adapter boundary. |
| Spotify identity | Relinking can replace the requested track with a playable market equivalent; `linked_from` identifies the original when supplied. [Relinking](https://developer.spotify.com/documentation/web-api/concepts/track-relinking) | Match explicit original/replacement IDs. Missing relink evidence must not trigger title/artist matching. Equal track IDs can still be different queue occurrences. |
| Spotify paging | Artist albums currently allow at most 10 per request; playlist items allow 50. Both expose nullable `next`; playlist results require checking item type. [Artist albums](https://developer.spotify.com/documentation/web-api/reference/get-an-artists-albums), [playlist items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items) | Preserve existing 10/50 request sizes, continuation traversal, malformed-row filtering without dropping continuation, and cumulative artist pages. |
| MusicKit JS commands | `seekToTime` takes seconds. `setQueue` resolves to Queue or void when playback is unsupported. `skipToNextItem` and `skipToPreviousItem` start playback. [MusicKit JS v3 instance](https://js-cdn.music.apple.com/musickit/v3/docs/iframe.html?path=/story/reference-javascript-musickit-instance--page) | Test ms→seconds, void queue result, rejected queue setup, and paused-skip policy. Do not assume skip preserves pause without the adapter's existing correction. |
| Apple paging | Responses and relationships can contain `next` subpaths; callers must follow them to retrieve remaining items. [Paging](https://developer.apple.com/documentation/applemusicapi/fetching-resources-by-page), [relationships](https://developer.apple.com/documentation/applemusicapi/handling-resource-representation-and-relationships) | Preserve resource and relationship pagination, library/catalog identity distinction, cancellation and partial pages. |
| Apple library authorization | Library albums require a music user token; documented responses distinguish authentication failures from success. [Library albums](https://developer.apple.com/documentation/applemusicapi/get-all-library-albums) | Keep authorization and token handling inside existing adapter/server seams. A failed list request is not an empty successful library. |

## Shared ownership recommendation

The common manager should own application intent and the single state consumed by UI/tools: selected list and selected occurrence, pending command identity, stale-result rejection across commands/provider sessions, queue-counter reconciliation, selected metadata while loading, progress presentation, and consistent transport policy. Both UI and WebMCP must call this manager. A second queue counter in Panel or each provider would fail the objective.

Adapters should retain proven service mechanics: token/SDK lifecycle, wire validation and mapping, URI/catalog/library identities, SDK event normalization, safe local polling, provider queue construction/window offsets, native command translation and availability. Do not rewrite Apple's delicate queue readiness/preparation machinery merely to make its source resemble Spotify. Pass normalized observations and their known/unknown index/count evidence into common reconciliation.

There are two different things to preserve: the selected application list is authoritative for an immediate selection counter, while the remote player is authoritative for what is actually playing. An optimistic selected occurrence must never be mislabeled confirmed playback. A later contradictory external observation must invalidate or replace the selection context, rather than forcing a false index. Unknown must remain expressible.

The current Apple adapter chooses a 100-item submitted window around the selected track (`queuePlan`) and has selected-track fallback when mixed library queue setup fails. This inspection did not establish 100 as an Apple API maximum. Keep it as an existing adapter behavior with regression tests, not a new shared limit. The shared manager needs to handle an absolute selected occurrence plus provider-window offset; it must not combine an absolute index with an unrelated short queue total.

## Required regression matrix

These rows are proposed product-contract tests, not additional claims about vendor guarantees. Run the shared scenarios through both real adapters with controlled SDK/API seams as well as deterministic manager-only races.

| Case | Shared assertion | Adapter fixture/evidence |
| --- | --- | --- |
| Select first, middle, last track | Immediate correct occurrence and total, selected metadata/artwork, no `--` flash; loading is distinct from confirmed playback | Album, playlist, Songs, genre and search list targets; exact translated start index |
| Repeated tracks | Selecting the second A in A/B/A and advancing A/A preserves occurrence; ambiguous external A does not guess | Spotify UID/window and explicit relink; Apple queue position and window offset |
| Skip and natural advance | Current item, progress and current counter change coherently; total and “of” stay stable for unchanged context | Delayed Spotify state event/poll; MusicKit item/state/queue events in different orders |
| Play A then B | Late A completion/error/read cannot replace B; rejected B reaches a settled state | Deferred command promises plus delayed observations |
| Pause or sign out during loading | Obsolete completion cannot resume or repopulate cleared state | Existing Apple pause cancellation and late Spotify callback/poll |
| Progress and seek | Clock advances only playing, clamps to duration; seek resets baseline; selected scrub while paused resumes per current product behavior | Spotify milliseconds; Apple seconds and non-finite durations; seek rejection |
| Previous behavior | Preserve the existing restart threshold and near-start previous behavior consistently | Avoid applying restart policy twice when adapter already applies it |
| Queue refresh | Older read cannot overwrite newer context; unknown count is not zero or window size; append invalidates stale complete-context assumptions | Spotify rolling window/append; Apple submitted window/fallback |
| Shuffle/repeat | Correct mapping, no invented ordered occurrence under shuffle; repeat-one does not increment occurrence | Spotify 0/1/2 and REST mode payloads; Apple SDK enum mapping |
| Preparation | Hover preparation cannot replace active/paused playback; cancelled prefetch cannot overwrite newer selection | Retain Apple's preparation generation and Spotify no-op semantics |
| Lifecycle | Exactly one active subscription/timer; unsubscribe/provider switch disposes and fences callbacks | Configure twice, sign out, reconnect, callback after teardown |
| Library parity | Artists→albums→tracks; progressive pages retain selection; artwork and invalid-playlist regressions remain covered | Current schemas, album-track parent metadata, per-provider pagination |

Preserve existing suites in `packages/providers/src/apple/apple-provider.test.ts`, `packages/providers/src/apple/relationships.test.ts`, `packages/providers/src/spotify/spotify-provider.test.ts`, and `packages/panel/src/playback-presentation.test.ts`. The current Spotify test file concentrates much coverage in one broad fake-player integration test; isolated negative and race cases are useful additions, but never replace existing regressions with tests that only mirror the new manager implementation.

Release claims must distinguish deterministic adapter conformance from actual DRM/audio playback. Passing mocks alone does not prove production playback, and no live account mutation or deployment was performed in this research.
