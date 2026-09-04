# D1 dispatch — playback/data truth and stable-selection preparation

## Objective

Implement the playback/data correctness contract in `../scope.md`: selected metadata survives pending and failure states; Apple artwork/data resolve honestly; and a stable selection begins safe preparation after exactly 700 ms.

## Required reading and skills

- `/AGENTS.md`
- `../scope.md`, `../review-lanes.md`
- `../../002-implementation-spine/handover-current.md`
- `../../002-implementation-spine/evidence/musickit-diagnostic-contract.md`
- Load `global-patterns`, `modern-web-guidance`, and `jotai-state` before editing.
- Ground MusicKit assumptions in the checked-in empirical evidence and `~/code/agentic-context/`, never recollection.

## Owned surfaces

- `packages/providers/src/provider.ts`
- `packages/providers/src/apple/**`
- fixture provider files only if required by an interface change
- `packages/panel/src/Panel.tsx`
- `packages/panel/src/navigation.ts`
- `packages/panel/src/runtime.ts`
- directly associated deterministic tests
- `docs/workstreams/003-deadline-player-repair/diary/d1.md`
- `docs/workstreams/003-deadline-player-repair/evidence/d1-*`

Do not edit `packages/panel/src/panel.css`, `list-view.tsx`, `list-scroll-indicator.tsx`, any certificate/runtime-fix file, or `.neuve*`.

## Mandatory behavior

- Preserve the exact selected queue occurrence in a pending Now Playing model before awaiting provider playback.
- Keep metadata/artwork visible with inline loading/error state if playback rejects, times out, or emits a later authoritative failure.
- Reconcile confirmed metadata only from authoritative provider state/events.
- Start dwell work at 700 ms, cancel/ignore stale selection and route work, coalesce identical work, use low-priority fetch where supported, and clean up timers/subscriptions.
- Metadata and artwork prefetch may run broadly; MusicKit queue preparation runs only when truly idle and must not disturb a current/paused item.
- Use only public `setQueue` semantics. Do not fetch protected media directly and do not expose an exact buffered-seconds promise in API or UI.
- Ensure pressing Select reuses a matching prepared intent safely or falls back to the existing serialized playback path.
- Eliminate fixture/default artwork and invented count leakage from the Apple-backed home/browser path. Use an explicit neutral empty state when live art is unavailable.

## Verification

- Add deterministic clock/fake-timer coverage for 699 ms/no work, 700 ms/work, selection change cancellation, route change cancellation, and active-playback non-interference.
- Cover playback reject/timeout/event error while asserting song identity remains rendered.
- Run affected tests, affected project typechecks, lint, and build. Record commands and sanitized outcomes in evidence; never record tokens, URLs, identifiers, or key data.
- Do not commit in the shared tree. Report changed paths, residual risk, and a proposed path-scoped commit message.
