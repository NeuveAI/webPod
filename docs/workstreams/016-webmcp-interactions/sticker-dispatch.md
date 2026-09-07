# Sticker tool dispatch

Status: Ready for adapter implementation. Both core review lanes approved. Fresh shared-tree check: the other task has committed contour controls (HEAD includes 2f1001a) and is actively changing edge-wrap acceptance in `packages/stickers/src/index.ts`, `apps/web/src/sticker-editor-model.ts`, their tests and server/state validation tests. Those files are read-only for this slice. No reverting its modified files or updating its expected behavior independently.

Read the full scope.md, decisions.md, source packet and this dispatch before implementation. This slice implements scope criterion 7 using the already-approved native boundary. Core behavior/protocol must remain intact. Implementer loads global-patterns, Jotai, modern-web-guidance and interface-craft/web-design-guidelines for shared interaction changes. Read installed/local sources when touching a library boundary.

## Owned files

New sticker tool definition/controller/adapters/tests in `packages/tools/src/` and `apps/web/src/`; integration in `apps/web/src/webmcp.ts`. Narrow registration seam in `apps/web/src/sticker-collection.tsx` is permitted because its user-facing callbacks own current UI semantics. `apps/web/src/sticker-interaction.ts` may expose a narrowly shared action only when existing public helpers cannot express the behavior. Prefer reuse to duplicate state machines. Do not edit production-device-view, editor-model/editor controls, device sticker mesh/material/hit/wear code, server routes/services or domain validation while the concurrent task owns them. If a necessary API is unavailable, report the exact seam to lead before overlapping writes.

## Tool contract and correctness

- Explicit open and close pack UI commands, using actual reveal/lower behavior; opening UI must not claim sealed packs as an unintended side effect. Report real ready/animating/unavailable result, not optimistic success.
- Navigate next/back through actual collection order and current selection; return selected collection and index. Preserve existing clamping/wrapping policy and describe it explicitly.
- Sticker list enumerates full catalog with stable id, display metadata, collection, owned/available/locked/sealed/placed state, saved placement and applicable wear. Do not omit the current selection or imply ownership when inventory is absent.
- Grab accepts sticker id and source collection/placed. Only available owned stickers can be grabbed. Simulate real carry/peel state visible in the existing scene; do not delete persisted placement at grab. A placed grab retains its exact origin for cancellation/release and optimistic conflict checks.
- Release cancels carry and returns to the exact collection/original saved placement. Draft rotation/wear/location are discarded on release; no persistence writes on cancellation.
- Rotate held sticker accepts finite degree delta. Add held sticker wear accepts finite nonnegative delta in the existing normalized wear units; clamp via canonical domain/edit helpers and report actual applied amount. Never change another sticker or bypass actual validity.
- Place accepts x/y in the existing normalized backplate coordinate system (state explicitly in schema/description), preserves held rotation/width/wear, and uses current canonical `isStickerPlacement` plus real persistence command. Do not hardcode pre-edge-wrap assumptions. Await persistence, preserve recoverable carry on failure, and pass expected original placement for conflict protection where supported. No client credentials or raw server data.
- Shared input ownership: abort, close, front-face flip, human gesture, inventory/provider replacement and unmount must not allow stale completion to overwrite newer state. A successful persistent operation cannot be undone merely because its caller later aborts. Do not manufacture browser trust. Concurrent mutable tools should have a bounded coherent policy with core mutations; reads remain usable.
- Extend page-state reporting if necessary to expose sticker preparation/persistence progress from real shared state, including unavailable data and unknown percent. No fabricated progress or new network polling.

## Verification

Add deterministic contract tests for all nine sticker tools plus mounted/shared adapter tests for real carry/source restoration, owned/locked/sealed status, collection navigation, placement/rotation/wear validation, failure/retry, stale inventory, concurrent actions and abort/lifecycle cleanup. Native eval engineer later extends `apps/web/tests/webmcp-native.e2e.ts` and `webmcp-evals.json` using existing deterministic fixture routes/network mocks only; no new product route or debug API.

Commands: focused `bun test` on new files and existing sticker interaction/model/state suites; `bun run typecheck`; `bunx tsc --noEmit -p apps/web/tsconfig.json`; scoped `bunx eslint` on every changed file; `bun run build`. Full `bun test`/`bun run lint` at final closeout with exact attribution of concurrent/existing failures. Source APIs may change during this slice: refresh canonical validation before tests and report drift.

Artifacts: `diaries/stickers.md`, `evidence/sticker-checks.txt`, append decisions.md with unique ids after D13, `reviews/sticker-protocol.md`, `reviews/sticker-behavior.md`, final `handover.md`. Every major action needs useful TSDoc. Record exact schema units and tool names for eval engineer. No commit/push; staging group is sticker adapters + related tests, followed by evals/docs. Any Critical/Major review finding blocks completion and returns verbatim to the implementer.
