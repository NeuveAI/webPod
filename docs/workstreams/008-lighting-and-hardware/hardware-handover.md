# Hardware handover

Implemented 2026-09-05. Physical reference is the original iPod 5th Generation Video, not classic 6G/nano/touch. Procedural repair was sufficient; no external model or Blender replacement.

## Reference evidence and interpretation

Inspected iFixit guide 604 top and bottom photographs at full available detail:
- https://www.ifixit.com/Guide/iPod+5th+Generation+(Video)+Headphone+Jack+%26+Hold+Switch+Replacement/604
- https://guide-images.cdn.ifixit.com/igi/xMAOUMWIi4Bo3Mj1.large (step 1, top).
- https://guide-images.cdn.ifixit.com/igi/Ndf2MljTFhkWYUTq.large (step 2, bottom).
- https://guide-images.cdn.ifixit.com/igi/eSJqRCcHShQqRBqX.large (step 10, separated shell).

Local copies in evidence/hardware/references are review references only, not shipped application assets. The hold control is a long, nearly flush pill with a small orange travel end; the jack has a thin collar and a deep black cylindrical bore. The dock is a wide, thin receptacle with surrounding lip and inset tongue. Model dimensions are photo-derived proportions, except the nominal 3.5mm jack bore. Do not describe this as factory CAD accuracy.

## Implementation

- New hardware-geometry.ts creates conforming collar, inward slot walls/floors, pill slider, orange travel indicator, headphone barrel with three contact lands, and bottom dock with thin tongue, thirty individual gold contacts, and side key lands.
- top-controls.ts is the shared dimensional source, including true 3.5mm inner jack diameter (previous bore was about 2.2mm). Each surface follows the existing rear roll at its own Z position; these are no longer generic blocks floating over the top.
- New hardware-apertures.ts subtracts convex opening columns from actual rear steel triangles. It preserves interpolated smooth normals and UVs. No black stickers, depth-test masks, CSG runtime dependency, or extra render passes. These fixed X/Z aperture locations stay in the default steel band. No front plastic or LCD geometry is cut.
- DeviceHardware.tsx owns generated geometry/material lifetime and disposes all resources. It uses the same studio environment as front controls, with a small local physical fixture palette: restrained metal collar, finish-dependent slider/tongue, dark insulating barrel, gold contacts, and black unlit cavity floors. This is a new fixture material family; it does not use or claim to inherit the standalone neutral diagnostic material override. Existing Device root material injection comments apply to the enclosure family and predate the fixture module.
- Complete envelope now includes the small dock collar lip as well as top controls. The dock collar remains 0.1 body units proud to avoid coplanar flicker, which extends its bottom envelope by about 0.076 body units. Top bounds respond to injected form parameters.
- No functional hold behavior added. Rotation, wheel, LCD, playback and Settings remain owned by their existing systems. Prior shell smoothness/decal fix preserved.

## Verification and evidence

- `bun test packages/device`: 225 pass, 0 fail, 141,263 assertions; evidence/hardware/tests.txt.
- Hardware/shell-enclosure/screen regression selection: 9 pass, 0 fail; scoped-tests.txt.
- TypeScript device package and scoped ESLint pass; typecheck.txt/lint.txt are empty successful outputs.
- New geometry invariants verify nominal bore size, thirty contacts, finite normalized normals, every generated part contained in the complete physical envelope, actual missing steel in each opening, intact neighboring steel, deep jack floor, recessed tongue. Tests use real raycasts and generated bounds.
- Updated existing source-structure tests to follow new hardware module and revised envelope pivot. Removed stale expectations for deleted TorusGeometry/inline top control solids.
- Before/after exact top and bottom for black; final top/bottom and 45° oblique details for both colors. Preview API clamps pitch to 45°, recorded accurately in capture-summary.json. capture.ts reproduces final images using installed Playwright/Chrome on live localhost:3000 with existing /_spike/device production-surface route, 1200×800 DPR2. No special proof route/API. No browser page errors.
- Screenshots reflect current combined lighting teammate edits. These live worktree screenshots are visual evidence, not immutable fingerprinted browser gate results. Reviewer/lead owns final integrated gates and delivery image.

## Review follow-up

Reviewer caught a tiny dock lip envelope miss; fixed by including full hardware bounds instead of making lip coplanar. Generated part bounds test passes. Ready for final independent visual/behavior checks. No commit/push or edits outside hardware slice and this workstream.

Additional oblique review: the short dark band above the dock mouth is the visible inner near wall (device-dock-reveal), confirmed using reconstructed production camera raycasts against actual shell and fixture meshes. Pixel(460,115) in the 45° detail crop hits the wall at local[0.060,-266.156,9.65], with tongue behind it. Evidence probe-strip.ts/txt and additional30°/40° crops document this sightline; no geometry change was needed.

Final evidence refresh: reran capture.ts after lighting engineer declared the final lamp and steel settings frozen. Both colors and all top/bottom/oblique detail captures now use those final settings, with zero browser page errors.
