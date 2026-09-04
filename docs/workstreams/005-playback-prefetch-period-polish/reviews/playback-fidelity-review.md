# Independent review — playback fidelity pass

Date: 2026-09-04
Reviewer: independent antagonistic code, visual, and interaction review

## Verdict

**APPROVE**

No unresolved Critical, Major, or Minor finding remains in the playback-fidelity
pass. The two Majors in the first PM review are closed in the current source and
evidence: volume captures now show exact settled values with no fill transition,
and the click-wheel trace is backed by named mounted oblique and radial-boundary
tests. This approval does not waive the separate PM re-review or the owner-only
U14/U15 and visual/physical approval gates.

## Correctness target and review scope

I reviewed the current implementation against `playback-fidelity-scope.md`,
`dispatch/playback-fidelity-pass.md`, the revised PM memo, dependency and review
lanes, `hitl-decisions.md`, `decisions-playback-fidelity.md`, the final implementation
diary, and every artifact under `evidence/playback-fidelity/`. I inspected the
primary iPod photographs, the supplied historical Aqua raster, the rejected
capsule/fast-stripe anti-reference, and the regenerated equal-height comparison
board at original detail.

The implementation-file inventory recorded in the diary matches the dispatch's
allowed write scope. The narrow `Panel.test.tsx` assertion update and the existing
production-device E2E producer are documented exceptions allowed by the dispatch.
I found no playback-fidelity change to provider, server, authentication, or
navigation implementation, and no evidence that unrelated dirty-worktree changes
were overwritten.

Review method applied the repository's strict-critique posture, interface-craft
design critique, current Web Interface Guidelines, Jotai state guidance, modern
web/motion guidance, interface guardrails with the explicit Aqua exception, and
global project patterns. Per repository law, no Neuve/Kanban command was used.

## Findings

### Critical

None.

### Major

None.

### Minor

None.

## Code and interaction audit

- The volume lifecycle is state-owned rather than component-owned. Accepted human
  movement updates the bounded control and stamps a revision/due time in
  `packages/state/src/store.ts:665`; the single leased expiry driver validates the
  current revision and deadline before dismissal in `packages/state/src/store.ts:893`.
  Clamped no-ops return before the feedback mutation, while provider reconciliation
  changes a visible value without extending its dwell.
- Track changes cannot leak a stale volume overlay. The control carries a provider
  queue-occurrence identity, `setNowPlayingWheelControlActionAtom` dismisses an
  identity mismatch at `packages/state/src/store.ts:369`, and the render itself is
  synchronously gated by the same occurrence at `packages/panel/src/Panel.tsx:733`.
  The identity includes provider, catalogue id, local key, and queue index at
  `packages/panel/src/Panel.tsx:795`, so duplicate occurrences are distinct.
- Pending and failure remain higher priority than volume at
  `packages/panel/src/Panel.tsx:733`; Menu/root/mode transitions dismiss through
  the shared store actions. Provider rejection restores the authoritative volume
  while leaving the active dwell visible. Programmatic/provider synchronization
  does not summon or renew feedback.
- The volume presentation exposes one named progressbar and decorative speaker
  glyphs at `packages/panel/src/Panel.tsx:774`. The measured row is `236x14`, with
  a `202x14` trough and exact 13px/4px/202px/4px/13px composition. Its fill changes
  directly (`transition: none`) at `packages/panel/src/panel.css:198`.
- The annular mapper covers exactly `37 < r <= 103` and assigns the half-open
  diagonal sectors at `packages/device/src/click-wheel-input.tsx:128`. The mounted
  ring returns before capture for `r <= 37` at
  `packages/device/src/click-wheel-input.tsx:553`, allowing Select sole ownership
  of the shared mesh edge. A same-sector release through 10px remains cardinal;
  movement above 10px, sector crossing, drag-off, cancellation, blur, or lost
  capture permanently transfers/cancels without double action.
- Coordinate-driven mounted proof covers mouse, touch, and pen at the real
  three-quarter transform in
  `packages/device/src/click-wheel-input.integration.test.tsx:588`, the exact
  36.999/37/37.001 radial seam at
  `packages/device/src/click-wheel-input.integration.test.tsx:792`, and the
  10/10.01px transition at
  `packages/device/src/click-wheel-input.integration.test.tsx:652`. The semantic
  store integration separately proves no cardinal/volume double action at
  `packages/composite/src/CompositeDevice.integration.test.tsx:365`.
- I found no `useState`, type escape, non-null assertion added to the scoped
  implementation, lint disable, parallel lookalike state, stale label-disk hit
  assumption, or workstream identifier leaked into shipped implementation.

## Visual, motion, and accessibility disposition

- The playback/loading well measures `x18, y155, 236x9`, with a visible 1px neutral
  rim, 1px squared-soft radius, and 7px interior. The determinate Aqua material is
  continuous and retains a crisp endpoint at 0/35/100.
