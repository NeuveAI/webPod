# Scope: Apple Music genre browsing

Status: **Guarded — personal-library implementation scoped with explicit agent defaults; relationship/source validation remains in S0.**
Owner: Codex implementation in this repository. Created: 2026-09-09.
Baseline inspected: `769fc8d`. This document scopes future code changes; none are implemented by the scoping task.

## Outcome and scope boundary

Restore the iPod's **Genres** entry with real Apple Music library data and working `Genres → Genre → Artists / Albums / Songs` browsing and playback. Removing fixture data must result in a real implementation, not permanent removal of the feature.

The proposed core scope is personal-library browsing. Catalog discovery is a separately gated extension below. Comprehensive enumeration of Apple's catalog by genre is outside this workstream: chart results are not a complete catalog. This is an implementation contract for Codex, not an estimate of work for the owner to perform.

Complexity: medium across provider metadata, progressive indexing, navigation/state, and tool parity. The existing screens and library loader can be reused. The largest uncertainty is identity-correct album/artist linkage for actual library responses; CPU grouping is straightforward. Do not build a database or a separate library importer for the core scope.

## Criteria notes and decision register

The owner requested consideration of implementation complexity after a prior agent removed Genres, then explicitly requested a workstream scope document. The owner has not yet selected personal-library-only versus library plus catalog charts. No approval to implement or publish code is implied by this documentation task.

| ID | Decision | Status / default | Implementation consequence |
|---|---|---|---|
| D01 | Library only, or library plus catalog genre charts? | Question sent during scoping; no answer received at document creation. Agent default adopted: library first; charts deferred. Owner may revise. | Core scope is library browsing; catalog extension must not be silently included. |
| D02 | Source of genre membership | Proposed default: Apple's library song labels; album labels are fallback only for a resolved parent album. | Preserve user-library metadata; do not replace it with the sticker classifier or catalog labels. |
| D03 | Multiple or missing genres | Proposed default: include a track in each distinct label; omit umbrella `Music` when a specific label exists; otherwise use `Unknown Genre`. | Deduplicate within a genre, never merge distinct Apple labels into broad custom categories. Trim blanks and Unicode-normalize labels; retain display spelling. |
| D04 | Genre drilling and playback | Proposed default: retain the genre filter through artist, album, and track routes. | A mixed-genre album opened from Rock exposes and plays only matching library tracks. Ordinary album browsing stays unchanged. |
| D05 | Partial library during synchronization | Proposed default: incremental browsing with explicit loading/incomplete status. | Playback uses a snapshot of currently loaded playable members; later pages do not mutate an active queue. |
| D06 | Library refresh | Proposed default: use existing runtime rebuild/session lifecycle. | No new cross-session persistence, polling service, or incremental Apple change-feed promise. |

These are recorded agent defaults/proposals, not attributed owner decisions. The agent may use D02–D06 if logged in `decisions.md`; subjective changes require owner input. D01 has been explicitly defaulted so an unanswered optional question does not block the core scope. No silent autonomous merge from a Guarded scope.

## Sources and required reading

Source priority: current owner request → repository `AGENTS.md` → this scope's explicit accepted decisions → official Apple contracts → existing shared code. Existing fixture behavior is supporting evidence, not authority for Apple capabilities.

