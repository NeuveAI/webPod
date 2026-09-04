# Implementation dispatch

## Objective

Implement the full contract in `../scope.md`: provider-owned global transport, substantive reference-backed Now Playing center modes operated by the wheel, removal of invented action states and instruction slabs, adjacent Aqua scrollbar, and clipped overflow marquee.

## Required reading and skills

- `/AGENTS.md`
- `../scope.md`, `../dependency-graph.md`, `../hitl-decisions.md`, and `../review-lanes.md`
- `docs/workstreams/002-implementation-spine/handover-current.md`
- Load `global-patterns`, `modern-web-guidance`, `interface-craft`, `neuve-motion`, and `web-design-guidelines` before editing.
- Ground MusicKit behavior in `~/code/agentic-context/` and the exact v1 facade in this repository. Do not rely on remembered SDK behavior.
- Do not invoke a Neuve shell: repository law explicitly says none exists.

## Owned surfaces

- `packages/providers/src/**` for transport/queue contract implementation and focused tests.
- `packages/state/src/**` for typed shared input intent and tests.
- `packages/composite/src/**` for physical input routing and tests.
- `packages/panel/src/**` for Now Playing modes, queue view, scrollbar, marquee, CSS, and tests.
- `apps/web/src/production-device-view.tsx` and focused tests for provider wiring.
- This workstream's `diary/implementation.md` and `evidence/implementation-*` artifacts.

Avoid unrelated renderer, auth/token, certificate, library-fetch, WebMCP, dependency, or workstream-003 edits.

## Required implementation behavior

- Do not derive skip targets from visible list data. Delegate to the provider's current queue so shuffle, playlists, and ad-hoc queues stay correct.
- Implement explicit previous semantics: over three seconds seeks to zero; otherwise moves to the previous provider queue item.
- Root navigation pauses audible playback without clearing the current provider item/queue. When that playback context exists, next/previous and Play/Pause work from root/browse screens and return the UI to Now Playing. With no playback context, next/previous retain existing list paging.
- Replace label-only center cycling with substantive standard, scrub, artwork, and queue views; include rating or lyrics only when truthfully writable/supported. The standard view owns wheel volume and is not labeled `Volume`.
- Emit/consume wheel intent through shared Jotai state. Clamp provider writes; coalesce or serialize writes where needed; prevent stale provider and queue completions.
- Queue view calls `queueRead()`, identifies the authoritative current item/position, and scrolls within bounds using the wheel.
- Remove the bottom shuffle/repeat/heart/star/queue strip and any direct LCD buttons or fake state backing it.
- Remove every mode label/instruction slab, including `Scrub / Use the wheel to adjust` and analogous Volume/Queue bars. Express the mode through its content and control geometry, following the real-device references.
- Move the list scrollbar into a reserved sibling column beside row content. Verify both split and full-width lists.
- Add a reusable overflow-marquee primitive. Measure overflow without React component state, animate only selected/active titles using `transform`, preserve ellipsis at rest, recompute on resize/content change, and honor reduced motion.

## Verification packet

- Focused unit/integration tests for every correctness bullet in the scope.
- `bun test`, affected typechecks, lint, client/SSR builds, `bun run gates`, and `git diff --check`.
- Inspect every HEIC in `/Users/vinicius/code/tmp/ipod-reference` (convert a temporary copy if needed). Use the authenticated Chrome DevTools session for real Apple playback. Record only sanitized evidence: mode/state transitions, queue positions/counts, timings, and pass/fail. Never capture credentials, developer/user tokens, item IDs, titles, authorization URLs, or media/license URLs.
- Exercise: play, navigate root, pause/resume back to Now Playing, next, previous after >3 seconds, previous near start, center through all modes, wheel volume/scrub/queue, and long-title/reduced-motion visuals.
- Store screenshots and a concise evidence note under this workstream. Do not add a proof-only route or leave diagnostic hooks in production.

## Handoff

Do not commit. Update `diary/implementation.md`, list changed paths, commands/results, browser evidence, residual risks, and a proposed path-scoped commit message. Remain available for reviewer fixes.
