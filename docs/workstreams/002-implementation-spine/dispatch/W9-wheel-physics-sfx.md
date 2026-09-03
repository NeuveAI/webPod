# W9 — Click-wheel physics and SFX

## Correctness target

The established iPod 5G model behaves like a physical control surface. A human
press visibly depresses the Select button; a human arc gesture creates a subtle,
local depression beneath the thumb that travels around the click wheel. Release
restores both surfaces without oscillation or a permanent render loop. Human
presses and real detents produce restrained click SFX; agent-originated and
silenced actions remain silent.

## Sources of truth

- Owner direction in the active thread.
- Owner OEM photographs `IMG_2239.HEIC` through `IMG_2249.HEIC` for the resting
  flush geometry and material boundaries.
- `packages/device/src/click-wheel-input.tsx` for physical pointer contact.
- `packages/composite/src/click-wheel-runtime.ts` for browser gesture lifecycle.
- `packages/state/src/store.ts`, `detent.ts`, and `silence.ts` for authoritative
  detent/press outcomes and feedback budgets.
- `design.pen` through Pencil MCP only.
- `/Users/vinicius/code/agentic-context/` for pinned library behavior.

## Decisions

1. Resting geometry remains visually flush. Depression is transient deformation,
   never a new static recess.
2. Select travel is more pronounced than wheel travel, but both remain restrained.
3. Wheel deformation is local to the current thumb angle and must move continuously
   with contact; it is not a whole-wheel translation or view-locked shader spot.
4. The light rig and physical normals reveal the depression. No painted shadow,
   UV highlight, or screen-space fake is allowed.
5. Demand rendering remains idle at rest. Frames are requested only while travel
   is changing or springing home.
6. Audio is driven from authoritative `clickerTicks`: one press click per eligible
   human button press and one detent tick per eligible human detent. Raw pointer
   movement cannot produce sound.
7. Web Audio must unlock/resume only from a human activation, be disposable, and
   avoid overlapping unbounded nodes. No network dependency or credentialed asset.
8. Reduced-motion limits visual spring motion but does not silently remove direct
   control feedback. Agent and silenced paths remain inaudible.

## Verifiability map

| Requirement | Proof |
| --- | --- |
| Select depression | pointer-down/hold/release browser trace, oblique macro frames, travel test |
| Thumb-following wheel deformation | sampled angles at 0/90/180/270°, moving highlight/normal response, locality test |
| Flush rest state | existing owner-OEM flush gates plus post-release zero-travel assertion |
| Demand rendering | zero idle rAF; bounded frames during release |
| Press SFX | deterministic event/audio graph test and browser activation proof |
| Detent SFX | N real detents => N budgeted ticks; sub-detent motion => zero |
| Silence and cleanup | agent/silenced tests, blur/cancel/dispose tests, bounded node count |
| Combined feel | flagged-Chrome owner route capture and audio event transcript |

## Decomposition and ownership

- **W9a — 3D control physics:** `packages/device/**` and the minimal shared
  interaction-state contract needed to expose contact/travel. No audio code.
- **W9b — interaction SFX:** `packages/composite/**` plus minimal state feedback
  plumbing. No geometry/material code.
- Shared files require explicit coordination and sequential commits.

## Definition of done

- Select and wheel visibly depress and return to the exact established resting
  model.
- Thumb depression follows angle and remains local, subtle, and physically lit.
- Button and detent sounds are audible after human activation, restrained, rate
  safe, and silent for agent/silenced paths.
- Mouse, touch/pointer, keyboard, cancellation, blur, and disposal are tested.
- No `useState`, permanent rAF, view-locked lighting, raw-movement SFX, global
  selection suppression, or unbounded AudioNodes.
- Scoped typecheck/lint/tests/build/gates and browser evidence pass.
- Independent 3D and runtime/audio reviews approve before owner handoff.
