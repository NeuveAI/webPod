# Scope: volumetric device and orientation-ready MVP

**Status:** Guarded — implementation may proceed on geometry and the orientation
seam. Owner acceptance remains required for material fidelity. Browser sensor
permission UX is deferred unless the owner explicitly pulls it into this MVP.

## Correctness target

- The iPod is a true volumetric Three.js object, not a front-facing plane or a
  raster facsimile of `design.pen`.
- It remains physically coherent in front, three-quarter, edge, and rear views,
  and through a 180° front-to-back rotation.
- The screen remains real DOM composited through the T1 HTML-in-canvas path.
- Body, sidewall, bevels, screen/glass recess, wheel recess, raised Select, rear
  shell/steel, seams, and relevant edge controls have real depth and occlusion.
- Lighting, reflection, and transmission respond to orientation. Material lift
  may not be a view-locked painted gradient or an unattenuated extra light.
- A single typed orientation transform drives the whole device. Pointer-driven
  validation and later accelerometer input feed this seam without rebuilding the
  geometry or owning a second state store.

## Source of truth

- **Primary:** owner messages dated 2026-08-31: proper 3D object, future
  accelerometer and flip interactions, and the rich `design.pen` model.
- **Primary:** `design.pen`, accessed only through Pencil MCP; VWaJS is the
  front/material authority and zbTc3 is the rear/steel authority.
- **Supporting:** `dispatch/W4-device-layer.md` geometry, material injection,
  demand-rendering, and frame-budget laws.
- **Supporting:** `dispatch/W6-composite.md` and current T1 seam.
- **Supporting:** installed Three/R3F sources under
  `/Users/vinicius/code/agentic-context/`.
- **Legacy/current behavior:** front-biased procedural geometry and diagnostic
  routes may be replaced where they prevent edge/back fidelity.
- **Anti-source:** screenshots as geometry; front-view luminance matching as a
  substitute for volumetric correctness; the old W4 statement that expose flip
  is out of scope.
- **Clarity:** geometry and orientation readiness are clear. Sensor permission
  UX is partial and therefore deferred behind a typed adapter boundary.

## Verifiability and methods

- **Easy to verify:** non-zero thickness, distinct front/side/back surfaces,
  wheel/select depth, one orientation root, DPR 1/2/3 backing stores, no idle
  frame loop, no horizontal overflow. Prove with unit/integration/E2E tests.
- **Proxy-verifiable:** proportions and material hierarchy. Compare Pencil MCP
  references with native front/three-quarter/edge/back captures.
- **Canonical luminance:** the W4 ±4 stop-table check applies to the canonical
  front and rear reference poses only. Three-quarter, edge, and animated poses
  are judged by physical continuity, material identity, silhouette, occlusion,
  and the absence of view-locked shading. This owner ruling supersedes any
  reading that applies static 2D stop tables unchanged to rotated poses.
- **Human judgment:** final black/white/steel material quality and whether the
  object reads as the intended iPod. Owner approval is mandatory.
- **Unknown/deferred:** production accelerometer permission copy, denial/retry
  policy, and sensor calibration. Do not silently invent them.

## Definition of done

- Front, 30–45° three-quarter, 90° edge, and 180° rear poses render from one
  object and one orientation transform in black, white, and steel-rear variants.
- Silhouette, occlusion, bevel highlights, screen recess, wheel recess, Select
  relief, and back identity remain legible in the applicable poses.
- Pointer/keyboard validation can rotate and flip the object while keeping LCD
  DOM alignment and interaction correct.
- Orientation input is a typed, documented boundary that a later
  DeviceOrientation adapter can drive; there is no component-local React state.
- HTML-in-canvas remains sharp at DPR 1/2/3 and after resize/zoom.
- `frameloop="demand"` remains idle when the device is still.
- Per-package typecheck, lint, tests, browser matrix, build, and all automated
  gates pass.
- Independent strict review returns APPROVE. Owner visually accepts the
  black/white/steel set and performs the manual thumb-occlusion check.

## Decomposition

1. **Volumetric shell and controls**
   - Own: `packages/device/**`.
   - Verify: geometry tests plus native multi-angle captures.
   - Must preserve: material injection and screen-material slot.
   - Commit intent: `feat(device): make enclosure fully volumetric`.
2. **Orientation root and deterministic flip controller**
   - Own: `packages/device/**` and the existing diagnostic device route only.
   - Verify: pure transform/controller tests, front/edge/back browser poses,
     interaction continuity, idle-loop test.
   - Must preserve: shared Jotai state law; no `useState`.
   - Commit intent: `feat(device): add orientation-ready flip control`.
3. **Composite/DPR/material review repairs**
   - Own: existing W4/W6 boundaries only.
   - Verify: DPR 1/2/3, zoom disagreement seam, edge-acuity gate, physically
     grounded light transport, full browser matrix.
   - Commit intent: focused fixes rather than one mixed visual commit.

## Guardrails

- `design.pen` only through Pencil MCP.
- `bun`/`bunx` only; no `useState`; no credentials; no commit trailers.
- Preserve unrelated token working-tree changes and historical evidence.
- Do not implement fallback renderers/polyfills in this slice.
- Do not implement production sensor permission UX under the guarded default.
- Do not use a GLB or raster shell that severs authored geometry/material inputs
  unless the owner explicitly changes this decision.

## Canonical implementation and documentation gates

- Inspect installed Three 0.185.1 and R3F implementations in
  `/Users/vinicius/code/agentic-context/` for transforms, materials, light
  integration, DPR, and demand invalidation.
- Reuse project geometry/material/orientation types where present. Any new
  orientation type must be exported once and used by controller and renderer.
- No `any`, unchecked `unknown`, non-null assertions, lint disables, or duplicate
  device state without a logged invariant.
- Public orientation, geometry, shader, and lifecycle helpers require TSDoc that
  states coordinate space, units, ownership, invalidation, and cleanup.

## Evidence and review

- Diary: `diary/volumetric-device.md`
- Decisions: `decisions/volumetric-device.md`
- Evidence: `evidence/volumetric-device-*`
- Review: `reviews/volumetric-device-review.md`
- Review lanes: strict geometry/Three review; material/light review; browser
  interaction/DPR review; owner visual acceptance.

## Dependency and HITL register

- Geometry and the orientation seam can start now.
- Composite sharpness and DPR repairs can proceed in parallel only with disjoint
  files; otherwise they are sequential within the device implementer.
- **Guarded assumption:** MVP gets pointer/keyboard-driven orientation plus a
  sensor-ready typed seam. Production accelerometer permission/calibration is
  deferred.
- **Settled owner ruling, 2026-08-31:** ±4 luminance matching is canonical-pose
  evidence, not an orientation-wide pixel contract. Rotated poses must remain
  world-lit and physically coherent; they must not be tuned with pose-specific
  lights, view-locked gradients, or altered reference tables.
- **Owner-only:** material/aesthetic acceptance, thumb occlusion, and history
  rewrite execution.

## Git history plan

- Keep shell geometry, orientation/controller, composite raster repair,
  physically grounded material repair, tests, and docs as separately reviewable
  commits where dependency edges allow.
- Every implementation commit must typecheck and test independently.