| Source | Class | Purpose / question answered |
|---|---|---|
| `AGENTS.md` | Primary | Repository boundaries, shared state, credentials, tooling, and commit law. |
| Owner request, recorded above | Primary | Why Genres must receive a real implementation assessment and scope. |
| `packages/providers/src/identity.ts`, `domain.ts`, `provider.ts`, `index.ts` | Current shared contract | Reuse `TrackRef`, `AlbumRef`, `ArtistRef`, `GenreRef`, `LocalKey`, and `MusicProvider`; establish public export impact. |
| `packages/providers/src/apple/apple-provider.ts` | Current behavior | `normalize` drops genre metadata; `libraryList('genres')` is unsupported; library pages already exist. |
| `packages/providers/src/apple/relationships.ts` | Supporting | A successful request does not prove a requested relationship was returned. Distinguish absent relationship from present empty data. |
| `apps/web/src/music-runtime.ts`, `music-runtime.test.ts` | Current behavior | Reuse progressive pagination, source subscriptions, and operation invalidation; genre accessors currently return empty arrays. |
| `packages/panel/src/navigation.ts`, `navigation.test.ts`, `fixtures.ts` | Current behavior | Genre routes survive the menu removal; artist drilldown loses genre scope; genre frames are missing from refresh handling. |
| `packages/state/src/contract.ts`, `store.ts`; `apps/web/src/webmcp.ts`, `device-state-webmcp.ts`; `packages/tools/src/interactions.ts` | Current shared contract | Keep route identity, Jotai state, human controls, and agent actions in agreement. |
| `packages/server-core/src/stickers/apple-import.ts` | Supporting / read only | Already consumes genre metadata, but its bounded sampling and broad classifier are unsuitable as the browse index. |
| [Library song attributes](https://developer.apple.com/documentation/applemusicapi/librarysongs/attributes-data.dictionary) and [library album attributes](https://developer.apple.com/documentation/applemusicapi/libraryalbums/attributes-data.dictionary) | Supporting official contract | Apple exposes `genreNames`; verify actual response shape at the adapter boundary. |
| [Get all library songs](https://developer.apple.com/documentation/applemusicapi/get-all-library-songs) | Supporting official contract | Paginated input for library membership. |
| [Chart genres](https://developer.apple.com/documentation/applemusicapi/get-all-genres) and [charts](https://developer.apple.com/documentation/applemusicapi/charts) | Supporting official contract | Optional catalog extension can expose genre charts, not exhaustive genre membership. |
| Commit `769fc8d`, navigation diff | Legacy | Confirms menu entry removal; does not justify preserving removal. |
| Fixture-only genre names/IDs and sticker taxonomy | Anti-source | Never production music data, catalog IDs, or exhaustive genre taxonomy. |
| `/Users/vinicius/code/.better-coding-agents/resources/` | Unknown / unavailable | Required library reference root was absent during scoping. Record resolution and inspect installed pinned sources before changing SDK/framework boundaries; do not claim this research is complete. |

Do not read unrelated workstreams. Do not read or modify encrypted `.pen` files outside Pencil tools.

## Observable correctness

1. An authorized library exposes Genres in the existing iPod menu. Empty libraries keep a useful empty Genres screen; absence of content does not remove the feature.
2. Genre membership comes from loaded Apple library tracks. A track can occur in multiple genres but appears once per genre. Album metadata never overrides an explicit track label. Invalid/empty labels produce the documented fallback without rejecting otherwise valid music.
3. Genre references use stable `LocalKey` identity for the active library source. Locally derived labels must not masquerade as Apple catalog IDs. Adapt the shared `GenreRef` contract to distinguish derived library facets from actual catalog genres, then check every consumer and fixture.
4. Artists and albums are derived from exact resolved library relationships. Names are display data, never join keys. Unresolved tracks remain reachable in Songs while relationship loading/failure is visible in affected facets; do not fabricate artist/album identities or declare unresolved facets complete.
5. `Genre → Artist → Album → Songs` and `Genre → Albums → Songs` retain genre and library membership. A compilation, two artists with the same name, duplicate album titles, multi-artist credit, and library-only uploads must not mix unrelated records or expand into an artist's full catalog.
6. First useful genre content appears before the whole library finishes loading. Each new page updates visible genre lists, counts, and nested screens. A highlighted entity stays highlighted by identity across sorted insertions; Back preserves the applicable filter and focus.
7. Counts distinguish loading, complete, and failed/incomplete data. A failed page retains loaded content. Retry uses the existing runtime lifecycle and does not multiply members. Account replacement/sign-out invalidates old indexes and late async results.
8. Center enters a genre/facet. Play/Pause on a genre, genre artist, or genre album replaces the queue with the loaded playable tracks for that selection; selecting a song starts at that song in the displayed order. Empty selections do not replace playback. Existing shuffle/transport semantics are reused. Queue contents remain stable when more pages arrive.
9. Humans and WebMCP use the same routes, selection state, data, and playback actions. No agent-only genre list or duplicate queue implementation.
10. No eager request per song. Preserve genre labels from existing pages; request needed album/artist relationships on demand, coalesce identical in-flight requests, and reuse results for the current source. Cancel or discard obsolete results. A changed account never reuses the prior account's data.

Ordering defaults: genres/artists/albums use existing localized label ordering with identity tie-breaks; genre Songs uses existing library song order; filtered album tracks preserve relationship track order. Matching uses normalized label equality, not fuzzy classification. Document these rules in the index module.

## Implementation slices and dependency graph

Single implementation owner, sequential slices. No delegation is required for this documentation task. Implementation review lanes are specified below.

`S0 contract validation → S1 metadata/identity → S2 index/linkage → S3 navigation/playback → S4 tool/browser verification → S5 review/handover`

| Slice | Write ownership and concrete change | Verification / evidence | Commit intent |
|---|---|---|---|
| S0 | Read provider SDK bridge and installed dependencies; confirm documented library album/artist relationships and response parsing; write `decisions.md`. Resolve missing reference checkout or log a precise alternative source. | Record canonical types, relationship paths, absent-vs-empty behavior, and actual-vs-fixture provenance in `evidence/contracts.md`. Failure to establish a correct relationship path blocks S2's artist/album implementation, not metadata work. | `Document Apple genre data contracts` |
| S1 | `packages/providers/src/identity.ts`, provider exports, Apple normalization and tests, fixture compatibility. Preserve validated readonly genre metadata and resolved relationship identities; represent derived genres truthfully. | Provider contract cases: multiple labels, missing/malformed labels, library-only resources, canonical/library identity equivalence, absent relationships. `evidence/provider-tests.txt`. | `Preserve Apple library genre metadata and identity` |
| S2 | New `apps/web/src/music-genre-index.ts` and test; `music-runtime.ts` and test; provider relationship helpers only where required by S0. Build source-scoped index and lazy identity linkage. | Paginated fixture: duplicate pages/resources, late Rock item, label collision, unknown genre, upload, unresolved relationship, page failure, replacement session. Assert first-page usefulness and zero extra genre requests for song grouping. `evidence/runtime-tests.txt`. | `Index library genres during music synchronization` |
| S3 | `packages/panel/src/navigation.ts` and tests, `packages/state/src/contract.ts` and route consumers, `Panel.tsx` only for status rendering. Restore menu; carry genre context, refresh/focus, scoped playback and Back behavior. | Genre-route tests cover matching subsets, identity joins, sorted insertion focus, queue snapshot, empty selection, stale async navigation. `evidence/navigation-tests.txt`. | `Restore scoped genre browsing and playback` |
| S4 | `packages/tools/src/interactions.test.ts`, tool implementation only if generic navigation needs parity; `apps/web/tests/genres.e2e.ts` on the existing product route. | Human and tool sequence reach the same genre/song and queue; existing rendered player verified at desktop and mobile viewport. `evidence/tool-tests.txt`, `evidence/browser/`, `evidence/live-apple.md`. | `Verify genre browsing through player and agent controls` |
| S5 | This workstream's docs, fixes confined to preceding ownership. | Type/lint/build outputs, independent findings, fixed findings or explicit unresolved limits, final diff fingerprint. `reviews/final.md`, `handover.md`. | `Record genre implementation verification` |

Each slice may be self-tested by the implementer; independent review evaluates its listed invariant before completion. Shared types must migrate with all affected consumers in the same coherent change. No mechanical repository-wide formatting.

## Verification and type/documentation gates

Deterministic tests are primary behavior proof. Use synthetic Apple responses without personal data; include unhappy paths above. Browser proof demonstrates the existing product route, not a new QA-only route or API.

Concrete commands from repository root after corresponding files exist:

```sh
bun test packages/providers/src/apple
bun test apps/web/src/music-genre-index.test.ts apps/web/src/music-runtime.test.ts
bun test packages/panel/src/navigation.test.ts packages/state/src packages/tools/src
bun run typecheck
bun run lint
bun run build
bunx --bun playwright test --config apps/web/tests/playwright.config.ts apps/web/tests/genres.e2e.ts
git diff --check
```

Inspect the existing Playwright config before running: retain its source fingerprint and launch conventions, and ensure the test exercises the production Apple adapter with network/SDK test doubles rather than the fixture-only provider. Do not introduce a shipping fixture mode. Record exact executed commands, exit status, source revision/diff fingerprint, and failures in `evidence/checks.md`; preserve bounded outputs in `evidence/typecheck.txt`, `evidence/lint.txt`, and `evidence/build.txt`. Fix failures introduced by this work; identify unrelated baseline failures separately rather than hiding them or claiming full gates passed.

Canonical boundaries are existing shared domain types and the provider's MusicKit bridge, not an invented parallel protocol. Raw external values are validated at that edge. No `any`, unchecked new casts, non-null assertions, lint suppression, or fictional provider IDs to make the feature compile. Optional metadata must distinguish legitimately absent Apple data from an incomplete lookup. Public/index lifecycle helpers need concise TSDoc describing membership, identity stability, invalidation, ordering, and queue snapshot semantics.

Live Apple proof is separate from mocked proof: on an available authorized session, record whether genre labels, library-only tracks where present, and artist/album linkage behave as documented. Store only sanitized conclusions and redacted screenshots, never raw personal library dumps or tokens. If interactive authorization is unavailable, continue deterministic verification and label live integration unverified; request the necessary user interaction only when this is the actual remaining dependency. Do not claim Apple behavior was measured from fixture tests.

## Guardrails and non-goals

- Keep state accessible through the shared Jotai store; no `useState` or component-private feature state.
- Reuse MusicKit authorization, playback, provider boundary, and existing TanStack Start routes. No token-signing changes, parallel HTTP framework, new database, or persistent full-library cache.
- Never access contents under `cert/`; no tokens/keys in outputs, evidence, prompts, browser traces, or commits.
- Sticker import/classification remains read-only context; do not couple browsing completeness to its sample or twelve-genre taxonomy.
- No visual redesign, device geometry changes, search overhaul, unrelated menu restoration, genre stations, library writes, or curated playlist taxonomy.
- Use only `bun` / `bunx`; do not use helpers that invoke another package manager. No force push, history rewriting, or commit trailers. This task does not commit, push, merge, or deploy.

## Optional catalog extension — not in the default implementation

If the owner selects both experiences, revise D01 and add a separately reviewable slice after S1. The exact UI is `Genres → My Library / Apple Music`; My Library exposes the hierarchy above, Apple Music exposes chart genres followed by `Top Songs / Top Albums`. Reuse real Apple genre IDs and the authorized storefront, fetch chart pages on demand, cache by storefront/locale/genre/type, and follow returned pagination. Albums open their ordinary catalog track listings and existing playback path.

Acceptance: no hardcoded genres or track IDs; explicitly chart-labeled results; empty/unsupported storefront handling; pagination failure retains prior rows; storefront changes discard old cached responses; chart songs never enter the personal-library index. No `All Artists` or `All Songs` claim. Tests must prove API parameters, stale storefront invalidation, pagination, and human/tool queue parity. Before dispatch, name its provider API/export changes and exact test files in this document; this extension is currently **Draft**, not silently implementation-ready.

## Artifacts, decisions, and review

All paths below are relative to `docs/workstreams/018-apple-music-genres/`:

- `scope.md`: source, criteria notes, decision register, dependency graph, dispatch contract, and DoD (this file).
- `decisions.md`: accepted defaults and contract findings; create during S0, append subsequent tradeoffs with evidence.
- `diary/implementation.md`: bounded progress and unresolved issues; create when implementation starts.
- `evidence/contracts.md`, `provider-tests.txt`, `runtime-tests.txt`, `navigation-tests.txt`, `tool-tests.txt`, `checks.md`, `typecheck.txt`, `lint.txt`, `build.txt`, `live-apple.md`, and `browser/`: outputs named above, under `evidence/`.
- `reviews/data.md`: metadata, identity, relationship completeness, lifecycle, and request growth.
- `reviews/navigation.md`: retained filtering, focus, Back, scoped queue, human/tool parity.
- `reviews/final.md`: final findings and evidence-to-criteria reconciliation.
- `handover.md`: delivered behavior, commands, remaining limitations, and exact source fingerprint.

Review posture: **Focused**, with **Guarded** readiness until contract-source gaps and D01 are recorded. Use strict-critique for implementation review with the two bounded lanes above; load global-patterns and applicable Jotai/state skills, modern-web-guidance before client changes, and browser skills for E2E work. Load team-orchestration only if implementation is delegated. Review must not treat old fixture success as live Apple evidence.

Agent may decide helper decomposition, test fixtures, cache representation, and exact status wording; log decisions affecting observable behavior. Ask the owner before expanding to catalog discovery, changing genre membership/filter semantics, adding persistence, or omitting a required acceptance criterion. A missing relationship is a data condition to resolve or expose, never permission to remove Genres again.

## Definition of done and dispatch packet

- [ ] D01 scope choice/default is recorded, and S0 names verified canonical relationship contracts and pinned implementation sources.
- [ ] Criteria 1–10 pass deterministic tests, including partial/failure and stale-session paths.
- [ ] Existing player route shows populated, loading/incomplete, and empty genre states; desktop/mobile human controls and WebMCP parity are verified.
- [ ] Required typecheck, lint, build, and focused tests pass; unrelated baseline failures, if any, have explicit attribution.
- [ ] Live Apple verification is evidenced or explicitly reported as an unresolved completion limitation, not passed by implication.
- [ ] All introduced metadata, route, and fixture consumers compile without new unsafe escapes; lifecycle helpers are documented.
- [ ] Review findings are resolved; the handover names remaining limits and makes no exhaustive-catalog claim.

Dispatch seed: implement the core personal-library contract in this file, sequentially S0–S5, after recording D01. Read only the literature packet and affected code; follow the write ownership and guardrails. Begin with provider metadata and contract validation, not merely re-adding the menu row. Record artifacts at the exact paths above. Do not include the Draft catalog extension without updating this scope. Current dispatch status is **Guarded** because live relationship/installed-source validation remains and the scope-choice question has not been answered; do not label the work Ready until those gaps are resolved or explicitly retained as guarded assumptions.
