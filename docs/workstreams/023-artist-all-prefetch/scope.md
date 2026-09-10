# Artist All and navigation prefetch

Status: Complete after user correction and renewed independent APPROVE. Prior closeout was superseded by D8–D10. Branch: codex/artist-prefetch-playback-sync; changes uncommitted. Tracker: live failure reproduced → continuous loading/cache budget corrected → response-shaped regressions pass → final live verification complete → renewed independent review APPROVE.

Corrected closeout:907 affected tests/4,334assertions pass;14projects typecheck; affected-code lint and lead final app tsc/diffcheck pass. Actual Chrome CUA+DevTools confirms AC/DC8albums/80songs and VariousArtists40albums across3APIpages/155songs; root completes112playlists/271artists/461albums/2726songs continuously. Evidence: evidence/live-correction.md and named before/after screenshots. Cache is configurable64MiB estimated evictable relationship metadata (48tracks/16albums), not1GiBRAM, persistent storage, or a whole-process bound. Root/rendered/playback owners are documented separately. See renewed reviews/review.md. Broad repository suite limitations remain; no live Spotify/audible playback claim.

## User correction superseding D2 and prior closeout

D8: Fifteen entries is the initial rendering target, never a stopping point for the current page. Restore continuous background library population so the Music root counts advance without entering every category; current relationship screens continue through all pages. Keep bounded neighbor/next-destination warmup and foreground responsiveness. Existing prior tests asserting root stops at15 encode the wrong product behavior and must be replaced.
D9: Reproduce reported AC/DC artist All + error before first album using the actual connected Chrome/DevTools session. Capture only safe endpoint/status, payload pagination/resource shape and exception details; never headers/tokens. Fix the evidenced failure with response-shaped regression fixtures; no speculative relaxation of origin/cursor guards. Live verify failing flow and an artist with multiple pages, plus current root counts increasing. No final success based solely on mocks or a three-album artist.
D10: Cache requested as best-practice budget (user suggests1GB). Current cache is heap metadata, not disk. Use a configurable estimated byte retention budget, default64MiB total relationship metadata (48MiB tracks,16MiB albums) plus512-entry safety ceiling per collection. This is an engineering default, not a browser standard or whole-process heap cap. Account incremental page growth and release/eviction, retain active-operation correctness and account isolation. No1GiB preallocation or new persistent database; disk quota estimates do not measure safe JS heap. Explicitly document root/rendered/playback collections outside evictable retention and avoid duplicate entity copies when possible. Byte accounting must be bounded work at ingestion, not render-time serialization.

Ownership for correction: main implementer owns provider/library/Panel integration and tests; provider_research owns bounded-async-cache.ts, relationships.ts, new cache-budget.test.ts plus separate cache-budget evidence/diary. Main implementer configures per-collection limits in library.ts against shared constructor contract. Reviewer read-only; lead owns live browser/DevTools diagnosis and scope. No broad root test discovery; use affected tests/typechecks/lint and real-browser evidence. Keep prior playback fixes intact.

Closeout: 890 affected tests pass (4,256 assertions); 14/14 projects typecheck; affected-code lint and diff checks pass. Lead independently ran final apps/web tsc and diff check and verified live Apple artist All/back/playlist navigation. Independent review has zero unresolved Critical/Major findings. See reviews/review.md, evidence/verification.md, evidence/playback-verification.md and evidence/browser-verification.md. Broad repository tests/lint are not green: confirmed preexisting errors and unclassified suite-interaction failures are documented; no whole-repo or live Spotify/audible-playback success claim is made. Legacy test-generated artifacts were restored; only intended changes remain.

## Source and decisions

Primary: user's September 10 request and attached artist album screenshot. Add a leading `All` option to an artist's album view, opening all available songs. Prefetch five tracks from each of the first five albums, in displayed album order. Use a real artist songs endpoint when available, prefetching 30. Expand neighboring-entry preparation to warm the first 15 entries of the next destination; continue remaining entries on demand after navigation. Use LFU caching.

D1: `All` is scoped to each artist album screen; other views receive the prefetch expansion, not arbitrary new All controls. Preserve album display order and track order within each album for the flattened fallback. Preserve playlist duplicates. Samples from subsequent albums must never masquerade as a contiguous complete flattened prefix, and partial data must not be cached as complete.
D2: Neighbor means immediate preceding and following selectable entries plus highlighted entry, bounded at list edges. Only highlighted tracks may trigger provider playback preparation; neighbors fetch data/artwork only. First 15 is a destination prefix, not 15 additional speculative destinations. Artist album warmup is five tracks for each of first five albums, plus sufficient ordered data to support a 15-entry All prefix; a direct artist endpoint warmup requests 30. Honor provider pagination limits without downloading everything to slice locally.
D3: Artist direct endpoint must represent the same library/catalog scope as its artist. Top tracks is not All. Provider-neutral navigation must not branch on provider ID. Research is a dependency for provider implementation.
D4: Existing relationship cache is LRU (packages/panel/src/bounded-async-cache.ts); no LFU implementation was found. Evolve the existing bounded cache to LFU with recency tie-breaking, retain TTL/abort/error retry semantics, and share warm data with accepted navigation. Record any effect on artwork/preparation callers. No independent unbounded cache.
D5: User authorizes implementation and strict independent review. No merge, push, deployment, auth modifications, or commits needed; leave stageable changes. No open product blocker; routine implementation choices are delegated and logged.

