# Review: Aqua iPod interface parity

## Verdict: APPROVE

No Critical or Major findings remain.

## Correctness check

- Reviewed all nine owner photographs, both attached references, and the corrected nine-row criteria. The final surface keeps the 272×204 raster and 21px header, shows nine compact rows, uses the photographed title-only track treatment, and restores a period Aqua hierarchy in both themes.
- Compact capacity is consistently shared by panel rendering, wheel/keyboard paging, and WebMCP state. `ROW_HEIGHT_PX` derives all compact/medium/airy heights from the 183px viewport and each density's capacity.
- Queue focus uses the rendered queue cursor and an instance-scoped option ID. Standard Now Playing does not publish a stale `aria-activedescendant`.
- The HTMLTexture correction is material-scoped and applies Three's EOTF to the pinned RGBA8 upload path. Its regression exercises the real shader chunk and upload invariant.
- Production-route fixtures are awaited before navigation and use the domain-named `deterministic-apple-music.ts`; no proof-only product route was added.
- Final loading evidence visibly proves the blue/white indeterminate Aqua treatment. The square evidence artwork is an explicitly routed test crop of the repository illustration; shipped CSS uses a square border and no shadow.
- Required decisions, diary, handover, before/after matrix, native LCD crops, and command logs are present. No owner decision remains open.

## Resolved review findings

1. **Queue and non-list active descendant** — fixed in `packages/panel/src/Panel.tsx`; integration coverage proves the active ID resolves to the rendered queue option and is absent in standard Now Playing.
2. **Shared row geometry disagreement** — fixed in `packages/state/src/contract.ts`; all densities derive from 183px and compact capacity is nine.
3. **Stale eight-row sibling checks** — fixed across panel and product browser suites. The marquee probe reads canonical stationary text rather than concatenating two visual copies.
4. **Scroll-track follow-up regression** — fixed with exact tests for the full 183px, nine-pixel rail travel.

## Independent verification

- `bun run typecheck` — pass, 11/11 projects.
- `bun run lint` — pass.
- `bun run build` — pass; existing large-chunk advisory only.
- `bun test packages/panel/src packages/state/src packages/composite/src` — pass, 423 tests.
- `bunx --bun playwright test --config apps/web/tests/playwright.config.ts lcd-fidelity.e2e.ts` — pass, 4/4.
- `bunx --bun playwright test --config apps/web/tests/playwright.config.ts production-view-parity.e2e.ts` — pass, 3/3.
- `bunx --bun playwright test --config packages/panel/playwright.config.ts panel.e2e.ts --grep "standard Now Playing|120-row fixture|wheel navigation moves|Dynamic Type"` — pass, 4/4.
- `git diff --check` — pass.
- No new `useState`, type escape, lint disable, credential read, route substitution, package dependency, commit, or push was found.

Neuve/Kanban commands were not run because this repository's standing law says that workflow is unavailable.
