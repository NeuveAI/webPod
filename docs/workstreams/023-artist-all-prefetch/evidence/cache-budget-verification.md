# Cache budget verification

Read modern-web-guidance and executed its search with bunx (repository bun-only rule). Search returned generic performance guidance and a stale-skill notice; it supplied no standardized memory-cache size. Budget rationale uses the official browser references in cache-budget.md. The prescribed reference directory and global-patterns reference file remain absent; no new library API is used.

Focused checks:

- `bun test packages/music-management/src/cache-budget.test.ts packages/panel/src/bounded-async-cache.test.ts`: 16 pass / 64 assertions.
- `bunx tsc --noEmit -p packages/music-management/tsconfig.json`: pass.
- `bunx eslint packages/music-management/src/bounded-async-cache.ts packages/music-management/src/relationships.ts packages/music-management/src/cache-budget.test.ts`: pass.

Tests cover LFU byte eviction, byte replacement/shrink, TTL, clear, stale value ownership, idempotent multi-owner pin release, oversized active results, preserving smaller reusable values, speculative-vs-foreground priority under entry and byte pressure, incremental page measurement, zero repeated measurement during 100 snapshot reads, unique replacement accounting, partial page failure/retry, nested artwork/string/array estimation, cycles and invalid budgets. Existing count-only cache tests still pass.

No broad root suite or live browser mutation was performed by this lane. Lead owns live DevTools proof; independent reviewer owns final cache review.

Independent reviewer found the source's artist flattening used cache.complete after awaited child load, which becomes false after oversized child eviction. Added loadResult returning completion before release; main implementer owns source wiring and tiny-budget integration regressions. New cache test proves completed result remains complete after eviction. Updated focused count: 17 pass / 67 assertions; package typecheck passes.
