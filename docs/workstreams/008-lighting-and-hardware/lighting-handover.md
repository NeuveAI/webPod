# Lighting and steel response handover

Frozen lighting slice. The front now has a perceptible broad lower-left fill, and the rear keeps graduated metallic reflections rather than clipping to a white slab. No renderer exposure, tone-mapping, LCD, app, provider, or Settings behavior changed.

## Actual causes and ownership

The rear mesh owns `createRoomEnvMap()` explicitly; it does not inherit StudioEnvironment. Its old radiance used reciprocal steel-albedo gain, 1.18 room exposure and two sharpening passes, plus contributions from both real RectAreaLights. Front plastic and hardware use a separate PMREM RoomEnvironment. The old lower-left lamp carried only 9.5% key power / approximately 6.7% key surface radiance.

The decisive bug was the roughness texture: `createMicroNoiseRoughnessMap()` returned RedFormat, while installed Three 0.185.1 samples `roughnessMap.g`. Red-only texture sampling supplies zero green, so the rear stayed at the shader's mirror floor regardless of its authored roughness. The generator now puts deterministic noise in RGB of an RGBA texture, alpha 255. Its only runtime caller is Device.tsx; `materialMapOwnership` assigns it only to the steel. The front and hardware roughness are unaffected. Parent explicitly expanded this slice to the generator and tests; prior texture changes were preserved.

Grounded in installed Three `roughnessmap_fragment.glsl.js`, `lights_physical_pars_fragment.glsl.js`, `RectAreaLight`, `RoomEnvironment`, and renderer environment-intensity ownership; also consulted official Three docs. RectArea luminous intensity remains power / (area * pi), with normal Three LTC shading. No view-dependent shader shading or painted gradients were introduced.

## Final tuning

- Key: 2,000,000 lm, 900 x 720 emitter, distance 400, existing upper-right 45° azimuth / 40° descent.
- Fill: 80% key power, 1000 x 820 emitter, distance 360, existing lower-left -45° azimuth / -18° elevation and lower-body target. Its larger area keeps surface radiance below the key.
- Rig exposure unchanged at 0.92. Key radiance is below 1; nearer sources retain diffuse coverage at the reduced radiance.
- Steel stays fully metallic, original silver color, roughness 0.26, anisotropy 0.25, environment intensity 0.4. Room exposure 0.78, original room structure retained, sharpening amounts both zero.
- White shell albedo scale 0.95 restores the ivory identity under the lower-radiance rig. Other front/wheel/Select/glass material values are unchanged.

The first roughness/radiance candidate improved matched rear images but the dense sweep found another full-plate clipped angle (-24° pitch,195° yaw). The final revision lowered lamp radiance, moved sources closer, and reduced rear environment gain. It was re-captured and measured across the sweep, not accepted solely from the flattering poses.

## Visual evidence and proxy measurements

All raw captures and scripts are in `evidence/lighting/`. They use the real localhost:3000 `/_spike/device` route with the existing deterministic Apple fixture; production front/quarter captures include the integrated LCD. No proof-only route or API was added. `capture-source-sha256.json` identifies relevant final source files. The hardware slice changed between before and after; the interior rear ROI deliberately excludes ports and edges.

- Matching before/final front, quarter, rear, rear-quarter, rear-low and rear-high for both finishes.
- Final rear sweep: pitches -24/0/+24 by yaws 150/165/180/195/210, both finishes, 30 samples.
- `clipping-and-fill.json` records exact-white and nearwhite clipping, retained luma percentiles, and front illumination samples. `measure.py` uses a manually checked interior rectangle [490,260,710,700] within the 1200x900 captures. It excludes LCD, background, ports, and rolled edges; marked ROI images show the sample boundaries. This is a screenshot/sRGB proxy, not radiometric certification or proof of every possible angle.
- Matched original rear samples reached 100% exact RGB255 within that ROI. Across all final rear samples the maximum exact-white fraction is 0%; maximum all-channels >=250 fraction is 1.946%. Thin bright curved-edge highlights are outside the ROI and remain intentional.
- Final black front lower-left shell mean sRGB code-value luma: key-only 4.88, fill-only 19.51, combined 22.84. Lower-right: key-only 9.12, fill-only 10.89, combined 18.63. The lower-left wheel region: key-only 17.65, fill-only 38.43, combined 45.02. The relative footprint and matching images show light arriving from lower-left rather than an indiscriminate front gain.
- `final-*-front-{combined,key-only,fill-only}.png` and `final-*-worst-rear-*.png` are contribution checks. Caveat: the existing diagnostic route disables StudioEnvironment for key-only/fill-only but keeps the explicit rear room map in all three. Therefore combined-minus-key is not mathematically pure fill; key/fill front samples both share absent IBL. An env-only mode is not exposed by the existing route and none was added.
- At the former worst rear angle, final key-only luma p10/p90 is 226.7/228.7, fill-only145.6/161.5, combined229.4/238.4. This confirms the key reflection dominated that pose, with the rear's explicit map present in each.

Recommended lead images: `final-black-front-combined.png`, `final-black-front-key-only.png`, `final-black-quarter.png`, `before-black-rear-low.png`, `final-black-rear-low.png`, `final-black-sweep--24-195.png`, `final-white-front.png`.

## Verification

- Final `bun test packages/device`: 225 pass,0 fail,141263 assertions across32 files. Saved `evidence/lighting/device-tests.txt`.
- `bunx tsc --noEmit -p packages/device/tsconfig.json`, `packages/composite/tsconfig.json`, and `apps/web/tsconfig.json`: PASS.
- Scoped `bunx --bun eslint` on all lighting/material/texture changed code and tests: PASS.
- Regression now guards RGBA green noise encoding, bounded effective roughness multiplication, the installed shader's channel contract, low emitter radiance, broad subordinate fill, world-fixed lamps, and current revised defaults.
- No geometry/app/provider files edited by this slice, except the narrow approved textures.ts/test additions. No commits.
