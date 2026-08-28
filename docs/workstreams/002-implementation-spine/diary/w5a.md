# W5a diary — static correctness gate harness

## Scope held

Owned only `scripts/gate-core.ts`, `scripts/gates.ts`, `scripts/gates.test.ts`, and
this slice's diary, decisions and evidence. I did not edit, delete, stage, format
or commit `scripts/w4-*` or `scripts/w4-rig.json`. I did not touch root package
or lock files; the existing `gates` script already pointed at `scripts/gates.ts`.

## Sources read before implementation

- `AGENTS.md`
- `dispatch/W5-gates.md`
- full workstream `scope.md`, `dependency-graph.md`, `decision-log.md`,
  `hitl-decisions.md`, `review-system-prompt.md`, `review-lanes.md`, `tracker.md`
- workstream 001 `pm-spec.md` §15.0–15.3
- `/Users/vinicius/.agents/skills/global-patterns/SKILL.md`

The global-pattern skill names `~/code/agent-context/global.md`; that path is
stale and no `global.md` exists at the corrected `agentic-context` root. I did
not silently fall back to recall. Bun behavior was grounded in these exact
checked-in sources under `/Users/vinicius/code/agentic-context/bun`:

- `docs/guides/process/spawn.mdx`
- `docs/guides/process/spawn-stdout.mdx`
- `docs/guides/process/spawn-stderr.mdx`
- `docs/guides/test/run-tests.mdx`
- `docs/test/writing-tests.mdx`
- `docs/runtime/glob.mdx`
- `docs/snippets/cli/run.mdx`

The live runtime reports Bun `1.4.0`.

## What landed

`bun run gates` now runs all command gates without stopping after the first
failure, then every static predicate, then prints one stable summary line per
gate. The command gates are the existing per-project typecheck sweep, repo lint
and repo Bun tests. The static gates cover U8, U9, U10, agent-presence names,
direct vibration, handedness, provider-id branching, unsupported tool returns,
flip calls in catch/error handlers, branch trailers, implementation naming,
tier comparisons outside composite, and credential hygiene. U14 and U15 are
printed as manual/reviewer gates rather than disappearing.

The runner is in the `scripts` TypeScript project, so `bun run typecheck` checks
the code that reports typecheck success. Static checks can also run against an
isolated root for deterministic mutation testing.

## Red before green

The mutation suite creates a fresh temporary git repository for every test. It
asserts each edit landed, then proves the intended gate turns red. It exercises
all thirteen static gates, a tier switch in addition to equality, plus failing
typecheck/lint/test commands. A clean fixture is tested first so a target failure
cannot be hidden by an unrelated baseline failure.

Result: 19 pass, 0 fail. See `evidence/w5a-planted-failures.txt`.

## Live-tree result

The harness itself typechecks and lints. The final live `bun run gates` is red
for five foreign-lane reasons and none were masked:

1. `bun test` discovers a Playwright spec under `packages/panel/e2e/`, which
   calls Playwright hooks under Bun's test runner and errors before its tests.
2. U9 finds three textual `useState` mentions in W4/W6 route comments.
3. HAPTICS finds a textual direct-vibration mention in state documentation.
4. HALO finds eleven generic uses of the mandated broad `handed` grep.
5. NAMING finds bookkeeping terms in composite, panel E2E, an S2 spike and the
   W4 tuning script.

Typecheck is 11/11 and lint is clean. The final-tip rerun reports 697 passing product/unit tests
before the one Playwright discovery error. Exact paths are recorded in
`evidence/w5a-live-gates.txt`.

## Git discipline

Implementation committed as `2d65f7a chore: static correctness gates` using
`git commit --only` with three exact paths. The commit has no trailer and swept
no shared-index work.
