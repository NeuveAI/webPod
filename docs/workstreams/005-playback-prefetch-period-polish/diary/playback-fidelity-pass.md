# Playback fidelity pass — implementation diary

> **Historical material note (2026-09-05):** the `236x9`, `14px` rib-repeat, and
> transform-motion details below document the superseded candidate reviewed in
> this pass. The owner's active `14px` molded-trough/cylindrical-Aqua correction,
> its stationary rib-phase animation, and current evidence are recorded in
> `aqua-cylinder-correction.md`. Prior verdicts below remain historical.

Date: 2026-09-04
Implementer: design engineer
Status: PM re-review **ACCEPT** and independent review **APPROVE**, with zero
unresolved Critical/Major/Minor findings; owner visual/physical approval remains
mandatory

## Scope and source handling

Before editing, I read the full playback-fidelity scope, dispatch, corrected PM
memo, dependency graph, HITL decisions, review lanes, decisions, prior Aqua
criteria/diary, and material-source notes. I inspected `IMG_2280.HEIC`,
`IMG_2281.HEIC`, and the supplied historical Aqua sample at original detail. The
photographs and owner direction were treated as binding; generic no-gradient
guidance did not override the Aqua gel.

I ran the mandatory modern-web-guidance search first, then applied interface-craft
critique/motion, freshly fetched Web Interface Guidelines, interface-design
guardrails with the documented Aqua exception, Jotai state guidance, and project
global patterns. The resulting motion choice is CSS transform-only for the
indeterminate material, a direct no-transition state swap for volume, and a fully
rendered static half-phase under reduced motion.

## Implementation

### Shared Aqua controls and stable layout

- Replaced the undersized playback/loading control with one `236x9` recessed
  trough at `(18,155)`, a `1px` neutral rim, `1px` squared-soft radius, and `7px`
  interior.
- Added the photographed continuous Aqua cross-section for determinate playback:
  a one-pixel upper glint, saturated blue/cyan body, and one-pixel dark lower edge.
  The value endpoint remains crisp and the perimeter stays visible at `100%`.
- Kept the existing `120ms` determinate playback fill transition, but made the
  transient volume fill a direct `0ms` state swap. The canonical volume images
  therefore show exact `0/50/100` endpoints rather than transition-in-flight
  widths.
- Scaled loading ribs to a `14px` projected repeat while preserving the accepted
  right-falling `45deg` direction, `52/48` blue/light duty, blue-first palette,
  and exact one-repeat `3.2s` linear translation. Reduced motion freezes the
  complete material at half phase with computed animation `none`.
- Kept the titlebar, artwork, and metadata fixed across standard, pending,
  determinate, and volume states. No queue-count row or standard scrub marker was
  restored.

### Volume replacement and state ownership

- Added the speaker-to-speaker replacement at `x18..254`: `13px` decorative quiet
  glyph, `4px` gap, `202x14` Aqua trough at `(35,153)`, `4px` gap, `13px`
  decorative loud glyph.
- Added a shared Jotai visibility/value/revision/due-time state. Every accepted
  human value change is visible immediately and renews one 1500ms dwell; clamped
  no-ops and agent/programmatic synchronization do not summon or extend it.
- Added one leased runtime timer driver with injected clock/timers. Revision and
  due-time checks prevent an older callback from hiding a newer dwell; teardown
  cancels the lease.
- Menu/root navigation, center-mode changes, track occurrence changes, pending,
  and failure dismiss or outrank the replacement. Occurrence identity includes
  provider, catalog identity, local key, and queue index, so moving between two
  copies of the same song also dismisses. Rendering gates synchronously on this
  identity before the clearing effect runs, preventing a stale overlay frame on
  the next track. Provider write rejection restores the authoritative value
  without prematurely hiding the still-active feedback.
- The replacement exposes exactly one `role=progressbar` named `Volume`, with
  min/max/value semantics; speakers remain decorative.

### Whole click-wheel quadrants

- Replaced label-centered disks with model-space mapping of the entire annulus
  `37 < r <= 103`; the center owns `r <= 37`, and `r > 103` is inactive.
- Implemented deterministic half-open 90-degree sectors. Exact `45/135/225/315`
  degree boundaries belong to Bottom/Left/Top/Right respectively.
- A same-sector release through `10px` remains exactly one cardinal action.
  Travel above `10px`, sector crossing, drag-off, cancel, blur, or lost capture
  cancels the cardinal candidate. Movement takeover starts the existing arc path
  and cannot also emit a cardinal action.
