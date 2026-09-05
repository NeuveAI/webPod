# Display bow diagnosis

The LCD is planar. A leftover bevel on the front-body aperture covers its top strip, creating the apparent bowed edge. This is a geometry/occlusion defect, not refraction, an LCD texture warp, or the new light rig. Investigation remained read-only for implementation files; the only mutations were temporary visibility toggles in an isolated browser instance, reverted between captures and discarded on browser close.

## Reproduction and decisive isolation

Captured the existing integrated production route at localhost:3000/_spike/device?capture=, Chrome with CanvasDrawElement enabled, viewport1200x900 and DPR3. The deterministic Apple fixture supplies repeatable content. `evidence/display/before-lcd-close.png` reproduces the owner's upper-edge shape.

Independent live-scene visibility comparisons preserve every other mesh, light, camera and material:

- Hide only `device-body`: upper active boundary becomes straight.
- Hide only display well: bow remains.
- Hide only display mask: bow remains.
- Hide only cover glass: bow remains; only expected glass brightness disappears.

The 1059x807 close captures show the first bright LCD row at y30 across the center, rising to y24–25 near the corners. Without only the body mesh it is y24 at every sampled x (4%,10%,25%,50%,75%,90%,96%). That removes a6-device-pixel /2-CSS-pixel intrusion at DPR3. `image-top-boundary.json` records raw samples; thresholdmin(R,G,B)>90 is a screenshot boundary proxy, not the proposed geometry regression.

The scripts use the already-served R3F `_roots` development state to inspect the actual live scene; no new route or runtime API was introduced. The transient window references exist only in the investigator's isolated browser. All visibility states are restored before each independent comparison.

## Exact source cause

`Device.tsx` builds an ExtrudeGeometry of the front shell with an LCD hole and bevelSize3.5, calls `squareRoundedRectApertureWalls`, then tessellates/applies the shell crown.

`screen-aperture.ts` projects to the nearest sampled **outline vertex**, not the closest point on an outline **segment**. It only snaps candidates whose distance is <=bevelBand+1e-5 (3.50001). Three's bevel uses miter offsets. Relevant generated endpoints are slightly farther from a corner vertex than the nominal bevel width:

- Top straight-edge endpoints x=±131.8280487,y=250.5 have nearest-vertex distance3.50422135.
- Adjacent corner points have distances up to3.51694022.

Those vertices miss the cleanup predicate, leaving the generated inward slope across the top opening. The intended hole top is y254; the active LCD top is y252, so the residual edge at y250.5 intrudes1.5model units into the active image. Some neighboring bevel rings are snapped while these are not, producing the corner-to-center contour seen in the screenshot. The crown then modulates its depth; it is not the original root cause.

`aperture-measure.ts` reconstructs the production extrusion and crown without changing implementation. It identifies16unique missed top bevel vertices and raycasts the resulting mesh. Orthographic rays at x0 into the active top0.25/0.5/1/1.5units hit front body above the LCD; the2unit row clears.

The live production perspective camera at z1378.94948 corroborates the defect. `live-perspective-rays.json` records body intersections along camera-to-LCD-target rays at five x positions and six top offsets. The live screen geometry has only z=0 and z=0.10000000149 cap planes. Camera-side body hits occupy the active top strip even though the LCD cap itself is flat.

## Alternatives falsified

- `createScreenGeometry` has constant front-cap z and affine normalized x/y UVs; its extruded0.1 depth does not create a lens.
- Cover glass is a planar ShapeGeometry with transmission0, and removing it leaves the bow.
- HTMLTexture uses the same planar screen geometry. Its shader patch only decodes sRGB color; no spatial remapping exists. InteractionManager's separate planar proxy controls native hit testing, not the drawn shape. Removing body alone fixes the rendered boundary without changing either texture or composite mapping.
- Flat mask/well removal does not fix the defect. These layers remain relevant to quarter-angle aperture clearance but do not cause this top bow.

## Implementation guidance passed to Astra

Correct aperture projection/candidate identification using nearest segment geometry rather than merely increasing an arbitrary tolerance. Proper offset segment distance includes the miter vertices and projects them to the exact sampled outline. Preserve the exterior bevel and wheel opening. Then check front and steep-quarter visibility with the full live assembly; do not flatten the whole shell or lift the LCD merely to conceal a malformed aperture.

Current `screen-aperture.test.ts` is circular: it collects only points admitted by the same nearest-vertex/bevel-band predicate and proves those were snapped. It never asks about the actual missed vertices, so it passes the broken shape.

Meaningful regression proposal:

1. Build the complete production extrusion, cleanup and crown; use camera rays through the LCD's active top band (not corner-radius exclusion zones). Assert no nearer opaque body/well/mask hit, using a small geometric distance tolerance to reject coplanar numerical noise.
2. Cover both horizontal top endpoints and center, near-corner transitions, both sides/bottom, front-on and prescribed quarter poses. Check the full assembly's physical clearance rather than just a standalone planar screen.
3. Assert each expected hole-bevel layer remains on the true piecewise outline, with exterior and wheel vertices unaffected, finite triangles/normals, and no degenerate faces retained.
4. Re-capture an integrated LCD close-up at DPR3. Compare actual upper active boundary to the projected straight top line outside the intentional rounded corners; retain normal antialias tolerance. A source-string assertion is not proof of this behavior.

## Artifacts

All under `evidence/display/`: before-front.png,before-quarter.png,before-lcd-close.png; independent without-device-body/without-device-display-well/without-device-display-mask/without-glass.png; image-top-boundary.json; aperture-measure.ts/json; inspect.ts; live-perspective-rays.json; live-inspection.jsonl; source-sha256.json. Captures precede the fix. The earlier incorrectly named without-device-front-shell.png is not evidence and has been removed. No implementation files changed by this investigator.

## AgX LCD parity verification

After the lighting engineer enabled AgX, `evidence/display/tone-mapping-parity.ts` loaded the actual deterministic composite route in Chrome at DPR 3. It found the live renderer already using `AgXToneMapping` (6), exposure 1, and the actual LCD `MeshBasicMaterial` with `toneMapped=false`. In one unchanged scene it toggled only renderer tone mapping between NoToneMapping and AgX, once with the cover-glass overlay hidden and once visible. It restored the renderer and closed the isolated browser; no shared source edits or proof API were required.

The measured 971×719 pixel LCD interior excludes 20 physical pixels along each aperture edge. With glass hidden, the two screenshots are **pixel-identical**: maximum channel delta 0, mean channel delta 0, changed pixel fraction 0. This directly verifies that the LCD's HTMLTexture color decode and source remain unchanged by AgX. With the real physical glass overlay visible, the mean absolute channel delta is 5.036/255, maximum 6/255; this is the separately tone-mapped glass contribution, not a remapping of LCD content. The currently visible covered display is therefore not pixel-identical across tone operators, while the underlying emissive LCD is exactly preserved. See `tone-mapping-parity.json` and its four `lcd-*.png` captures. This is a matched render comparison in the current scene, not a calibration claim against the original owner's screenshot.

Installed Three's `WebGLRenderer.js` selects `NoToneMapping` per material unless `material.toneMapped` is true; the composite's existing `createHtmlTextureMaterial` explicitly disables it. The actual browser proof agrees with that source contract.
