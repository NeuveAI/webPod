# Continuous-cover diagnosis

Read-only inspection against owner photographs IMG_2270 and IMG_2280 in `/tmp/webpod-front-reference/`: square luminous LCD corners are distinct from the modestly rounded outer printed black surround. No panel/composite or device implementation was edited by the investigator.

## Active corner ownership

`packages/device/src/layout.ts` sets `SCREEN_CORNER_R=4` and publishes it in the screen layout. `Device.tsx` passes that radius to `createScreenGeometry`, and the display mask's inner rounded rectangle uses `screen.cornerR`. Both paths must agree on square active corners. `screen-geometry.ts` assigns affine UVs across the unchanged active272×204 plane.

The panel `.wp-panel`/`.wp-screen` roots have no rounded border or corner clip; their overflow is rectangular. Other CSS radii belong to actual small controls (battery/progress/search), not the active screen boundary. `packages/composite/src/html-in-canvas.ts` attaches the HTMLTexture to the supplied device screen mesh and uses a rectangular PlaneGeometry interaction proxy. There is no composite rounded mask or UV warp to remove. **No shared panel/composite radius edit is needed.** Geometry owns both active shape paths.

## Bright outer ring: uncovered annular gap

Before-state `surface-layout.ts`: mask expands6.5units beyond each active edge; glass expands7; black well begins at that glass7 outline and ends8units beyond active. Consequently mask→well has a0.5unit annular gap. The glass above it is transparent, leaving no opaque front surface across part of that band.

Actual scene inspection at front/DPR3 on the normal deterministic integrated route confirms it. Perspective rays aimed at the activeLCD local rightedge+6.6 and+6.75units intersect only the transparent MeshPhysicalMaterial glass; no opaque object is hit behind. At+6units the ray hits the opaque `device-display-mask`; at+7.1 the ray hits opaque `device-display-well`. At+6.9 perspective also finds deeper body geometry, illustrating the pose-dependent backing rather than continuous coverage. Exact intersections are in `evidence/isolation/ring-rays.json`.

Matched visibility isolation supports that explanation:

- Hide glass: broad surround darkens and LCD loses its glass contribution, but the thin ring persists.
- Hide body: thin ring survives; the front-body aperture bevel is not its necessary source.
- Hide rear steel group: ring survives, ruling out a rear-metal reflection explanation in this pose.
- Hide well: exposes a broader unbacked strip; hide mask: exposes broad unbacked surround.

The bright ring is therefore primarily a background leak through the discontinuous opaque surround, with the local glass reflection contributing additional appearance. It is not merely excessive global lighting. The standalone transparent window and recessed layers additionally make the surround read as a separate insert; closing the gap alone does not establish continuous-cover visual fidelity.

## Implementation and regression criteria sent to geometry

Preserve active272×204 and affine texture mapping; square both LCD geometry and mask inner boundary. Make the opaque printed surround continuously cover the region from active edge to shell with no uncovered annulus. Avoid a separate raised window perimeter or screen-only reflective band. Keep subtle rounding on the outer printed surround independently of the square luminous rectangle. Verify all four active corners remain unobscured at front/quarter, plus ray coverage across the printed annulus rather than just testing constant values. A transparent cover should read as one plastic surface with the body; no global lighting or UIcounter change is needed.

## Evidence limits and reproducibility

`evidence/isolation/capture.ts` captures front and quarter with normal visibility, then independently hides glass/body/well/mask. `rear-isolation.ts` hides the rear group. `rays.ts` performs the targeted perspective intersection inspection. These mutate only an isolated browser's object visibility and restore it; no production API/source/material/light changes. All capture paths use existing localhost `_spike/device?capture=`, deterministic Apple Music, viewport1200×900,DPR3. Source hashes and crop metadata are recorded. Ten main PNGs plus rear-isolation PNGs are raw screenshots. The diagnosis is proven for the measured front and quarter views, not an exhaustive all-angle test.
