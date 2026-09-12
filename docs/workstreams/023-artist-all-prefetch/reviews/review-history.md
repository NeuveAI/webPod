# Review: 023 — Artist All and navigation prefetch

Status: Pending implementation review. No final verdict is assigned to unfinished work.

## Review setup

Loaded scope.md and dispatch.md (D1–D5); strict-critique, team-orchestration and review protocol; global-patterns, jotai-state, interface-craft/design critique, web-design-guidelines, and vercel-react-best-practices. Fetched current Vercel interface guidelines. Repository-wide docs/decisions.md and docs/platform_decisions.md were not present in file inventory. Other workstream contents were not read. The nested ~/code/agent-context/{global,jotai-react-query}.md references are missing; source inspection and installed package contracts provide the fallback. Reference checkout root is missing per scoped research; installed Jotai is available under packages/state/node_modules/jotai and packages/panel/node_modules/jotai.

Neuve and Kanban are unavailable by explicit repository law; neither is a review requirement here. No cert or design.pen access, mutations to implementation, or commits.

## Adversarial checks queued

- Artist All has leading row; album order and intra-album track order remain correct. Samples from five albums do not masquerade as a contiguous prefix. Correct indexes across preview, selection, artwork, queue, error rows, back navigation, and WebMCP.
- Five tracks from first five displayed albums; first 15 ordered destination entries; conditional direct endpoint 30 only if complete artist songs semantics exist. Provider research reports neither supported provider has such endpoint; top tracks is not All.
- Sparse/empty albums, empty pages with continuation, more than one artist album page, and partial failure retain data and reach all later tracks without false completion or middle gaps. Playlist duplicates remain occurrences.
- Prefix is available synchronously on accepted navigation. Continuation reuses cursor and LFU data, with no first-page replay after successful warmup.
- Immediate preceding/following entries plus highlighted entry are warmed, bounded at edges. Only highlighted track calls provider.prepare.
- Foreground work cannot starve behind speculation. Low-to-high promotion, abort, late completion, pending eviction, error retry, and repeated rerenders cannot cause duplicate/rejected request loops.
- TTL, LFU frequency versus recency tie-break, accepted work protection, cleanup and account invalidation hold across every retention owner. Existing source snapshots/discovered albums must not defeat the bounded cache.
- Root library collections are included in on-demand/prefix policy; old eager whole-library draining must not silently remain contrary to D2.
- Deterministic behavioral tests, independent scoped/full checks, exact provider endpoint validation, installed-source claims, docs, and type-escape audit. Inspect decisions/diary/evidence once available.

## Required independent verification

Run scoped tests; root typecheck and lint; bunx tsc --noEmit -p apps/web/tsconfig.json. Confirm full-suite integration evidence and existing-route visual proof, documenting authenticated-provider limits honestly. Final formal review will replace this preparation note after implementation handoff.

## Review pass 1 — REQUEST_CHANGES

Independent checks during first handoff: 866 focused tests passed; root typecheck 14/14 passed; app tsc passed. Root lint reproduced 329 errors, all reported paths in unrelated pre-existing workstream evidence; no changed implementation path was named. Root lint remains an existing limitation, not a new implementation finding.

