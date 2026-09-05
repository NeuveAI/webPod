# Display surround handover

Lead accepted the wider border candidate; geometry is frozen. Only display-surround dimensions and their tests changed. Counter and other panel work belong to the separate UI lane.

## Reference and implementation

IMG_2270 shows roughly 30–38 image pixels of black side border relative to about 1110 pixels of active LCD width: approximately 2.7–3.4% per side. IMG_2274/IMG_2280 support roughly 2.5–3%. These are perspective/photo estimates, not a calibrated physical measurement. Originals stayed outside the repository.

The existing 2-unit shell opening margin was only 0.74% of the 272-unit active width. The new margin is 8 units, or 2.94%. Glass extends 7 units beyond each active edge and the black mask 6.5; their existing fine clearance/depth relationship is retained. The shell opening expands outward around the active LCD, leaving its contents and UVs unchanged. The public glass dimensions follow the enlarged cover: 286×218. Active geometry stays 272×204 and semantic rendering stays 320×240.

The square-wall aperture repair, planar LCD/glass, materials, three-light studio, rear finish/engraving and hardware are unchanged. The larger opening still leaves the active edges unoccluded from front and steep quarter cameras. No UI scale, crop, input coordinate mapping or texture sampling change was needed.

## Verification

-22 affected layout/aperture/front-surface tests pass, including full repaired+crowned body rays through active display boundaries from front and quarter cameras.
- The contour projection assertion now permits 2e-5 model units because the expanded opening crosses coordinate 256, where Float32 spacing is 3.05e-5. Measured projection residual was 1.452e-5. This is a storage-precision tolerance; no aperture repair algorithm or visible-boundary ray criterion changed.
- Device package TypeScript and four changed-file lint pass. Logs: evidence/device-tests.txt, device-tsc.txt, device-lint.txt.
- Before and accepted candidate1 captures show both finishes with integrated active Now Playing LCD, front/quarter and complete bezel closeups. The deterministic interaction sequence navigates Albums and tracks, enters Now Playing, and verifies ready playback before capturing. No browser errors.
- Reproduction: evidence/capture-display.ts. Fixed viewport 1024×1100 at DPR2, same poses and deterministic provider before/after. The counter shown in these geometry captures remains unchanged pending owner clarification.

No commits made. Independent reviewer owns final disposition and broader package/app gates. No further geometry tuning requested.
