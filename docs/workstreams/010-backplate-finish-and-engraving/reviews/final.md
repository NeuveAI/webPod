# Independent review — backplate finish and engraving

**Verdict: APPROVE.** No unresolved critical or major findings. Review is limited to workstream010; earlier dirty changes remain baseline. No implementation edits or commits by reviewer.

Both external reference photos were inspected as finish/shape/engraving references, without adopting their lighting, scratches, reflected people/room or private serial. Final WebPod/WP–5G engraving is restrained and centered. Straight rear and tilted views show sharper perimeter catch, softer reflective face and engraving contrast that changes with the reflected field. Final bump depth0.018 reads shallower than candidate1's0.035, particularly around the lower badge. This is a normal-map-style etched surface response, not a claim of physically cut geometry.

The engraving modifies the existing steel shell's roughness and bump maps. It introduces no plane, emissive text, depth offset, extra mesh or silhouette geometry, so it does not recreate the old floating backside settings decal. Rear UVs map XY continuously through hardware aperture cutting; the horizontal reversal makes text readable from behind. Marks remain far inside the shell footprint. Quarter/front and bottom-tilt images show no engraving leaking around the side, and hardware remains readable.

The finish varies only material roughness from a polished narrow perimeter to a softer main face. Maps use linear data and the roughness green channel. Black marks in the otherwise white bump map produce shallow depressions with the positive bump scale. Texture construction is memoized and both owned textures dispose on unmount; partial creation failure also disposes the first map. No recurring per-frame work was added.

Independent baseline comparison is recorded in `../evidence/reviewer-baseline.json`: light rig, renderer defaults, product studio, StudioEnvironment, existing material values, LCD aperture, product shell geometry, hardware and original texture module are unchanged. The Device diff contains only the new rear map import, memoized creation/cleanup and steel material binding. Rear texture changes also affect the visible steel side in front-quarter views; the front polymer, lighting and flat LCD source remain unchanged. Final front proof uses the existing blank diagnostic LCD, so it establishes silhouette/material continuity rather than replaying active panel content.

## Independent verification

- `bun test packages/device`: **230 pass, 0 fail**,33files. Log: `../evidence/reviewer-tests.log`.
- Device `bunx tsc --noEmit -p tsconfig.json`: pass.
- Scoped `bunx --bun eslint` on Device, backplate-finish and its tests: pass.
- Independently reran the actual Chromium `evidence/verify-maps.ts` probe:11031fully etched bump pixels, zero wrong etched green channels, face green90 versus edge34, white base bump255, clamp wrapping, linear NoColorSpace, two disposal events. Meaningful unit checks also cover the smooth symmetric roughness profile and actual hardware-cut rear shell UVs.
- Inspected candidate/final straight rear, rear quarter, bottom tilt and white front quarter. Final12same-state images include both finishes and both rear-quarter directions. The documented10rear-view central ROI saturation proxy reports0%strict/near white; it deliberately excludes bright rolled edges and is bounded evidence, not photometric calibration or proof over every angle.

No broad interaction browser suite was rerun because this slice changes only rear material maps. Whole-product visual judgement supports the more polished finish without broad rear washout; final aesthetic preference remains with the owner.
