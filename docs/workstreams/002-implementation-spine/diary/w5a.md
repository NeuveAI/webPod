# W5a diary — static correctness gate harness

## Scope held

Owned only `scripts/gate-core.ts`, `scripts/gates.ts`, `scripts/gates.test.ts`, and
this slice's diary, decisions and evidence. I did not edit, delete, stage, format
or commit `scripts/w4-*`, `scripts/w4-rig.json`, shared packages or lock files.

## Sources read before implementation

Read `AGENTS.md`, the full W5 dispatch and full 002 scope, dependency graph,
decision log, HITL decisions, review system, review lanes and tracker, plus 001
§15.0–15.3 and the global-patterns skill. Its `agent-context` path is stale, so
Bun behavior was grounded in these exact files under
`/Users/vinicius/code/agentic-context/bun`:

- `docs/guides/process/spawn.mdx`
- `docs/guides/process/spawn-stdout.mdx`
- `docs/guides/process/spawn-stderr.mdx`
- `docs/guides/test/run-tests.mdx`
- `docs/test/writing-tests.mdx`
- `docs/runtime/glob.mdx`
- `docs/snippets/cli/run.mdx`

## What landed

`bun run gates` runs typecheck, lint, tests and every static predicate without
stopping after the first failure. The runner is part of `scripts/tsconfig.json`,
so the code reporting typecheck success is itself typechecked.

The first review found that the original harness was too literal in the wrong
places: it scanned broad prose while executable forms escaped, exempted itself,
and counted manually unresolved checks as clear. The revised harness uses parsed
TypeScript/JSX and authored-content scanning:

- U8 scans authored strings and JSX text for ordinary authorization vocabulary,
  while allowing only the exact required `permission-denied` state token.
- U9, U10, provider branching, tool returns, flip failure paths and tier
  branching inspect executable syntax, including destructuring, uppercase React
  components, rejection callbacks and method-based tier checks.
- CSS/HTML authored content is scanned while truthful comments remain legal.
- The harness is subject to its own laws; there is no blanket self-exemption.
- Credential hygiene scans all tracked working-tree artifacts, including docs
  and evidence, but emits only path, line and a generic signature label. It
  neither opens `cert/` nor prints matching source.
- U14 and U15 are manual outstanding checks, never automated successes.

## Red before green

Every mutation creates a fresh temporary repository, asserts the exact edit
landed, then proves the intended gate turns red. The suite includes every one of
the review's 14 adversarial mutations plus command propagation and false-positive
controls.

Result: 35 pass, 0 fail, 269 assertions. See
`evidence/w5a-planted-failures.txt`.

## Live-tree result

The focused harness typechecks, lints and passes all tests. The live-tree run is
not made green by suppressing foreign work. Its exact anchored result, including
concurrent W6 type/test failures and the two remaining static violations, is in
`evidence/w5a-live-gates.txt`.

## Git discipline

The original implementation was `2d65f7a`; semantic review fixes landed in
`11ff1ad`. Exact-path `git commit --only` was used, no commit has a trailer, and
no foreign staged work was swept.
