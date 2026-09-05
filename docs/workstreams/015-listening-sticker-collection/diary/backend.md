# Backend implementation diary

## Neutral checkpoint, 2026-09-06

Read complete implementation-scope.md before source work, plus backend skills and canonical references recorded in backend-research.md. No cert/.env contents read, no secrets in evidence. No commits made; independent review pending. Authentication strategy remains an owner decision; no auth/storage identity invented.

Implemented `packages/stickers` client-safe catalogue, shared inventory/observation/placement types and input/response validators. Catalogue URL contract `/stickers/playworn/<genre>/<file>` coordinated with surface-owned public copy. Geometry uses BODY_W/BODY_H and visible bounds with one placement per owned sticker/max12.

Implemented `packages/server-core/src/stickers/{schema,database,policy,repository,apple-import,service,http,stickers.test}.ts`: explicit SQLite additive migration factory, typed Drizzle queries, immediate synchronous transactions, genre taste/starter policy, elapsed observation ledger, idempotent rewards/opening, versioned placement writes, bounded metadata fetching and catalogue enrichment, scoped Effect storage layer/managed runtime, injected-auth thin HTTP transport. No Start routes yet because production session resolver and identity choice remain outstanding.

Updated provider `apple-provider.ts`: authorization returned token remains private; public Session.userIdentifier is null. New `withMusicAuthorization(consume)` lets browser integration POST directly without publishing credentials in state. Restore supports MusicKit.musicUserToken; sign-out drops private fallback only after SDK success. Existing provider test now verifies public serialization omits synthetic credential and private callback works.

Dependencies exclusively coordinated here: @webpod/stickers workspace for web/server/device/state, drizzle-orm 0.45.2, @tanstack/query-core for UI runtime and direct @webpod/state app dependency. Bun install initially failed because existing repo dependency ranges were blocked by 10-day minimum-release-age. Lead authorized per-invocation `bun install --minimum-release-age 0`; existing package versions unchanged, scoped additions only. No global Bun config change.

Verification: `bun test packages/server-core/src/stickers/stickers.test.ts packages/providers/src/apple/apple-provider.test.ts`: **72 pass**, 0 fail, 254 assertions. Includes real SQLite restart, ownership denial, duplicate requests and two-tab elapsed cap, seek/pause/stale gaps, threshold crossing, placement bounds/revision, fixed-host pagination, bounded HTTP body, no unauthenticated/cross-origin access, Effect lifecycle. `bunx --bun tsc --noEmit -p packages/server-core/tsconfig.json`: pass. Targeted ESLint initially caught unused removed session argument; removed it and reran. Full evidence in evidence/backend/neutral-*.txt.

Outstanding: independent checkpoint review; identity choice and session storage; Start route/runtime wiring; production architecture/setup documentation; additional HTTP/auth tests and full integration verification. Import currently synchronous and capped (25x100 rows, 30 sec), avoids token persistence; background processing/progress needs final auth/runtime contract. Repository neutral methods trust internal typed input; HTTP parser is public input boundary. Active-track enrichment supports tracks absent library via fixed Apple catalogue endpoint.

## Backend review patch B1–B4

Read full reviews/backend-review.md and preserved REQUEST_CHANGES pending independent re-review. B1: source=library membership now merges into previously catalogue-enriched rows and survives complete/partial retries. B3: independent catalogChecked provenance permits one authoritative repair of unknown library genres; successful unknown catalogue resolution suppresses repeated per-observation enrichment. HTTP uses needsEnrichment, and both paths merge stronger known metadata without erasing catalogue duration or library membership. Added additive schema v2 migration, repeat/reopen/v1-upgrade and future-version rejection checks.

B2: starter filters already owned eligible first-tier art. Supported taste consumes the single starter evaluation even when all eligible first art is owned; that case produces no empty pack or higher-tier substitute. No supported taste remains pending. Mixed late starter, all-owned late starter and changed-taste/retry regressions cover this contract. B4: aliases use Object.hasOwn and inherited property names resolve null.

Also replaced opening timestamp read/overwrite with SQL coalesce for an atomic first-open timestamp. Documented all-or-nothing snapshot handling for later-page failures, retaining persisted taste/grants and setting explicit failed status. Added later-page 429, repeated cursor, malformed page, response byte ceiling, hard-page partial snapshot and HTTP unknown-enrichment no-loop tests. No authentication scheme or Start routes added, and no existing user database opened/migrated.

Patch evidence: evidence/backend/review-fixes-tests.txt, review-fixes-typecheck.txt, review-fixes-lint.txt. Requested checks: `bun test packages/server-core/src/stickers/stickers.test.ts packages/providers/src/apple/apple-provider.test.ts`, server-core tsc, scoped ESLint. No commits.

## Approved neutral handover

Independent re-review approved the neutral backend lane with 81 passing tests/297 assertions and independent scoped types/lint. Added backend-handover.md and docs/architecture/sticker-backend.md documenting exact implemented versus pending boundaries. Updated AGENTS.md standing facts to the owner's canonical reference location and existing TanStack Start routing/server glue. Lead authorized committing this reviewed slice, including coordinated device/state/app package dependencies and lockfile while excluding their UI/surface implementation. No authentication scheme or production sticker route is claimed complete.
