# Dispatch — playback control fidelity and full click-wheel quadrants

Status: **Ready**

## Mandatory reading

Read `../playback-fidelity-scope.md` and every item in its literature packet before
editing code. Treat `../research/playback-bars-quadrants-pm.md` and the latest owner
direction as binding. Do not reconstruct scope from prior reviews.

## Implementer

One design engineer owns both slices sequentially because panel state/rendering and
physical input evidence converge in shared integration tests. Load and follow:

- `modern-web-guidance` first;
- `interface-craft` (design critique and motion);
- `web-design-guidelines` with freshly fetched rules;
- `interface-design-guardrails`, except generic no-gradient advice cannot override
  the photographed Aqua material;
- `jotai-state` and `global-patterns`.

## Correctness target

Implement every item in the scope Definition of Done: one shared 14px cylindrical
Aqua material for playback, loading, and volume; the photographed volume
replacement with Jotai-owned dwell; stable upper layout; and full 90-degree
cardinal annular sectors compatible with movement-based wheel rotation. The
owner's latest material correction supersedes the earlier 9px/14px split and
three-stop hard-banded fill.

## Likely write scope

- `packages/panel/src/Panel.tsx`
- `packages/panel/src/panel.css`
- `packages/panel/src/aqua-material.test.ts`
- `packages/panel/src/Panel.integration.test.tsx`
- `packages/panel/e2e/panel.e2e.ts`
- `packages/panel/src/runtime.ts` and its existing test only if the existing timer
  seam must be extended
- `packages/state/src/contract.ts`
- `packages/state/src/internal.ts`
- `packages/state/src/store.ts`
- existing state tests and barrel exports when required by the canonical state API
- `packages/device/src/click-wheel-input.tsx`
- existing device input unit/integration tests
- `packages/composite/src/CompositeDevice.integration.test.tsx` only to prove
  end-to-end no-double-action behavior
- existing production-device E2E only when required for the specified captures
- `../decisions-playback-fidelity.md`
- `../diary/playback-fidelity-pass.md`
- `../evidence/playback-fidelity/`

Stop and report before changing provider/server/auth/navigation implementation or
any file outside this list.

## Acceptance criteria

- Follow the exact geometry, state priority, dwell, ARIA, boundary, and evidence
  contract in the PM memo.
- Treat the new attached Aqua specimen as the primary material source. All three
  bars are 14px high; determinate and volume share the same five-stop cylindrical
  fill; loading layers the same cylinder lighting over its ribs; and no hard dark
  bottom fill row may remain. The trough must use separate cast-shadow,
  molded-lip, inner-seam, and concave-channel layers; `border: 1px solid` is not
  an acceptable substitute.
- Shared Jotai state makes transient volume visibility and revision/dismissal
  inspectable outside React; no component-only state.
- A timer has one owner, uses an injectable/testable timing seam, cancels on every
  dismissal/unmount path, and cannot let an older expiry hide a newer dwell.
- The whole annulus is mapped by angle and radius, not by distance to label glyphs.
  Boundary ownership is deterministic and tests cover all four diagonal seams.
- A tap and a rotation cannot both be accepted for the same pointer sequence.
- Existing queue, scrub-confirmation, Menu, loading-dismissal, playback selection,
  and transport tests remain green.
- Visual quality facets after implementation: period authenticity 5/5, material
  depth 4+/5, input confidence 5/5, screen cohesion 5/5, crafted restraint 4+/5.

## Required verification

- `bun test packages/state/src/store.test.ts`
- `bun test packages/device/src/click-wheel-input.test.tsx packages/device/src/click-wheel-input.integration.test.tsx`
- `bun test packages/composite/src/CompositeDevice.integration.test.tsx`
- `bun test packages/panel/src/aqua-material.test.ts packages/panel/src/Panel.integration.test.tsx`
- `bunx --bun tsc --noEmit -p packages/state/tsconfig.json`
- `bunx --bun tsc --noEmit -p packages/device/tsconfig.json`
- `bunx --bun tsc --noEmit -p packages/composite/tsconfig.json`
- `bunx --bun tsc --noEmit -p packages/panel/tsconfig.json`
- `bunx --bun playwright test --config packages/panel/playwright.config.ts`
- the scoped production-device Playwright capture cases used by the existing route
- `bun run lint`
- `bun run gates`
- `bun run build`
- `git diff --check`

Inspect all modified files for type escapes, lint disables, missing major-function
documentation, stale 5px/9px/7.75px geometry assertions, unequal bar heights,
three-stop hard fill bands, uniform border-only troughs, and radius-26 label-disk
assumptions. Record every command and exact evidence path in the diary.

## Required evidence

Generate the full canonical/prod screenshot matrices, equal-LCD-height comparison
board, deterministic volume timing trace, bar pixel/geometry manifest, and quadrant
boundary/no-double-action trace required by the PM memo under
`../evidence/playback-fidelity/`. Visual proof must use existing product/test routes;
do not add a proof-only route or API.

## Review loop

Keep the implementer available after handoff. A separate PM and separate
antagonistic reviewer inspect the diary, current diff, source photos, deterministic
evidence, full screenshot matrices, type/lint output, and every acceptance item.
Any Critical or Major finding returns verbatim to the implementer. No implementation
agent may self-approve.

## Repo-law bypass

No Neuve or Kanban command is run. Repository law explicitly defines workstream
artifacts as the initiative tracker.
