# Scope — taller Aqua controls, volume feedback, and click-wheel quadrants

Status: **Ready for design-engineer implementation; owner visual approval required**

## Correctness target

The production player must match the latest physical-device references closely:

- determinate playback and pending/loading use the same visibly taller recessed
  Aqua trough;
- volume wheel movement temporarily replaces playback progress/times with the
  photographed speaker-to-speaker Aqua volume control;
- artwork, metadata, titlebar, and time anchors remain stable across those states;
- each printed click-wheel button owns its complete 90-degree annular quadrant for
  a stationary tap, while a moved gesture still becomes rotation and never fires
  both actions.

## Source of truth

- **Primary:** the owner's latest direction in this task.
- **Primary visual:** the owner's attached Aqua specimen
  `/var/folders/ft/7tsjkpcn20q5fx1q8dwv26x80000gn/T/codex-clipboard-52c992e9-f312-4746-b1d3-0582139c6471.png`,
  plus `/Users/vinicius/code/tmp/ipod-reference/IMG_2280.HEIC` (TOOL
  determinate progress) and `IMG_2281.HEIC` (TOOL volume feedback).
- **Primary product contract:**
  `research/playback-bars-quadrants-pm.md` after the owner-authority correction.
- **Supporting:** the non-conflicting Aqua material/cadence clauses in
  `aqua-loading-criteria.md`, the other physical-device photos, and
  `research/material-sources.md`.
- **Legacy/current behavior:** the `236x5` bar, simple determinate fill, invisible
  volume adjustment, and radius-26 label hit disks.
- **Anti-sources:** any existing test or review that preserves the superseded 5px
  geometry or label-sized click targets; generic no-gradient guidance.
- **Clarity:** clear for implementation. Exact volume dwell is a documented,
  reversible default subject to owner observation.

## Literature packet

- `research/playback-bars-quadrants-pm.md` — binding geometry, behavior, boundary,
  and evidence criteria.
- `packages/panel/src/Panel.tsx` and `packages/panel/src/panel.css` — current shared
  Now Playing rendering and the existing Aqua material.
- `packages/state/src/contract.ts`, `internal.ts`, and `store.ts` — canonical Jotai
  display/control state and accepted-detent reducer.
- `packages/device/src/click-wheel-input.tsx` — canonical transformed model-space
  pointer and capture lifecycle.
- `packages/panel/src/runtime.ts` — existing injectable timer pattern; do not add an
  untestable ad-hoc timer path.
- `IMG_2280.HEIC` and `IMG_2281.HEIC` — photographed source; inspect at original
  detail rather than relying on prose alone.

## Verifiability map

- **Easy:** DOM state priority, ARIA, deterministic overlay dwell, clamping,
  provider rollback, quadrant mapping/boundaries, no double action, exact logical
  geometry, reduced motion, typecheck/lint/tests/build.
- **Proxy-verifiable:** Aqua colors, cross-section, stripe repeat, fill endpoints,
  and reference-normalized layout through computed styles and pixel measurements.
- **Human judgment:** period resemblance, visual weight, and perceived volume dwell.
- **Unknown:** none blocking implementation.

## Verification methods

- Modify existing state, panel integration, Aqua material, device input, and
  Playwright coverage; do not add a parallel test framework.
- Capture the full canonical and production-device screenshot matrices specified
  by the PM memo, including regenerated loading evidence.
- Run package typechecks for every changed package, scoped tests/lint, full panel
  Playwright, production-device Playwright, repo gates, build, and
  `git diff --check`.
- PM and an independent antagonistic visual/code reviewer must inspect the result.
  Owner observation remains the final visual/timing gate.

## Definition of done

1. Progress, loading, and volume share a `14px` outer / `12px` inner height at
   `y153..167`. Determinate and volume use the same continuous pale-top → dark-waist
   → pale-bottom cylindrical Aqua cross-section. Loading applies that same lighting
   over 45-degree, 50/50 ribs with a 22px exact repeat over the unchanged 3.2s drift.
   The trough is built from separate exterior cast shadow, asymmetric molded lip,
   dark inner seam, and concave empty channel layers; a uniform CSS border is not
   an acceptable surround, and no opaque bottom row may read as a border.
2. Human-origin volume changes reveal a `202x14` Aqua volume trough between quiet
   and loud speaker glyphs in the bottom control band within 50ms, replace times,
   restart a 1500ms dwell only on value changes, and obey all priority/dismissal
   rules in the PM memo.
3. Volume feedback is represented in the shared Jotai Now Playing state; the state
   package remains the authoritative reducer for accepted movement. No `useState`.
