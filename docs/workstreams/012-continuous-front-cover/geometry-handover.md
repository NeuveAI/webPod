# Continuous front cover handover

Candidate2 visually accepted by lead; implementation frozen. The outer printed surround is now 6 model units rather than 8, while all four luminous LCD corners are square. The visible surround keeps subtly rounded outer corners. Native content remains 320×240 on the same 272×204 planar mesh with unchanged input mapping.

## Corrected construction

The former bright loop was primarily a real coverage hole: the black mask ended at 6.5 units and the well's inner edge began at 7. Rays between them passed through transparent cover geometry without hitting any opaque surface, exposing the scene background. Hiding either the glass or body alone did not eliminate the loop. Investigator evidence is in evidence/isolation.

The black underprint now continues beneath the opaque front backing, with 6 units of concealed overlap beyond the 6-unit aperture. The cover footprint meets the opening, and the concealed liner overlaps the underprint. This closes oblique sightlines without introducing a stroke, lighting change or extra visible bezel.

Candidate1 removed the loop but retained a fine highlight on the old opaque aperture's sidewall. Candidate2 removes only that backing-wall geometry before applying the unchanged exterior crown. The opaque colour backing has an opening beneath the continuous clear cover; it no longer shades as a separately cut glossy plastic window. Cap triangles, the outer roll and wheel opening remain intact. The planar optical layer and LCD depths remain unchanged, preserving texture color and input behavior. No global materials, light rig, rear finish/engraving or hardware were changed.

## Verification

-32 affected tests pass across layout, aperture, front-surface and screen mapping suites. Logs: evidence/device-tests.txt.
- The full production repaired/crowned shell test includes the new backing-wall removal and strict first-native-pixel corner rays (0.425 model units inside each edge) from front and steep quarter cameras. Existing straight top/bottom and side visibility checks remain.
- Screen mesh verification now requires actual vertices at all four rectangular corners and exact normalized corner UVs, not nearby rounded contour points.
- Removal tests retain the complete cap triangle array byte-for-value and verify finite, consistent attributes; geometry remains owned/disposed by the existing front mesh lifecycle.
- Device TypeScript and seven changed-file lint pass: evidence/device-tsc.txt, device-lint.txt. Independent reviewer also ran three package typechecks and native integrated replay.
- Before/candidate1/candidate2 show integrated active LCD, complete bezel closeups and whole device from front/steep quarter for black and white. Candidate2 is accepted final visual source; no later rendering edits. Deterministic Albums→tracks→Now Playing interaction verifies the native panel path before capture. No browser errors.
- Settings investigator owns final live annulus/active-corner coverage evidence. CSS and composite clipping were already rectangular; no changes were necessary in those packages.

Reference interpretation uses IMG_2270.png and IMG_2280.png outside the repository. No reference lighting was copied. UI content and counter are unchanged by this slice. No commits made.