- [MAJOR] Artist All self-evicts while consuming more than 32 albums (packages/music-management/src/relationships.ts:24, packages/music-management/src/bounded-async-cache.ts:113). The parent flattened list and each child album occupy the same LFU. Parent frequency stays one while its child loads evict it, aborting its state signal and failing otherwise valid navigation. Independent bun probe used actual Relationships.load with one parent and 40 child album keys: `All failed: AbortError ... artist retained: false`. D1/D4 require complete on-demand flattening and bounded ownership without aborting accepted work.
- [MAJOR] Visible track selection waits for the full collection outside manager intent ownership (packages/panel/src/navigation.ts:309–315). The accepted selection is not recorded until `complete.then` resolves, allowing a slow older choice to override a newer choice. A failure in any later page also prevents an already loaded playable song from playing. Every live-source play now occurs in a promise continuation, violating the manager's explicit synchronous trusted-gesture call contract for Spotify activateElement (packages/music-management/src/manager.ts:235). Start/reserve playback synchronously and preserve latest-selection/session cancellation while completing queue data.
- [MAJOR] Cover Flow does not start remaining album pages (packages/panel/src/navigation.ts:245). Root ensureLibrary handles only artists/albums/songs/playlists, while cover-flow shares the now-bounded albums source and cannot trigger a drain. It remains limited to the initial 15 indefinitely unless Albums was visited separately. D2's other-view continuation requires this sibling.
- [MAJOR] Root collection failure cannot recover on reentry (packages/music-management/src/library.ts:175–202). drain catches errors and resolves; ensureLibrary retains that resolved work forever in libraryLoads. Selecting the collection again never retries its saved cursor, leaving partial results permanently truncated after one transient failure. Keep completion cached only for genuinely complete collections and allow accepted reentry to retry the failed cursor.

Implementation and regression fixes are still in flight; these findings were relayed immediately to the lead. Final formal verdict awaits fixes and final artifacts including playback lane.

- [MAJOR] Apple array-backed relationship responses are always marked complete (packages/providers/src/apple/apple-provider.ts:800). requestApi supports typed MusicKit albumRelationship/artistRelationship, which can return arrays. Applying a limit of 5/15 then treating an exactly-full array as exhausted silently drops remaining songs/albums. The existing libraryPage handles this case with offset/fingerprint continuation; the new relationship page needs corresponding verified behavior. Current new test exercises only structured api.music responses.
- [MAJOR] Newly introduced relationship cursor registries survive account teardown (packages/providers/src/apple/apple-provider.ts:790; packages/providers/src/spotify/spotify-provider.ts:43). Existing account reset clears library cursors/key mappings but not relationshipCursors. Old cursors remain accepted for another account, contrary to the provider cursor contract and D3/D4 invalidation. Clear them with account lifecycle and reject late old-generation cursor issuance; verify both providers.

## Review pass 2

Provider/source/cache rechecks: 85 tests passed. Apple array and account cursor changes inspected. >32-album parent ownership now pins LFU; root Cover Flow drains its albums source; failed root pages retry. Two followup regressions sent directly to implementer: skip TTL expiration for active pinned entries, and keep an already complete initial root collection complete when ensureLibrary runs.

- [MAJOR] Progressive playback holds the transport command queue for its entire suffix (packages/music-management/src/manager.ts:343). `enqueue` wraps all sequential remote appends, so seek/skip/setVolume/setShuffle accepted after append starts wait until the entire artist/library suffix has been appended. A large library can block these controls for minutes. D2 requires foreground work not be starved by background continuation. Yield between suffix entries and prove a foreground command runs after an in-flight append settles but before the remaining suffix drains. Sent to playback owner for correction.

## Final bounded followup

Parent-frame completion and HMR claim recheck: 57 tests passed, app tsc/Panel lint/diff check passed.

- [MAJOR] Artist album cache expiration can turn a visible album into false empty (packages/music-management/src/library.ts:104,121). Album resolution uses the root library array or artist relationship cache snapshots. A rendered artist album frame can outlive that LFU entry (e.g. listen for five minutes, return), while the album is absent from the bounded initial root albums. `tracksForAlbum` then returns `[]` without I/O. Independent source probe: discover album through artist, clear relationship entries while retaining its ref, request tracks by visible album key → `{tracks:0,reads:0}` despite provider returning a track. Pass the accepted frame's exact reference into the loader or otherwise preserve cache-independent lookup without an unbounded registry. Relayed to implementer and lead.

Broad test limitation: independent `bun test packages` completed 1474 pass/17 fail. Re-running the five unchanged failing files in isolation yielded 48 pass/2 fail: confirmed missing Node executable and stale StudioEnvironment route assertion. The other 15 server cases pass in isolation; broad-suite interactions remain unclassified, not claimed as newly introduced or baseline-proven. No whole-repo green claim is justified. Scoped affected tests/type/lint remain green.