D6 (user steering): Also fix recurring playback/UI synchronization failure: audio plays while Now Playing remains loading with clock at 0:00. Must cover both Apple Music and Spotify with deterministic regression tests at provider/shared manager/UI boundaries where causal evidence requires. Provider playback events/progress are authoritative; stale loading/pending state must not override confirmed playing state, and errors/real buffering must still render accurately. Include out-of-order events, initial snapshot versus subscription, and switch/deactivation coverage where related. Scope allows targeted playback manager/provider/presentation changes and tests; no unrelated transport redesign. A separate investigator first identifies causal path; lead assigns disjoint writes before implementation. Evidence/diary/decisions apply to both slices; independent reviewer covers both.

D7 (user steering): Work is on codex/artist-prefetch-playback-sync, branched from main with current uncommitted changes preserved. No commit/push requested.

## Ownership and literature

One implementer owns packages/providers, packages/music-management, packages/panel, packages/state and necessary sibling callers/tests in packages/tools or apps/web. Lead owns this scope and dispatch; researcher is read-only; reviewer owns reviews only. Ignore other workstreams. Repo AGENTS.md wins over skill Kanban/Neuve instructions: neither exists here.

Read AGENTS.md (primary guardrails); packages/providers/src/provider.ts, identity.ts, domain.ts (canonical shared contract); apple/apple-provider.ts and spotify/spotify-provider.ts plus spotify/api.ts (current boundary validation and pagination); packages/music-management/src/library.ts (source snapshots, progressive publication); packages/panel/src/navigation.ts, Panel.tsx, bounded-async-cache.ts (current behavior replaced where D1–D4 require); packages/state/src/contract.ts and route consumers (typed navigation); package.json/scripts/typecheck.ts (checks).

The prescribed /Users/vinicius/code/.better-coding-agents/resources directory is missing. Research must seek relocated sources, use installed pinned dependency sources and official provider docs, and record exact sources. Existing MusicProvider, Page, Cursor, TrackRef, AlbumRef, ArtistRef types are canonical; extend/reuse these, not parallel protocol mirrors. Record boundary validation and provider paging semantics in decisions.md.

## Slices and dependency graph

1. Research → paged provider relationships and artist songs contract. Verify mocked HTTP limits, continuation, scope, errors, cancellation, unsupported path. Evidence in evidence/verification.md.
2. Provider contract → shared progressive relationship loading and bounded LFU. Verify in-flight deduplication, partial-to-complete continuation without repeated first pages, TTL/eviction, retry after failed speculation, source invalidation and aborted late completion. Evidence same artifact.
3. Shared loading → All route, ordered flattened tracks, prefix rendering, neighbor preparation across albums/playlists/artists/genre/cover-flow/root where applicable. Verify immediate synchronous cached frame, continuation, stable selection, playable queue, back navigation, error state retaining partial results, sparse/empty albums, album list beyond first page. Evidence same artifact and visual proof below.
4. Implementation evidence → independent antagonistic review → implementer fixes → reviewer recheck → lead sanity checks.
5. Playback regression investigation → isolated causal fix and Apple/Spotify regression tests → same independent review and final verification. Runs alongside prefetch where file ownership is disjoint; shared-file edits serialize.

## Gates and DoD

- Deterministic tests directly prove budgets 5×5, 30, 15; no whole-collection speculative drain; same cache reused by navigation; LFU differs from LRU.
- All route works by human and existing WebMCP navigation; indexes, preview and playback refer to correct entities after insertion.
- On-demand loading reaches all entries, preserves order and stable identity; no missing middle tracks, false completion, stale account data, unbounded requests or rejected-promise loops.
- Foreground requests are not starved by speculation; cancellation and provider switching prevent stale publication. No speculative playback side effects.
- `bun test` (whole suite once at final integration), focused `bun test packages/providers packages/music-management packages/panel packages/state packages/tools` while iterating.
- `bun run typecheck` and `bun run lint`; independently `bunx tsc --noEmit -p apps/web/tsconfig.json` by reviewer and lead. All touched package typechecks covered by root script.
- Public/non-obvious lifecycle functions have concise TSDoc explaining invariants. No any, unchecked casts, lint disables without documented proof.
- Visual proof from existing app route using existing fixture/provider mode, no new QA routes or credential reading. Save screenshot under evidence/ and record limits if authenticated provider access unavailable; deterministic provider tests remain primary proof.
- Independent reviewer verdict APPROVE with zero unresolved Critical/Major findings. Lead verifies final artifacts/checks, updates tracker and goal.

## Artifacts and history

All paths relative to docs/workstreams/023-artist-all-prefetch/: scope.md (lead); dispatch.md (lead); decisions.md (implementer, research links and assumptions); diary.md (implementer changes, handover); evidence/verification.md (commands, results and bounded outputs); reviews/review.md (reviewer findings/verdict). Review prompt is dispatch.md and strict-critique skill, no other workstream's prompt is assigned. No platform registry located during scope discovery; reviewer may inspect repo-wide registry if present.

Playback implementation ownership: provider_research agent exclusively writes packages/music-management/src/manager.ts, manager.test.ts, playback-recovery.test.ts; prefetch implementer sends any facade integration needs to that agent. Playback artifacts are diary-playback.md, decisions-playback.md, evidence/playback-verification.md. Reviewer reads both evidence/decision sets. Any expansion of shared-file ownership must be serialized by lead.

Suggested stageable commit slices: `Add paged provider relationship loading`; `Warm navigation prefixes through bounded LFU caching`; `Add artist All navigation and ordered playback`. Tests accompany their behavior; bookkeeping docs separate. Do not create commits for this task.

Guardrails: bun/bunx only, no useState, no cert/ access, design.pen only via pencil (not needed), no force pushes. No proof-only app surfaces, unrelated redesign, new HTTP framework, dependencies or auth flow changes. UI follows existing rows.
