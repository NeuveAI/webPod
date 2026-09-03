# Apple Music final wiring — strict review

Date: 2026-09-03
Reviewed implementation: `eb7454b` (`Wire Apple Music into production navigation`) with the previously reviewed Apple base at `eecd7a9`. The intervening commits in the literal range were inspected only to distinguish them from this commit; unrelated dirty-worktree changes were not reviewed.

## Verdict

**APPROVE — commits `0d0c273`, `0811c33`, and `c3d113c` resolve all four original Majors and the station exact-once note.**

## Findings

### [MAJOR] A completed Apple request can undo the user's newer fixture selection

**Resolved by `0d0c273`.** The monotonically increasing operation generation is checked after configuration, authorization, hydration, and in failure/finally paths, so stale completions no longer publish over a later selection.

`apps/web/src/music-runtime.ts:80-90`, `apps/web/src/music-runtime.ts:94-98`

Both Apple flows publish after each `await` without an operation generation, cancellation token, or check that Apple is still the requested mode. For example, `selectMusicRuntime('apple')` can be waiting in `configure()` or `appleSource()` when the user presses **Use demo library**. The fixture call publishes immediately, then the older Apple call completes and publishes Apple again. The same race exists between authorization/hydration and fixture selection. This breaks the explicit opt-in/selection contract: the last user choice does not win, and a user who opted back into deterministic fixture data can be returned to the real account. Add deterministic deferred-promise tests proving stale configure, authorize, and hydration completions cannot replace a newer selection.

### [MAJOR] Apple relationship reads silently truncate paginated collections

**Resolved by `0d0c273`.** Relationship reads now exhaust `next` links with a bounded page count, and the Apple fake supplies and asserts two pages for both tracks and albums.

`packages/providers/src/apple/apple-provider.ts:113-124`, `packages/providers/src/provider.ts:127-130`

The existing library path preserves Apple's `next` cursor through `Page<Entity>`, but the new `relatedTracks` and `relatedAlbums` contract returns only an array and each implementation makes exactly one request. Any Apple playlist, album relationship, or artist-albums relationship with a `next` link is therefore presented as complete after its first page. This is especially user-visible for long playlists: navigation and the play target both omit all later tracks. The fake test at `packages/providers/src/apple/apple-provider.test.ts:20` cannot catch this because it supplies a single unpaginated response. The relationship seam must either expose/preserve pagination or exhaust all returned `next` links with the same bounded/cursor-safe discipline as library hydration, with a multi-page test.

### [MAJOR] Catalogue search results render but cannot be selected for playback with the Apple source

**Resolved in implementation by `0d0c273`.** The Apple navigation source now keeps a LocalKey registry and `selectNavigation` records library and catalogue search results before constructing the key-only route. The existing provider-neutral catalogue-selection test passes, although a runtime-level regression test remains desirable.

`apps/web/src/music-runtime.ts:65-75`, `packages/panel/src/navigation.ts:152-170`, `packages/panel/src/navigation.ts:227-237`

Search stores only result `LocalKey`s in the route. Selection resolves those keys through `source.trackByKey`, but the Apple implementation searches only the initially hydrated library-song array. A catalogue-only Apple result is not in that array, so `tracksForRoute` drops it, returns an empty list, and Center produces no frame and no playback. The navigation unit test proves catalogue playback only with a test source whose key lookup includes the search result; it does not exercise the newly wired Apple source. Keep a provider-neutral entity/key registry that learns search and relationship results, or carry a provider-neutral resolver capable of re-resolving them, and add an Apple-runtime integration test for catalogue-only search → Center → provider `play`.

### [MAJOR] The production panel does not render the promised loading, denial, or error authorization frames

**Resolved by `c3d113c`.** `Panel.accountStatus` now distinguishes three cases: `undefined` derives normal provider/session posture, a concrete status renders that status frame, and documented `null` suppresses derived account posture. `ProductionPanelView` passes `null` only for the runtime's `permission-denied` phase while passing the authored `PanelState="permission-denied"`; therefore a null Apple session no longer installs the signed-out route before the denial UI can render. Normal signed-out remains `undefined` and continues through `providerStatusFrame`, while pending and generic error retain explicit loading/error status frames.

`apps/web/src/music-runtime.ts:17`, `apps/web/src/music-runtime.ts:83-99`, `apps/web/src/production-device-view.tsx:39-52`, `packages/panel/src/Panel.tsx:96-107`

The runtime tracks `signing-in` and `error`, while the Apple adapter separately tracks `permission-denied`, but `ProductionPanelView` passes neither state to `Panel`. `Panel` derives account posture only from `provider.session`; while configuration/authorization is pending, after permission denial, and after authorization failure that value is null, so the physical screen renders the signed-out frame in every case. The richer state appears only as text outside the device preview, and `MusicRuntimePhase` omits `permission-denied` entirely. This contradicts the navigation dispatch invariant that loading, error, signed-out, and playback-permission postures remain renderable through typed panel states/status frames, and it makes an authorization denial look like a fresh sign-in opportunity. Map the provider/runtime state into the existing typed panel/status frames and test the production bridge for pending, denied, failed, signed-out, and authorized transitions.

## Additional correctness note

