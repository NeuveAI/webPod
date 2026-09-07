# WebMCP interaction tools

Status: Complete for requested tools; both phases independently approved. Final evidence and explicit unrelated repository-wide failures are in evidence/final-checks.md. Owner request: current task, 2026-09-07.

## Correctness and source precedence

Expose the production music player's actual interactions through the current WebMCP imperative API. The owner's requested behavior is primary. The local WebMCP specification and matching current official draft define protocol correctness. Installed library sources define library behavior. Existing code describes integration seams but does not override this request; in particular its silent-agent policy is superseded for these tools. Other workstreams are not assigned literature.

Required source packet: `evidence/spec-research.md`, with exact local revisions, API/type sources, available eval commands, and current-draft comparison. No invented backend MCP transport or protocol envelopes. Use `document.modelContext`, asynchronous registration and registration AbortSignal cleanup per the inspected draft. Unsupported browsers must retain normal human operation without a fake native registry.

## Acceptance criteria

1. List navigation accepts direction and positive integer item count, describes these inputs, and returns requested/actual traversal and destination. Traverse one item per paced step through shared input actions, with acceleration for longer distances and a strict maximum of five items per second (no catch-up bursts). Clamp at list boundaries. Make in-flight direction, requested/completed items and timing observable. Test interruption, cancellation, simultaneous calls, list replacement and teardown.
2. List status returns `selectedItem` (item and zero-based position, or null) and `items` (the complete current list, including the selected item) as separate attributes, plus count. Never silently return only the visible window. Empty/non-list states must be explicit.
3. Select-current-item invokes the same center/select path used by people, including SFX, and reports the resulting navigation/readiness without guessing a delay. Empty/blocked states return actionable failure.
4. Page state reports interaction readiness, loading/buffering/error state, elapsed wall-clock duration from the actual operation start, and progress percentage only where a real denominator exists (otherwise null). Loaded counts and independent background loading may be reported separately. Polling must be read-only and must not reset clocks. Cover already-loading mount, completed/error transitions and provider replacement.
5. Globally expose all five wheel buttons: menu, previous, next, play-pause, center. Share the production control handlers, transport semantics and accepted-action SFX; preserve agent attribution. Respect hold/mute and actual browser audio constraints. Do not emulate clicks by bypassing shared semantics or pretending tool events are trusted human events.
6. Rotate iPod by finite x/y degree deltas using the production orientation owner (x=pitch, y=yaw). Return actual clamped orientation. Flick to front/back through the existing physical orientation motion path; report actual face/settlement. Keep human controls operational.
7. Sticker tools are last: open/close pack UI; next/back collection; complete sticker list with metadata and owned/available states; grab/hold from collection or existing placement; release restores origin; rotate held sticker by degrees; add wear by amount; place at x/y. Use existing catalog, editor, interaction and persistence commands. Coordinates and wear units must explicitly follow existing model contracts. Do not consume/award purchases by merely opening UI. Do not invent owned stickers or bypass availability.
8. Tool schemas validate runtime inputs including non-finite/out-of-range values, unknown fields and invalid identities. Descriptions explain units, indices, mutation and prerequisites. Read-only annotations are truthful. Registration handles duplicate mount/failure rollback and cleanup. Execution cancellation and in-flight action ownership are bounded.

## Decisions and assumptions

- D1 (owner): tool SFX must match human interaction; prior comments/tests requiring silent agent interaction are legacy and must be updated for this explicit capability while preserving system silence and truthful provenance.
- D2 (default): positions are zero-based; rotation uses degree deltas; navigation is directional and clamped, never wrapping. Tool descriptions must state this.
- D3 (owner): stickers are implemented last, after initial tools and review. Concurrent sticker edits are protected; recheck working tree and interaction contracts before the sticker phase.
- D4 (default): unknown progress is null, never fabricated time-based percent. Observe existing state and subscriptions rather than add network polling or delay heuristics.
- D5 (default): feature-detected native API only. No legacy navigator API unless current-source evidence demonstrates a necessary, spec-consistent adapter and lead records the decision.
- D6 (default): changes remain uncommitted in the shared working tree, with granular staging plan in handover. No push, no worktree, no modification of unrelated work.