4. Whole-sector click mapping covers every point in `37 < r <= 103` exactly once;
   the center owns `r <= 37`; movement/cross-sector/cancel paths never emit both a
   cardinal action and wheel detent.
5. Artwork, metadata, titlebar, and time anchors remain fixed; the removed queue
   count stays removed; center-button mode order and playback behavior do not
   regress.
6. Required deterministic tests, screenshot/pixel/geometry evidence, static gates,
   PM acceptance, and independent review pass with no Critical or Major findings.
7. The owner approves the live visual result and volume dwell. Automation cannot
   waive this final judgment.

## Type, lint, and documentation gates

- Reuse canonical exported Jotai and click-wheel types; no duplicate lookalike
  state or local untyped event protocol.
- No new `any`, broad `unknown`, unchecked cast, non-null assertion, lint disable,
  or optional chain flowing into a required value without a documented invariant.
- Major exported state transitions, timer lifecycle, and quadrant mapper must have
  concise TSDoc-style comments explaining ownership, boundaries, and cancellation.
- Required commands are listed in the dispatch packet and must be reported with
  exact outcomes.

## Verifiable decomposition

### Slice A — shared Aqua bar and transient volume state

- Correctness point: the three bottom-control states render the specified geometry,
  material, priority, timing, and ARIA without moving the upper layout.
- Likely write scope: panel CSS/TSX/tests, state contract/internal/store/tests, and
  existing panel/runtime test seams.
- Verification: deterministic unit/integration/Playwright tests plus screenshot and
  computed/pixel evidence.
- Approval: design engineer, PM, independent reviewer, then owner visual gate.

### Slice B — full click-wheel quadrants

- Correctness point: every annular coordinate maps to one quadrant, center remains
  select, moved gestures rotate, and no gesture fires both paths.
- Likely write scope: device click-wheel input and existing tests, plus composite
  integration coverage only when needed to prove semantic isolation.
- Verification: pure boundary table, mounted mouse/touch/pen capture tests, oblique
  camera test, and composite no-double-action trace.
- Approval: independent reviewer; owner can validate physical feel.

### Slice C — evidence and full regression

- Correctness point: current-source artifacts prove the intended rendering and the
  full workspace remains green.
- Write scope: existing workstream diary/decisions/evidence and existing E2E tests.
- Verification: all dispatch commands and required screenshot matrices.
- Approval: PM and independent reviewer.

## Guardrails

- Do not inspect or edit `design.pen`; do not read `cert/`; do not log credentials.
- Use `bun`/`bunx` only; no force push, commit, commit trailer, new dependency, or
  `useState`.
- Preserve the dirty worktree and unrelated changes.
- Do not re-add the queue-count row, rating screen, modern card/shelf copy, or any
  invented LCD controls.
- Do not change provider playback sequencing, queue selection semantics, or the
  center/menu state-machine behavior beyond dismissing transient volume feedback.
- No Neuve/Kanban commands: repo law makes workstream artifacts the tracker.

## Decision-log rules

- The design engineer must begin from the PM memo's shared fill/well tokens and
  measurable luminance thresholds. Any tuning must be logged and must preserve
  equal height, the five-stop cylindrical profile, shared progress/volume material,
  shaded loading ribs, the four-part molded trough, and rejection of a uniform
  gray frame or hard bottom border.
- The 1500ms dwell may be tuned only within 1250–1750ms and must be logged.
- Any need to move upper-content anchors, alter the center mode order, or weaken a
  full quadrant requires owner escalation before implementation.

## Evidence and artifact paths

- Dispatch: `dispatch/playback-fidelity-pass.md`
- PM criteria: `research/playback-bars-quadrants-pm.md`
- Decisions: `decisions-playback-fidelity.md`
- Diary: `diary/playback-fidelity-pass.md`
- Evidence: `evidence/playback-fidelity/`
- PM review: `reviews/playback-fidelity-pm.md`
- Independent review: `reviews/playback-fidelity-review.md`

## Dependency and review posture

- PM acceptance criteria are complete; implementation may start.
- PM acceptance and independent review are blocked on current-source evidence.
- Owner approval is blocked on both reviews and the live/captured result.
- Review posture: **Focused visual/interaction, owner-gated**.

## Git history plan

No commit is created by agents. The patch must remain stageable as:

1. `fix(panel): match iPod playback and volume controls`
2. `fix(device): make click-wheel quadrants fully tappable`
3. `test(player): cover playback visuals and physical input regions`
4. `docs(player): record fidelity evidence and review`
