# D1 verification — playback/data truth and stable-selection preparation

**Captured:** 2026-09-03
**Source posture:** shared working-tree snapshot; no immutable commit identity claimed
**Credential posture:** no credential file was opened, no private material was copied, and no live account was used

## Behavioral coverage

The deterministic tests prove:

- no dwell work at 699 ms and work begins at 700 ms;
- changing selection cancels stale dwell work;
- route cleanup aborts active work and clears its timer;
- identical colourway leases coalesce;
- exact duplicate-track occurrence and start index survive preparation and selection;
- a stale same-catalog item at another queue index remains pending even after the transport promise resolves, until the requested occurrence is reported;
- matching idle Apple preparation coalesces and is reused by playback;
- completed and in-flight preparation identities are invalidated by station, append, insert-next, skip, shuffle, and unrelated external queue changes;
- prepared intent is reused only when the observable queue/container and start position still match;
- playing and paused current items are not disturbed;
- an already-cancelled preparation intent never reaches MusicKit;
- relationship data prefetched during dwell is reused at selection;
- rejected, timed-out, and later authoritative playback failures retain the selected or confirmed song metadata and artwork;
- the mounted center-button flow keeps the selected occurrence on Now Playing after playback rejection;
- home artwork comes from the provider and missing art renders a neutral state.

## Commands and sanitized outcomes

- `bun test packages/panel/src/Panel.integration.test.tsx packages/panel/src/Panel.test.tsx packages/panel/src/runtime.test.ts packages/panel/src/navigation.test.ts packages/providers/src/apple/apple-provider.test.ts packages/providers/src/stub.test.ts` — 162 pass, 0 fail, 483 assertions.
- `bun run typecheck` — 11/11 TypeScript projects clean.
- `bun run lint` — clean.
- `bun run build` — production client and server builds completed successfully.
- Client-output scan for server credential names, private-key markers, filesystem APIs, and key-format terms — no matches.
- `git diff --check` — clean.
- `bun test scripts/gates.test.ts --timeout 15000` — 55 pass, 0 fail, 673 assertions. This isolates three default-timeout failures seen during the first full-suite pass and confirms they were slow fixture-process tests rather than D1 behavior failures.
- `bun test --timeout 15000` — 1,242 pass, 0 fail, 78,437 assertions across 87 files.

## Boundary assertions

- The client receives no signing key and no token-minting responsibility.
- Preparation uses the public provider/MusicKit queue surface only.
- No protected audio resource is fetched by panel prefetch.
- The preparation API makes no exact buffering or audible-start guarantee.
- Artwork fetch priority is advisory; stale-work cancellation and ignored results enforce correctness.

## Timeout note

The first full-suite run used Bun's default per-test timeout and reported three timeouts in slow static-gate fixture processes. All product and D1 behavior tests passed in that run. Re-running the static-gate file at 15 seconds produced 55/55 passing tests. After the independent-review corrections and concurrent static-gate stabilization, the complete extended-timeout suite produced 1,242/1,242 passing tests.
