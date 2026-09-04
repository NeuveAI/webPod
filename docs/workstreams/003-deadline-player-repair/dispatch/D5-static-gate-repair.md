# D5 dispatch — restore static gate 16/16

## Objective

Restore `bun run gates` to 16/16 without weakening the product's autoplay/protected-playback diagnostics or broadening an exemption beyond the narrow verified diagnostic surface.

## Required reading and boundaries

- Follow `/AGENTS.md`, `../scope.md`, and the existing static-gate evidence and implementation.
- Load `global-patterns` before editing.
- Reproduce the current U8 failure first and identify why development-only diagnostic state such as `autoplay-denied` is being classified as forbidden production autoplay behavior.
- Prefer a structural, auditable classification or a tightly scoped exemption with regression plants. Do not rename useful diagnostics merely to evade text matching, delete the diagnostic, or globally relax U8.

## Owned surfaces

- static quality-gate scripts/tests/fixtures
- `apps/web/src/apple-playback-diagnostics.ts` only if the correct solution requires an explicit typed diagnostic boundary
- `docs/workstreams/003-deadline-player-repair/diary/d5.md`
- `docs/workstreams/003-deadline-player-repair/evidence/d5-*`

Do not touch D0 certificate code, D1 playback/provider/panel code, D2 styles/list primitives, `cert/`, `.neuve/`, or `.neuve-artifact/`.

## Verification

- `bun run gates` reports 16/16.
- A planted real autoplay violation still fails U8, and the exact intended development diagnostic passes.
- Run gate unit tests, affected typecheck/lint, and build if production source changes.
- Do not commit. Record evidence and report paths/risks/proposed commit.