- The pending material at `packages/panel/src/panel.css:207` is a contained,
  blue-first, right-falling 45-degree Aqua rib with 14px projected repeat, 52/48
  duty, and exact 14px transform displacement over 3.2s. It has no capsule ends,
  cyan/white-dominant wash, glow, or paint outside the rim. Animation is transform
  only; no layout property is animated.
- Reduced motion computes to `animation-name: none` while retaining a visible
  representative half-phase material at `packages/panel/src/panel.css:244-261`.
  Volume is already a direct state swap. Focus-visible styling and existing
  keyboard parity remain intact.
- The upper anchors are unchanged across determinate, pending, and volume states:
  titlebar `(0,0,272,21)`, artwork `(18,58,86,86)`, metadata
  `(116,58,138,75)`. The removed queue-count row and invented status shelf remain
  absent.
- All canonical dark/light images are `544x408`; production captures are complete,
  unclipped physical devices at `390x844` and `1440x900`. I visually inspected the
  final regenerated `reference-board.png`, all loading phases/reduced states, all
  progress and volume endpoints, and the loading/progress/volume/list production
  matrix. The final volume images visibly and computationally resolve to empty,
  half, and full fills at endpoints 36/136/236.
- `loading-computed.json`, `progress-geometry.json`, `volume-geometry.json`, and
  `bar-pixel-geometry-manifest.json` agree with the rendered captures. The final
  timing trace records 32ms input-to-visible, visibility through 1499ms, expiry at
  1500ms, and no reset from a clamped input. The quadrant trace now names the exact
  executable cases, pass outcomes, and suite totals rather than making an
  unsupported pose claim.

D005-07 is respected: the supplied Aqua raster, not generic gradient preferences,
controls the material decision, and neither tests nor this review claim authority
over final owner visual acceptance. D005-08 through D005-11 are also preserved:
pending survives until playback-clock advancement, the 9px geometry supersedes the
old 5px bar, quadrants cover the whole annulus, and volume is a temporary lower-band
replacement.

## Independent verification

| Command | Result |
| --- | --- |
| `bun test packages/state/src/store.test.ts` | 35 passed, 0 failed, 94 expectations |
| `bun test packages/device/src/click-wheel-input.test.tsx packages/device/src/click-wheel-input.integration.test.tsx` | 31 passed, 0 failed, 213 expectations; planted callback stacks were expected recovery cases |
| `bun test packages/composite/src/CompositeDevice.integration.test.tsx` | 13 passed, 0 failed, 61 expectations |
| `bun test packages/panel/src/aqua-material.test.ts packages/panel/src/Panel.integration.test.tsx packages/panel/src/Panel.test.tsx` | 59 passed, 0 failed, 361 expectations |
| Four package `tsc --noEmit` commands from the dispatch | passed |
| `bun run lint` | passed |
| Isolated four-case panel fidelity Playwright grep | 4 passed in 11.6s |
| Isolated `lcd-fidelity.e2e.ts` with private `TMPDIR` | 4 passed in 1.1m |
| `bun run gates` | 16/16 automated passed; 1340 tests, 0 failed, 78966 expectations; U14/U15 manual |
| `bun run build` | passed; informational pre-existing large-chunk warning only |
| `git diff --check` | passed |

## Full-panel browser flake disposition

The full panel Playwright command finished **18 passed, 2 failed** in my run. I
reran the two failures in isolation and reproduced both:

1. The pre-existing all-state evidence loop takes 48 screenshots under one 30s
   test budget and timed out while waiting for a screenshot-stability check. The
   only change inside that test is the expected removal of the S13
   success-confirmation status; the loop, screenshot count, and timeout are
   otherwise unchanged from the baseline.
2. The unchanged legacy four-times CPU-throttled frame benchmark measured about
   77.8ms in the full run and 84.0ms isolated against `<20ms`. The implementer
   independently saw the same host-pressure pair (about 85.5ms with high system
   load).

These are reproducible host/test-budget failures, not Aqua, volume, click-wheel,
accessibility, or interaction regressions. All four affected fidelity browser
cases passed in the same full run and again as an isolated 4/4 run; the complete
production-device suite passed 4/4. I am recording the non-green command rather
than representing the full suite as passing. A quiet-host all-green full-panel run
remains desirable, but neither failed assertion exercises or was changed by this
pass's product behavior.

## Dependency, HITL, and completion gates

- The original PM review remains a historical **REJECT** until the PM independently
  re-reviews the corrected current artifacts. Its M1 and M2 technical conditions
  are demonstrably closed, but this independent review does not overwrite the PM's
  authority or document.
- U14 (thumb occlusion/physical feel) and U15 (unsupported controls absent by
  owner inspection) remain manual and are not counted among automated passes.
- The owner must still observe one live 3.2s loading loop, the 1500ms volume
  replacement, full-quadrant phone-in-hand behavior, and explicitly approve the
  final visual/physical result. This review cannot waive that decision.