`packages/panel/src/navigation.ts:158-163` invokes `stationStart(...)` and then `play(...)`. The Apple implementation at `packages/providers/src/apple/apple-provider.ts:129` already sets the station queue and starts playback, so Apple Radio currently performs two queue replacements and two play calls for one Center action. This is covered by the Major test/correctness gap above and should be resolved while repairing the provider-neutral playback contract; `stationStart` is documented at `packages/providers/src/provider.ts:285-295` as returning the station now playing.

**Resolved by `0811c33`.** Fixture `stationStart` now changes queue/playback and emits one playing transition; Apple and fixture tests independently assert one playback start. Navigation calls the provider operation once.

## Corrective re-review verification

- Inspected corrective commit `0d0c273` line-by-line against all four original Majors and the station note.
- `bun test apps/web/src/music-runtime.test.ts packages/providers/src/apple/apple-provider.test.ts packages/panel/src/navigation.test.ts packages/panel/src/Panel.test.tsx packages/providers/src/fixture/fixture-provider.test.ts` → 100 pass, 0 fail.
- `bun run typecheck` → 11/11 projects clean.
- Targeted ESLint over all six corrective implementation/test files → clean.
- The corrective commit adds deterministic pagination coverage, but adds no race-ordering, production auth-state bridge, catalogue-search runtime, or station exact-once regression tests.

## Final corrective verdict

After `0d0c273`: **REQUEST_CHANGES — 2 Major, 0 Minor.**

After `0811c33`: **REQUEST_CHANGES — 1 Major, 0 Minor.** The station contract is now correct, but the physical panel still resolves permission denial to the signed-out status route. Fix that route precedence and prove the production bridge transitions deterministically before approval.

### `0811c33` verification

- Inspected all four changed files and traced the denied runtime phase through `ProductionPanelView`, `Panel`, `providerStatusFrame`, and `renderScreen`.
- `bun test packages/providers/src/apple/apple-provider.test.ts packages/providers/src/fixture/fixture-provider.test.ts packages/panel/src/navigation.test.ts packages/panel/src/Panel.test.tsx apps/web/src/music-runtime.test.ts` → 102 pass, 0 fail.
- TypeScript checks for `apps/web`, `packages/providers`, and `packages/panel` → clean.
- Targeted ESLint over the corrective files → clean.

After `c3d113c`: **APPROVE — 0 Critical, 0 Major, 0 Minor.** The explicit-null account override fixes the remaining route-precedence defect without weakening ordinary signed-out derivation.

### `c3d113c` verification

- Traced `permission-denied` from `MusicRuntimePhase` through `ProductionPanelView` into the new explicit-null `Panel.accountStatus` contract and confirmed the root frame, rather than the signed-out status route, reaches the authored denial rendering.
- Confirmed `signed-out` still passes `accountStatus={undefined}` and therefore remains provider/session-derived; loading and error still pass concrete typed status values.
- `bun test packages/panel/src/Panel.test.tsx apps/web/tests/production-device-view.test.ts apps/web/src/music-runtime.test.ts` → 21 pass, 0 fail.
- TypeScript checks for `apps/web` and `packages/panel` → clean.
- Targeted ESLint for `apps/web/src/production-device-view.tsx` and `packages/panel/src/Panel.tsx` → clean.

## Security and boundary review

- No implementation outside `packages/providers` branches on `provider.id`; explicit runtime-mode selection is a user/configuration choice, not a provider capability branch.
- The reviewed client files do not import the signer, key-reading code, or server token implementation.
- The production build completed, and a client-source grep found no Apple key-path/team-id or signing-key primitives in the changed client/provider surface.
- No file under `cert/` was accessed, no credential-bearing command was run, and no Apple network call or library mutation was performed.
- Fixture remains the resolver's default for missing/invalid configuration, and query selection has precedence over the build default. Those pure cases are tested.

## Verification performed

- Read `AGENTS.md`, the strict-review protocol, workstream `scope.md`, `handoff.md`, `review-system-prompt.md`, `review-lanes.md`, `hitl-decisions.md`, navigation dispatch/decisions, and Apple decisions/diary/evidence/runbook.
- `docs/decisions.md` and `docs/platform_decisions.md` do not exist in this repository; workstream decision records were used instead. Applicable constraints included H-2/H-10/H-11, Apple decisions 3-7, and navigation N-2 plus its typed-status invariant.
- Neuve was not run: `AGENTS.md` explicitly states there is no Neuve shell or Kanban board for this repository.
- `bun test packages/providers/src/apple/apple-provider.test.ts packages/providers/src/fixture/fixture-provider.test.ts packages/providers/src/stub.test.ts packages/panel/src/navigation.test.ts apps/web/src/music-runtime.test.ts` → **154 pass, 0 fail**.
- `bun run typecheck` → **11/11 projects clean**.
- Targeted ESLint over all implementation/test files changed by `eb7454b` → clean.
- `bun run build` → client and SSR builds complete.
- `bun run gates` → **1163 tests pass; 16 automated gates pass; U14/U15 remain manual**. These green gates do not exercise the four failing runtime scenarios above.

## Re-review requirements

Re-review the patched commit with deterministic fakes that prove: last-selection-wins under deferred Apple work; multi-page relationship exhaustion; catalogue-only search playback through the actual Apple runtime source; all authorization postures on the physical panel; and exactly one station start/play transition per Center action. Owner interactive MusicKit sign-in remains HITL evidence and is not required to establish these deterministic contracts.