- Mouse, touch, and pen use the same transformed model-space mapper. Existing
  transport, Menu hold, Center, queue, scrub-confirmation, keyboard parity, focus,
  and feedback semantics remain intact.
- The coincident Three.js hit seam at exactly `r=37` is resolved in the mounted
  surface: the annulus returns before capture/propagation so Select owns `r<=37`,
  while `r=37.001` reaches the annular sector. Mounted front and three-quarter
  camera tests drive projected screen coordinates for mouse, touch, and pen.

## Evidence and visual review

The complete artifact manifest is in
`evidence/playback-fidelity/README.md`. The equal-height source/candidate board is
`evidence/playback-fidelity/reference-board.png`; it was regenerated after the
final canonical volume captures (`22:42:48–22:42:59`) at `22:47:27` and visually
inspected at its native `1440x1600` size. The candidate keeps the source's
restrained neutral rim and period Aqua depth without glow, pill ends, or a
white/cyan-dominant wash. The volume row reads as a thicker whole-band replacement,
while progress/loading remain subordinate to artwork and metadata.

All four production loading/volume captures were visually inspected after the
final run. The complete physical iPod is framed inside both `390x844` and
`1440x900` viewports, with neither LCD clipped. Canonical screenshots cover both
colourways, all required values/phases, and reduced motion.

Computed evidence records:

- playback/loading outer `236x9`, inner `234x7`, ratio `0.7778`;
- volume outer `202x14`, inner `200x12`, ratio `0.8571`;
- loading repeat `14px`, gradient repeat `9.9px`, blue stop `5.15px`, direction
  `45deg`, duration `3200ms`;
- titlebar `(0,0,272,21)`, artwork `(18,58,86,86)`, metadata `(116,58,138,75)`
  unchanged through determinate values and volume values;
- volume visible latency `32ms` in the final capture run (within the `<=50ms`
  immediate-commit bound), renewed dwell visible at `1499ms`, hidden at
  `1500ms`, and no reset from a clamped input;
- volume fill endpoints `36/136/236` at `0/50/100`, with computed transition
  duration `0s`;
- a `10px` tap produces one cardinal and no volume change; `10.01px` movement
  transfers to rotation, changes volume, and produces no cardinal action.
- mounted radial proof gives Select sole ownership at `36.999` and exactly `37`,
  then Next sole ownership at `37.001`; oblique proof covers all four sector
  centers for mouse/touch/pen, eight diagonal/radial extremes, and one
  movement-takeover sequence.

## Verification log

Final results:

- `bun test packages/state/src/store.test.ts` — **35 passed, 0 failed**, 94
  expectations.
- `bun test packages/device/src/click-wheel-input.test.tsx packages/device/src/click-wheel-input.integration.test.tsx`
  — **31 passed, 0 failed**, 213 expectations. Deliberately planted callback
  failures print their expected stack traces while their recovery tests pass.
- `bun test packages/composite/src/CompositeDevice.integration.test.tsx` — **13
  passed, 0 failed**, 61 expectations.
- `bun test packages/panel/src/aqua-material.test.ts packages/panel/src/Panel.integration.test.tsx`
  — **24 passed, 0 failed**, 178 expectations.
- `bun test packages/panel/src/aqua-material.test.ts packages/panel/src/Panel.integration.test.tsx packages/panel/src/Panel.test.tsx`
  — **59 passed, 0 failed**, 361 expectations.
- `bun test packages/panel/src/Panel.test.tsx` — **35 passed, 0 failed**, 183
  expectations. This narrow, parent-authorized update replaced the stale 5px row
  and single-progress reduced-motion assertions with the new shared contract.
- `bunx --bun tsc --noEmit -p packages/state/tsconfig.json` — passed.
- `bunx --bun tsc --noEmit -p packages/device/tsconfig.json` — passed.
- `bunx --bun tsc --noEmit -p packages/composite/tsconfig.json` — passed.
- `bunx --bun tsc --noEmit -p packages/panel/tsconfig.json` — passed.
- `PLAYBACK_FIDELITY_EVIDENCE_DIR=... bunx --bun playwright test --config packages/panel/playwright.config.ts --grep "standard Now Playing|starting playback|determinate playback|human volume feedback"`
  — **4 passed**; regenerated focused canonical/computed evidence.
- `LCD_FIDELITY_EVIDENCE_DIR=... bunx --bun playwright test --config apps/web/tests/playwright.config.ts lcd-fidelity.e2e.ts`
  — the first final pass was **3 passed, 1 transient desktop canvas wait
  timeout**; an isolated retry of the desktop case was **1 passed**, and the
  independent reviewer's private-`TMPDIR` full rerun was **4 passed**. Together
  these regenerated and independently verified the scoped production-device
  matrix without a shared snapshot collision.
