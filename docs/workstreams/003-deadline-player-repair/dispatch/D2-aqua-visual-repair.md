# D2 dispatch — compact period iPod/Aqua presentation

## Objective

Repair the LCD's list hierarchy and controls to match the visual correctness contract in `../scope.md` while preserving navigation and the canonical eight-row geometry.

## Required reading and skills

- `/AGENTS.md`
- `../scope.md`, `../review-lanes.md`
- `../../002-implementation-spine/handover-current.md`
- the owner screenshots supplied 2026-09-03 as current-state defect evidence
- Load `modern-web-guidance`, `interface-craft`, `interface-design-guardrails`, and `web-design-guidelines` before editing.
- The requested period Aqua direction overrides generic anti-gradient advice. Use gradients with restraint and purpose.

## Owned surfaces

- `packages/panel/src/panel.css`
- `packages/panel/src/list-view.tsx`
- `packages/panel/src/list-scroll-indicator.tsx`
- presentation-only tests that do not require editing `Panel.tsx`
- `docs/workstreams/003-deadline-player-repair/diary/d2.md`
- `docs/workstreams/003-deadline-player-repair/evidence/d2-*`

Do not edit `Panel.tsx`, navigation/provider/runtime behavior, certificate/runtime-fix files, or `.neuve*`.

## Mandatory behavior

- Keep one root/nested row primitive, eight visible rows at 272×204, stable row height, ellipsis, and no layout shift between selected and unselected rows.
- Reduce the current oversized, uniformly heavy typography. Establish a compact period hierarchy with readable metadata.
- Build a restrained Aqua selection with reliable contrast in light/dark device modes and high-contrast preferences.
- Make the overflow indicator subordinate: narrow striped trough/backdrop with a distinct thumb, only when content overflows; it must not resemble a large cyan progress bar.
- Preserve keyboard, pointer, wheel, reduced-motion, reduced-transparency, and high-contrast behavior.
- Do not add arbitrary decorative pills, unrelated dashboard styling, or a second list implementation.

## Verification

- Run affected unit/browser checks, typecheck, lint, and build.
- Capture canonical-size Music root, Artists, and nested tracks in black and white device colourways, plus any preference-mode regression needed to prove contrast.
- Record evidence and a concise design rationale in `diary/d2.md`.
- Do not commit in the shared tree. Report changed paths, residual risk, and a proposed path-scoped commit message.
