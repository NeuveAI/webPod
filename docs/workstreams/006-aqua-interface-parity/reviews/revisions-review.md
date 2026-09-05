# Review: owner material and direct-manipulation revisions

## Verdict: APPROVE

No Critical or Major findings remain.

## Correctness review

- **Channels:** native light/dark captures show a shallow, low-contrast recess with a translucent-looking edge and soft inset/cast. The glossy fill remains readable without the rejected opaque metallic perimeter. The HTMLTexture transfer correction is untouched.
- **Marquee:** the 2s delay now leads directly into movement. Deterministic browser sampling proves negative displacement by 2.8s for both the selected list title and Now Playing title. Text changes remount the moving copy, fitting text remains stationary through overflow measurement, and reduced motion disables the animation.
- **Selection:** the real product browser test performs double-click, triple-click, and drag selection attempts on the outer device help label and the LCD header/body surface; document selection remains empty. The actual search input still reports `user-select: text`, supports Select All, and edits normally. The implementation uses scoped CSS rather than blanket event cancellation.
- **Scrub:** fill endpoint, marker center, full-precision fill percentage, elapsed/remaining labels, `aria-valuenow`, and the exposed position all derive from one optimistic wheel value. Recorded samples cover forward/backward changes, 0 and duration endpoints, a deliberately stale provider clock, delayed commit, obsolete rejection, current rejection rollback, eventual success, and Menu cancellation. The revision guard prevents an obsolete seek failure from overwriting a newer preview.
- **Scrollbar:** native top/middle/bottom captures in both themes show the requested narrow neutral, unstriped trough and simple blue thumb. Browser geometry proves the thumb remains inside the 183px track, including the minimum-size bottom endpoint. Existing short-list absence and compact/medium/airy checks preserve capacity and large-type behavior.
- Changes remain within the authorized panel, product presentation, deterministic test fixture, and workstream evidence surfaces. No provider/auth/server behavior, dependency, route, state architecture, or HTMLTexture behavior changed.

## Independent verification

- `bunx --bun playwright test --config apps/web/tests/playwright.config.ts player-direct-manipulation.e2e.ts` — pass, 6/6 against one immutable product snapshot.
- `bun test packages/panel/src` — pass, 122 tests. The implementer's broader affected-package run records 422 passing tests.
- `bun run typecheck` — pass, 11/11 projects.
- `bun run lint` — pass.
- `bun run build` — pass; pre-existing large-chunk advisory only.
- `git diff --check` — pass.
- Reviewed `scrub-delayed-samples.json`, all revised material captures, the three owner defect captures, and the original HEIC references directly.
- No new `useState`, type escape, lint disable, credential access, package dependency, commit, push, or proof-only route was found.

The earlier browser run that overlapped a changing served snapshot was discarded as invalid. The final verification above used stable source with no concurrent browser or source mutation.

Neuve/Kanban commands were not run because this repository's standing law says that workflow is unavailable.