No user input blocks the initial slice. Routine bounded implementation choices may be logged in `decisions.md`; source conflicts, extra persistence semantics or destructive changes require lead escalation.

## Dependency graph and ownership

Research -> A (non-sticker tools/shared input/readiness/orientation) -> independent protocol + behavior reviews -> B (sticker adapters, after fresh concurrent-work check) -> independent final reviews -> full checks and handover.

A owns `packages/tools`, non-sticker state/composite/panel modules and tests, `apps/web/src/device-page.tsx`, new `apps/web/src/*webmcp*` integration files, package manifests and lockfile when required. `apps/web/src/production-device-view.tsx` is concurrently edited: avoid it during A; request a precise coordinated minimal seam if unavoidable. All `*sticker*` implementation files and device sticker surface files are forbidden during A. B ownership will be recorded before dispatch.

The lead scopes and supervises. Implementation belongs to implementers; review belongs to separate agents. No Kanban, Neuve shell or TaskCreate tools are available/applicable; this workstream is the durable tracker per repo law.

## Verification and definition of done

Deterministic tests are the primary proof, covering every acceptance criterion with happy and reasonable unhappy paths. Use injected clocks for pace/elapsed assertions and shared production-handler integration tests for behavior/SFX. Use the local WebMCP tools/eval utilities in the source packet; record exact commands and honest unavailable prerequisites. Native browser discovery/execution must be attempted on the existing `/` route, with no proof-only product route. Record browser version/API support and distinguish shim/unit proof from native proof.

Commands: `bun test packages/tools packages/state packages/composite packages/panel apps/web/src`; `bun run typecheck`; `bunx tsc --noEmit -p apps/web/tsconfig.json`; `bun run lint`; `bun run build`. Add source-packet eval commands once inspected. Reviewers independently run typecheck/lint and focused tests. Broad checks may identify concurrent pre-existing failures; capture attribution instead of reverting others' work.

Type/schema correctness is mandatory. Reuse canonical exported app/library types; any spec-local interface requires documented canonical source and a contract test because no installed WebMCP types currently exist. No `any`, unchecked casts, lint suppression or duplicated protocol/result shapes without a documented boundary invariant. Add TSDoc for exported/lifecycle-sensitive functions. Never use `useState`, forbidden package managers, credentials in `cert/`, or direct `design.pen` access.

Review lanes: protocol/schema/lifecycle and behavior/SFX/timing/runtime, both with strict-critique posture. Any Critical/Major means REQUEST_CHANGES and exact findings return to the implementer. Read `review-system-prompt.md`, `decisions.md`, this scope, source packet, implementer diary and proof. Use relevant global-patterns, Jotai, modern-web-guidance, React and interaction design skills; no irrelevant backend redesign.

Artifacts: `diaries/core.md`, `diaries/stickers.md`, `decisions.md`, `evidence/spec-research.md`, `evidence/core-checks.txt`, `evidence/sticker-checks.txt`, `evidence/native-evals.md`, `reviews/protocol.md`, `reviews/behavior.md`, `reviews/final.md`, `handover.md` beneath this directory. Evidence should include exact command, exit status and revision/changed-file fingerprint.

DoD: all requested tools mounted in production; spec contracts and behavior tests pass; real state and sound parity proved; no touched concurrent work lost; source-backed eval evidence recorded; final type/lint/build gates pass or attributable external limitation explicitly documented; both independent review lanes approve; handover lists public tools, units, limits, proof and coherent commit groups.

Commit plan (no commits yet): shared interactive input and readiness; native WebMCP tool registration and non-sticker tools; sticker tool adapters; contract/eval fixtures and public tool reference; workstream evidence and handover. Keep behavior tests with their feature where needed for independently verifiable groups.