- `PLAYBACK_FIDELITY_EVIDENCE_DIR=... bunx --bun playwright test --config packages/panel/playwright.config.ts`
  — the latest full run was **18 passed, 2 failed** under severe host contention:
  the all-state screenshot case exceeded its 30s stabilization budget and the
  deliberately CPU-throttled frame benchmark measured `85.4517ms` against
  `<20ms`. At that time load average was `15.87/10.41/7.84`, with unrelated
  `mediaanalysisd` at about `102%` CPU and the League client at about `126%`
  combined. The independent reviewer reproduced only those same two failures in
  a private snapshot (`~77.8–84ms` frame average); all 18 functional,
  accessibility, and affected playback cases passed in both runs. An earlier
  clean-enough full run, before the final reviewer-requested assertions, was
  **20 passed**. This final host-budget failure is recorded explicitly and is not
  treated as an all-green suite.
- `bun run lint` — passed.
- `bun run build` — passed; Vite reported its existing informational large-chunk
  warning.
- `bun run gates` — **16 automated passed, 0 automated failed; 1340 tests passed,
  0 failed; 78966 expectations; 2 manual gates outstanding** (`U14` thumb
  occlusion and `U15` unsupported-controls inspection).
- `git diff --check` — passed.

The center-mode browser case exposed a real scrub reset race. A wheel detent
published a new scrub intent and value, but the scrub-control configuration effect
could still see `scrubState === 'clean'` before the intent-consumer effect marked
it previewing. It then reconfigured the control from `playback.positionMs`, erasing
the just-published value; the test could consequently observe `previewing` while
the displayed position had not advanced. `Panel.tsx` now detects an unhandled
scrub intent (`intent.seq > handled seq`) and preserves the current bounded scrub
control value until consumption. The existing Playwright case **“Now Playing
center states are substantive and the wheel owns their controls”** remains the
end-to-end regression: its focused rerun passed **1/1**, and it passed in both
latest full-suite attempts.

Reviewer-requested regressions also cover ready-to-ready distinct-track dismissal,
duplicate same-track occurrence dismissal without a pending/null intermediary,
synchronous render suppression, zero-transition volume endpoints, real mounted
oblique mouse/touch/pen sectors, and the exact mounted `r=37` center seam. The
first full repo gate run also found two stale `Panel.test.tsx` assertions for the
old 5px row and exact old reduced-motion selector; the parent authorized only those
assertion updates, the affected file passed 35/35, and the final full gate passed.

I also inspected the modified implementation surface for stale `157`, `7.75px`,
radius-26 label-hit assumptions, `236x5` claims, type escapes, lint disables, and
`useState`; none remain in the playback-fidelity implementation. Existing unrelated
dirty-worktree changes were preserved.

## Files changed for this pass

- State: `packages/state/src/contract.ts`, `internal.ts`, `store.ts`, `index.ts`,
  and `store.test.ts`.
- Panel: `packages/panel/src/Panel.tsx`, `panel.css`, `runtime.ts`,
  `runtime.test.ts`, `aqua-material.test.ts`, `Panel.integration.test.tsx`, and the
  authorized stale assertions in `Panel.test.tsx`; plus
  `packages/panel/e2e/panel-fixture-route.tsx` and `panel.e2e.ts`.
- Device/composite: `packages/device/src/click-wheel-input.tsx`, its unit and
  integration tests, `packages/device/src/index.ts`, and
  `packages/composite/src/CompositeDevice.integration.test.tsx`.
- Production evidence route test: `apps/web/tests/lcd-fidelity.e2e.ts` only.
- Workstream: this diary, `decisions-playback-fidelity.md`, and all artifacts under
  `evidence/playback-fidelity/`.

## Review outcomes, remaining uncertainty, and handoff

No known playback-fidelity correctness failure remains. The only non-green final
command is the full panel browser suite's reproducible host-capacity pair described
above; it still needs a quiet-host all-green rerun and is not silently waived. The
photographs cannot establish the exact transient dwell, and screenshots cannot
prove thumb comfort, physical sector feel, or subjective period resemblance. Per
the PM contract, the owner must still observe the 1500ms replacement live, validate
visual weight/timing and phone-in-hand quadrants, and explicitly approve. Separate
PM and antagonistic reviewers inspected the corrected current diff and evidence:
`reviews/playback-fidelity-pm.md` is **ACCEPT** and
`reviews/playback-fidelity-review.md` is **APPROVE**, each with zero unresolved
findings. This implementer does not self-approve; the owner-only gate remains.
