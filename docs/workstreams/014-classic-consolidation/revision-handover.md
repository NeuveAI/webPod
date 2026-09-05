# Fidelity revision handover

The owner's follow-up supersedes the first pass's flat Select and shared light-UI choices.

- Select is a shallow concave surface: 1.3 model units (about 0.24mm) below the original crown at its center, tapering continuously to zero depth and zero extra slope at the rim. Its analytic normals follow the actual bowl. The wheel and screen do not move.
- The aluminum front and Select share a deterministic short horizontal grain, with color variation, physical bump and roughness maps at the same scale. The first coarse pass was reduced to a finer satin finish. All three mip-filtered textures are disposed together.
- The silver wheel uses neutral white with a brighter calibrated material response, retaining its matte plastic finish and grey legends.
- Black hardware uses the existing blue-grey tinted LCD; Silver uses the light LCD. The stable LCD material identity from the previous pass is preserved during finish switching.
- The seven-pixel scroll well uses panel-specific neutral track tones. The five-pixel blue thumb gains a restrained side highlight and end edges. Row-window math is unchanged, including the minimum-size clamp; contrast and forced-color modes retain their token overrides.

## Evidence

References: the three owner attachments named in revision.md. Normal-size and oblique results: evidence/revision-after-{black,white}-{front,oblique,side}.png. Previous state: revision-before-*.

Long-list proof: evidence/revision-scroll-{black,white}-{top,middle,bottom}.png and revision-scroll.json. An 80-row list has a 20.588px authored thumb, starts at zero, and finishes at 162.412px with the last row visible. Rendered thumb remains within track bounds in both themes (bottom error less than 0.02px). Captures switch finishes within one live page and keep the LCD populated. The dedicated script navigates the real existing list with keyboard input and uses the existing deterministic MusicKit fixture.

Existing device/panel tests cover the actual bowl center, depressed interior, inward normals, unchanged rim positions/normals, flush wheel, screen aperture and material contracts, scrollbar window math and contrast overrides. Updated assertions explicitly replace the superseded flat-Select requirements; no new unit suite or product proof route was added.

## Scope and review

The current render visibly addresses all five requests. The scrollbar is a passive position indicator, as before; click-wheel and keyboard navigation still own selection. No new screen bezel, cover, geometry, lighting rig or playback behavior was introduced. Surface roughness and the center dish are subjective fidelity choices grounded in the supplied images and ready for owner visual review.

Leave changes unstaged with the existing worktree. Suggested commit: Refine Classic materials, Select curvature and LCD scrollbar.

## Completion audit

- Concave Select: geometry and analytic normals inspected; existing topology test verifies the 0.24mm depression, inward slope and flush tangent-continuous rim; oblique screenshots show the dish.
- Aluminum realism: before/after renders inspected at normal size; correlated grain is visible in the front and Select with matching scale. Fine satin texture replaces the initially coarse pass.
- White wheel: before/after shows brighter neutral plastic separate from silver metal; material uses #FFFFFF and calibrated response without changing its matte finish.
- Black UI tint: live black screenshots show the blue-grey LCD and white text; silver retains its light LCD. Browser settings/theme checks pass.
- Scrollbar: top/middle/bottom screenshots inspected in both themes, track/blue thumb visually distinct; revision-scroll.json proves bounded travel and correct end state. Existing list/scroll tests and direct manipulation browser tests pass.
- Regression gates: 345 device/panel tests pass, nine browser tests pass, 11/11 typecheck projects pass, production build passes, changed-file ESLint passes. Screen cover and geometry remain unchanged.
