# Backplate finish and engraving handover

Final rear-only implementation frozen and lead visually accepted. Reference photos IMG_2284.HEIC/IMG_2285.HEIC were interpreted only for material polish, narrow rolled-edge catch and engraving hierarchy. No reference lighting, room reflections, scratches or serial data were copied. Existing 5G geometry retained; the photographed capacity was not treated as a model specification.

## Result

The existing steel shell carries two material-data textures in its existing XY UV coordinates. A smooth perimeter roughness profile changes from.045 on the rolled edge to.12 on the broad face. This sharpens edge reflections without replacing accepted world-space lights, reflection environment or exposure. The face remains softer than the roll.

Centered WebPod name/mark and a small WP–5G badge use.34roughness against the polished metal; fine DESIGNED FOR MUSIC lettering completes the understated lower hierarchy. Their contrast responds to the reflected field, becoming lighter over dark reflections and darker over bright reflections. A.018model-unit depressed bump contributes a very shallow etched edge. The initial.035candidate looked too raised at the bottom tilt, so its depth was reduced before final capture. Engraving content is concentrated in BACKPLATE_ENGRAVING and can be replaced without changing layout/material generation. Default branding followed lead direction while optional owner choice remained open.

These are roughness/bump maps on the original physical material, not colored/emissive ink or a separate plane. Roughness uses green-channel non-color data; bump is white base/black incision. Rear viewing text is mirrored in UV authoring to read correctly from-Z. Markings stay well inside the flat rear face, with no geometry to leak around the sides. Clamp wrapping and full-shell UVs prevent repeated text. Both maps are explicitly disposed. The nominal configurable steel roughness scales the profile; its maximum is clamped to1.

## Scope preserved

No changes to three-light rig, product studio environment, renderer exposure/tone mapping, front material constants, LCD/glass/aperture, hardware geometry, Settings or interaction code. Only Device.tsx rear map integration plus new backplate-finish.ts/test changed. Noise/anisotropy fallback remains; procedural finish maps supersede the rear roughness map when DOM canvas is available. No new Blender asset needed and no commits made.

## Verification

-4affected tests pass, including130361assertions covering symmetric monotone polish and actual hardware-cut rear geometry UVs. Package TypeScript and three-file lint pass. Logs in evidence/unit.txt,typecheck.txt,lint.txt.
- Actual Chromium canvas probe verifies11031fully engraved pixels all have green255 and black bump, face green90 vs edge34, white unengraved bump, non-color map space, clamp wrapping and both disposal events. Reproduce with evidence/verify-maps.ts; result map-verification.json.
- Same-state before/candidate1/final captures: both finishes, straight rear, both rear quarters, top/bottom45°tilts and front quarter. Lighting/environment/camera settings unchanged between sets. No browser page errors. Evidence/capture-backplate.ts is the reproducible script; it uses standalone production-surface diagnostics, so LCD is intentionally blank in these material comparison images.
- Bounded saturation proxy over central rear-face ROI[430,370,595,680] across10finalrearposes reports0%strict-white and0%near-white. It excludes intentional rolled-edge catches and is not calibrated photometry or a substitute for visual judgment; see evidence/saturation.json.

Independent review disposition is owned by reviewer/lead. No further tuning requested after final shallow-etch image acceptance.
