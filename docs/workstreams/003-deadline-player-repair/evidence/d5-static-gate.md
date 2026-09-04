# D5 evidence — U8 typed diagnostic classification

**Captured:** 2026-09-03
**Source posture:** shared working-tree snapshot; no immutable commit identity claimed
**Credential posture:** no credential file was opened and no credential contents were printed

## Reproduction

- `bun run scripts/gates.ts --static-only` before D5 — U8 failed on
  `apps/web/src/apple-playback-diagnostics.ts` lines 3 and 53.
- The same run exposed one unrelated, concurrent D0-owned credential-signature
  finding in `packages/server-core/src/apple-developer-token.test.ts`. D5 left
  that surface untouched.

## Behavioral evidence

`bun test scripts/gates.test.ts` after D5:

- 60 pass;
- 0 fail;
- 703 assertions.

The focused plants establish:

- the exact `ApplePlaybackErrorClass` and `classifyApplePlaybackError`
  diagnostic structure passes;
- visible autoplay permission copy in that same module fails;
- `autoplay-denied` in another production module fails; and
- the browser error phrase outside the classifier predicate fails.

## Quality checks

- `bunx --bun tsc --noEmit -p scripts/tsconfig.json` — clean.
- `bun run typecheck` — 11/11 projects clean.
- `bun run lint` — clean.
- `git diff --check` — clean across the shared working tree.
- `bun run gates` — the runner invokes `bun test --timeout 30000`; 1,243 tests
  pass with 78,439 assertions, and the final summary reports 16 automated pass,
  0 automated fail, and two explicit manual checks.

## Runner timeout regression control

- Installed Bun reports that `--timeout` sets a per-test millisecond ceiling and
  defaults to 5,000 ms.
- The shared-tree NAMING fixtures were observed at 8–11 seconds under load.
- `TEST_TIMEOUT_MS` is bounded at 30,000 ms and the command table is asserted to
  contain exactly `bun test --timeout 30000`.
- The pre-existing planted failing test still makes the TESTS command gate red;
  the timeout does not alter assertions or suppress failures.

## Scope integrity

D5 changed only the static gate implementation, command definition, runner
wiring, tests, and these D5 diary and evidence artifacts. It did not edit D0,
D1, D2, D4, `cert/`, `.neuve/`, or `.neuve-artifact/` surfaces.
