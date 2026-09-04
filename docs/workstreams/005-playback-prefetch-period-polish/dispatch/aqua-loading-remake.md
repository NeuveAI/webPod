# Dispatch — Aqua pending-playback material remake

Status: **Ready**

## Correctness target

Replace only the rejected pending-playback progress material with a close visual
reconstruction of the owner-supplied Aqua indeterminate reference. Preserve the
authored `236×5` progress bounds, Now Playing layout, playback semantics, and
pending-to-determinate transition.

## Binding sources

- Primary: `../aqua-loading-criteria.md`, including its authority order,
  measurable thresholds, screenshot matrix, rejection conditions, and owner
  approval requirement.
- Primary visual:
  `/var/folders/ft/7tsjkpcn20q5fx1q8dwv26x80000gn/T/codex-clipboard-975f040d-8ab9-4e31-8b80-2a8905d7fe9e.png`.
- Anti-reference:
  `/var/folders/ft/7tsjkpcn20q5fx1q8dwv26x80000gn/T/codex-clipboard-ee36f585-0b7e-4875-8759-d7ca59c5dab6.png`.
- Supporting: `../scope.md` and `../research/material-sources.md`.
- Anti-source: the current CSS and existing loose “gradient exists” assertions
  where they conflict with the acceptance contract.

## Ownership and decomposition

### Design engineer — implementation and evidence

- Likely write scope:
  - `packages/panel/src/panel.css`
  - `packages/panel/src/aqua-material.test.ts`
  - `packages/panel/e2e/panel.e2e.ts`
  - `../diary/aqua-loading-remake.md`
  - `../decisions-aqua-loading.md`
  - `../evidence/aqua-loading/`
- Must not modify playback/provider logic, Now Playing layout geometry, or any
  file outside this list without stopping and reporting the need.
- Use CSS-only transform animation; add no dependency and no React state.
- Existing tests may be strengthened; do not add an unrelated test suite.

Correctness points and verification:

1. Material construction meets every numerical threshold in the acceptance
   contract. Prove with computed-style assertions and focused material tests.
2. Loading semantics and `236×5` geometry remain stable. Prove with existing
   browser state/geometry assertions.
3. Normal motion is linear, phase-continuous, and `2.8–3.6s`; reduced motion
   freezes a representative frame without hiding the material. Prove in normal
   and emulated reduced-motion browser cases.
4. Full-screen dark/light/device captures and an equal-bar-height comparison
   board are written under `../evidence/aqua-loading/`.

### Reviewers — no implementation edits

- PM performs product acceptance against `../aqua-loading-criteria.md` and
  records a disposition in `../reviews/aqua-loading-pm.md`.
- Independent visual/code reviewer performs antagonistic review and records
  `../reviews/aqua-loading-remake.md`.
- Any Critical or Major finding returns to the still-running design engineer.

## Required skills

- `interface-craft` including design critique and storyboard animation
- `web-design-guidelines`
- `modern-web-guidance`
- `neuve-motion` reduced-motion and CSS-vs-motion guidance
- `interface-design-guardrails`, with the binding exception that generic
  no-gradient guidance cannot override the Aqua reference
- `global-patterns`

## Gates and evidence

- `bun test packages/panel/src/aqua-material.test.ts`
- `bunx --bun playwright test --config packages/panel/playwright.config.ts --grep "starting playback"`
- `bunx --bun playwright test --config packages/panel/playwright.config.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `bun run gates`
- `git diff --check`
- Visual evidence paths and comparison board required by the acceptance contract.

The designer must report every command result, changed file, visual decision,
remaining uncertainty, and exact evidence path in
`../diary/aqua-loading-remake.md`. Any reversible choice outside a stated
threshold goes in `../decisions-aqua-loading.md`.

## Definition of done and approval

The acceptance contract's seven-item definition of done is binding. Automated
checks cannot substitute for PM review, independent review, or final owner visual
approval. No commit is created; the existing dirty worktree is preserved.

## Repo-law bypass

No Neuve or Kanban command is run. Repository law declares workstream artifacts,
not a board, as the initiative tracker.
