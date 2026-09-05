# Geometry handover

Implemented 2026-09-05 by Astra 3D engineer. Own slice: packages/device/**.

## Cause and correction

The rear graphics were a full 330 × 552 double-sided transparent plane placed beyond the rear face, but the physical rear face is inset by the stamped metal roll. Its margins therefore protruded beyond the chrome face and remained visible around oblique side views. The plane also baked an inert, always-visible Settings UI and fabricated session text. Removed the composition plane, its generated texture, and the redundant rear inlay solid. The resulting back is uninterrupted physical chrome. Existing rearInlay form/material fields remain for compatibility with callers, but no geometry consumes them.

Front ExtrudeGeometry supplies separate face normals for every non-indexed triangle. Those faceted bevel normals were preserved by the later crown deformation. Smooth those normals using installed Three 0.185.1 toCreasedNormals at 45 degrees before the existing analytic crown transformation. The 90 degree LCD aperture remains creased. Increased bevel sampling from 6 to 16 and plan corners from 16 to 48; dimensions, wheel/screen placement, and crown functions remain unchanged.

Rear area-weighted normals depended on the very unequal areas of long side triangles, small corner triangles, and the rear cap fan. Replaced that average with analytic normals of the swept superellipse and quarter ellipse. Rear-cap normals are exactly -Z and seam normals are lateral. Increased corner samples from 24 to 48. The single indexed watertight tray and open front seam remain unchanged. No material, lighting, or environment values were changed. No downloaded asset or Blender recreation was necessary.

Removed dead texture composition helpers and obsolete tests. Updated calibration luminance targets to raycast the steel directly and removed the detour that avoided the old opaque inlay. This prevents diagnostics from expecting a deleted mesh or sampling around absent UI.

## Verification

- `bun test packages/device`: 222 pass, 0 fail; 83,099 assertions. Output: evidence/geometry/device-tests.txt.
- Focused shell/crown/front-surface/textures/luminance tests: 40 pass, 0 fail; evidence/geometry/scoped-tests.txt.
- `bunx tsc --noEmit -p packages/device/tsconfig.json`: pass.
- `bunx --bun eslint` on all eight changed package files: pass.
- Browser screenshots via installed Playwright and Chrome, viewport 1024 × 1100 at DPR 2, existing localhost:3000 development server. These are development captures, not fingerprinted immutable snapshot evidence. The settings engineer and lead own final integrated snapshot checks.
- Evidence includes matching black quarter before/after, plus black and white front, quarter, rear-quarter, exact right edge, and a steep quarter (pitch 20°, yaw -55°). The steep pose uses existing preview API on /_spike/device, no special route. The standalone production-surface capture intentionally has a blank LCD; integrated playback screenshots belong to the lead/settings slice.

Visual inspection: exposed glyphs disappear from the complete side seam; front corner highlights become smooth rather than stepped. The rear has a continuous silver reflected environment and no menu plate. Bright softbox reflections remain at the chrome top edge, as expected for the unchanged polished steel and lighting. Both colorways preserve the front finish, click wheel, screen aperture and top controls.

## Review focus

Check analytic normal derivation and flat rear-cap transition, smooth bevel versus square LCD aperture, cleanup/disposal, direct steel probe identity, and integrated settings/rotation in the production view. No commit or unrelated file edits performed.

Reviewer follow-up: repaired source-slice boundaries in screen-aperture.test.ts after inlay removal, with ordered-index assertions. Also corrected its preexisting multiline front-builder marker and renamed a generic transparent-decal raycast fixture to remove obsolete rear UI terminology. Re-ran all 222 device tests and changed-file lint successfully.
