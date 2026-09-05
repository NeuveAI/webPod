# Shell, input and reflection refinement

Snapshot first: `9b0eee3` — Soften Classic aluminum and reveal flush screen reflections. All work below is a separate uncommitted refinement. Unrelated worktree changes remain untouched.

## Closed shell seam

The rear tray previously ended at its outer rim while the narrower aluminum rear bevel began farther inward. A flat steel return at the existing seam Z now extends underneath that bevel by 0.25 model units. This closes the route into the connector cavity without moving either plate or covering the real dock opening. The front rim is part of the rear mesh and shares its steel material; existing connector apertures are cut afterward.

Existing hardware tests now raycast the closed top/bottom seam at three X positions and still prove the dock/jack/hold openings expose their intended cavities. Both finishes were rendered from below; `fit-after-*-bottom.png` shows the connector only through its intended opening.

## Wheel registration

The input meshes had been mounted at the scene root outside the rotating device, while their old integration-test harness supplied the missing rotation itself. Production input now applies the same orientation and complete-envelope pivot translation as the visible device. The harness no longer supplies a parent rotation; an independent matrix assertion verifies the production transform.

Raycasts intersect the actual shallow crown and Select dish in local coordinates. Exact circular boundaries avoid triangle-edge misses at oblique angles. Gesture sampling recomputes the current ray intersection; captured drags retain the existing release/cancel behavior. No scroll thresholds or wheel semantics changed.

`evidence/fit-input.ts` projects the visible wheel independently using the actual accepted device pose, camera and shell geometry, then uses native Chrome pointer actions. All 64 inside/outside samples (one model unit either side of the outer boundary), plus eight Select/Menu actions, pass across four poses. The extreme requested roll is normalized by the existing preview store; the script reads that accepted pose before projecting. Results are in `fit-input.json` and `fit-browser-input.txt`.

## Screen reflection sources

The screen sees sources 1.6 times wider/taller. The lower source shares the upper source's orientation, producing parallel reflection edges. Its physical RectAreaLight evaluation is adjusted only in the screen material, with radiance divided by area scale to retain source power. The screen also receives a matching dedicated PMREM reflection map. The actual scene lamps, default environment, metal material and center-button response are unchanged. The additional PMREM target and scenery are disposed with the studio.

The shader uses Three's existing rectangle-light integration, not a painted highlight. Its key/fill ordering follows ViewerLitDeviceFrame; the installed Three chunk marker is checked before patching. Existing material tests cover the patch; actual Chrome captures verify rendering.

The front-on aluminum sample between screen and wheel matches the snapshot exactly: zero mean or maximum RGB difference in `fit-lighting.json`. This is a bounded pixel check alongside the unchanged light rig and metal wiring, not a claim that every image pixel is unchanged (the screen and closed seam intentionally differ).

## Final verification

- 345 device/panel tests pass.
- 18 browser tests pass (direct manipulation, settings, orientation).
- 64 wheel-boundary samples and eight physical button actions pass.
- Typecheck: 11/11 projects clean; production build and changed-file lint pass.
- Black/Silver front, oblique, side, tilted reflection and bottom views captured. Final front and bottom renders inspected against the four owner attachments.

The screen's plane, dimensions, aperture, LCD compositor and flush geometry remain unchanged. No credentials or encrypted design were accessed. References are the four owner attachments under `64892e4d-b09c-4983-9770-14c9c5101b21`.
