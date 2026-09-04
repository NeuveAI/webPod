# D5 independent review — static U8 diagnostic boundary

**Date:** 2026-09-03
**Reviewer:** `/root/d5_gate_review`
**Verdict:** Approved
**Counts:** 0 Critical · 0 Major · 0 Minor

## Scope reviewed

- `scripts/gate-core.ts`
- `scripts/gate-commands.ts`
- `scripts/gates.ts`
- `scripts/gates.test.ts`
- `apps/web/src/apple-playback-diagnostics.ts` as the unchanged diagnostic contract the gate classifies
- `dispatch/D5-static-gate-repair.md`
- `review-lanes.md`

No source was edited during review. The reviewer did not inspect anything under
`cert/` and did not modify concurrent D0, D1, D2, or D4 work.

## Verdict rationale

The U8 exception is structural and narrowly auditable. It does not skip the
diagnostic file or globally exempt autoplay vocabulary. A string is exempt only
when it is in the exact Apple diagnostic module and has one of three shapes:

1. the exact `autoplay-denied` literal type inside the named
   `ApplePlaybackErrorClass` type alias;
2. the exact `autoplay-denied` literal returned directly by the named
   `classifyApplePlaybackError` function declaration; or
3. the exact browser error phrase as the sole argument to an `includes` call
   directly inside that named function declaration.

The nearest function-like ancestor check is important: a nested callback does
not inherit the enclosing classifier exemption. The path and declaration-shape
checks also fail closed if the diagnostic contract is renamed or refactored.
That coupling is intentional and preferable to a permissive text or directory
allowlist.

All other authored strings continue through the existing U8 matcher. Real
permission/autoplay prose in the same file remains red, and the diagnostic
token outside the exact typed/function boundary remains red.

## Completion-correction review

The acceptance runner now imports its command table from the side-effect-free
`scripts/gate-commands.ts` module. Its TESTS entry is exactly
`bun test --timeout 30000`. This changes only Bun's bounded per-test timeout;
it does not filter test paths, retry failures, alter assertions, swallow output,
or convert a nonzero child exit into a pass. `commandGate` still waits for the
child exit code and returns a failing gate for every nonzero result.

The 30-second ceiling is proportionate to the observed 8–23 second Git-fixture
tests under shared-host contention while remaining finite. A deterministic
runner-contract test locks both `TEST_TIMEOUT_MS === 30_000` and the complete
four-element TESTS command. The existing planted assertion failure is executed
through the real runner and still produces exit code 1 plus `FAIL   TESTS`.

## Adversarial checks

In addition to the committed regression plants, the reviewer ran an isolated
temporary-fixture matrix through the real `runStaticGates` implementation. The
exact intended contract passed, while all six adversarial forms failed U8:

- top-level permission copy in the diagnostic module;
- the browser phrase inside a nested callback;
- an `includes` call with an extra argument;
- an arrow-function classifier with the expected variable name;
- the diagnostic token in a differently named type alias; and
- a computed `['includes']` call.

The committed tests separately prove that visible permission copy in the
diagnostic module fails, the diagnostic token in another production module
fails, and denial prose that is not an `includes` predicate fails. Within U8's
authored-literal threat model, trivial syntax reshaping does not broaden the
exception.

## Verification

- `bun test --timeout 30000 scripts/gates.test.ts` before the completion
  correction — 59 pass, 0 fail, 701 assertions.
- Exact `bun run gates` after the completion correction — exit 0; 1,243 tests
  pass, 0 fail, 78,439 assertions; final summary is 16 automated pass,
  0 automated fail, and 2 explicit manual checks.
- The aggregate run includes 60/60 gate-runner tests and 703 assertions,
  including the exact timeout-command contract and planted failing-test
  propagation.
- `bun run scripts/gates.ts --static-only` after the D0 fixture correction —
  13 automated pass, 0 automated fail, U14/U15 explicitly manual.
- Reviewer adversarial temporary-fixture matrix — 7/7 expectations pass: one
  intended boundary pass and six intended U8 failures.
- `git diff --check` across the D5 gate implementation, runner wiring, tests,
  and review record — clean.

An initial run using Bun's default five-second per-test ceiling completed 56 of
59 tests and timed out in three pre-existing, non-U8 NAMING mutation loops.
Those same tests took approximately 11–23 seconds under shared-host contention.
The bounded runner correction addresses that execution variance without hiding
real failures, as proven by the planted red test and the exact green aggregate
run.

## Residual risk

The gate recognizes an exact source path and exact declaration names. A future
diagnostic refactor will require an intentional gate-contract update; otherwise
U8 will fail closed. No broader production-copy blind spot was introduced by
D5.
