# Product studio and flat display — engineer handover

Implementation and visual tuning frozen. Lead accepted candidate2; final evidence uses the same physical source. This is a researched interpretation of product photography, not a claim to reproduce Apple's private lighting recipe. Research and scope are in this workstream.

## Physical scene

Three real RectAreaLights are siblings of the rotating device: elevated key (35° azimuth/38° descent, distance650, power6.5M,620×820), broad lower-left fill (-48° azimuth/-18° elevation, distance580,42%power,800×700), and tall rear strip rim (position[-390,110,-280],16%power,160×760). The fill aims toward[-65,-145,0], giving the lower face deliberate support. Light roles remain world-fixed through rotation.

A PMREM scene with three passive diffusion cards and dark negative space supplies controlled reflections. This environment stays identical during combined/key/fill/rim/environment-only comparison; isolated passes remove only actual direct emitters. The old striped calibration environment remains an explicit override, no longer the production steel default. Card geometry/material resources are disposed.

AgX with exposure1 shapes physical highlights. LCD and reveal materials remain toneMapped=false, preserving canonical UI texture colors. R3F's renderer lifecycle and Three's bypass were independently reviewed. Black/white pigments did not change. Plastic roughness/clearcoat and steel roughness(.14), anisotropy(.12), environment gain(.65) restore polished material character rather than merely suppressing clipping. Hardware, corrected green-channel roughness encoding, Settings behavior and shell dimensions are preserved.

## Exact display repair

The LCD and glass were already planar. Three's inner bevel miter vertices were3.504–3.517units from the nearest contour vertex, exceeding the old3.50001candidate threshold. Uncollapsed top bevel triangles intruded over the LCD and inherited the body's crown. The repair identifies candidates using nearest boundary segments with the exact tessellation miter allowance, then returns generated vertices to their corresponding authored contour vertices across depth layers. This removes only the aperture's automatic inner slope; the exterior crown and wheel remain intact.

Independent regression rays traverse the complete repaired+crowned production shell. Front rays test all four active edges at.1/.5/1.5unit margins. Quarter rays retain tight top/bottom tests away from side corners. At the steep near side a recessed LCD is legitimately hidden by its vertical wall: camera[1100,380,790]→target[135.9,58,26.1701] hits[141.5919,59.9010,30.6797]. Those side rays assert any occluder remains outside the active LCD width, rather than requiring an impossible unobstructed recess. Reintroducing the old nearest-vertex candidate threshold in an isolated copied module fails the independent border regression; production code was never mutated during captures. See evidence/mutation.txt and mutation-probe.ts (non-test filename intentionally prevents discovery by normal suites).

## Verification and evidence

- packages/device:227tests pass; evidence/tests.txt.
- Independent reviewer:347device/composite/related app tests, three scoped TypeScript checks, changed-file lint and8orientation/interaction browser checks pass (reviewer artifacts in evidence).
- evidence/final-display: integrated active LCD, black/white front and quarter, DPR3 with complete bezel margins; source hashes stable. Seven front top transition samples have0pixel spread in each finish. Investigator documents measurement limits.
- evidence/final-studio: five same-environment isolated light passes,30rear views spanning both finishes, pitch-30/0/30 and yaw±140/±160/180. No browser errors. Central rearplate ROI has0%strict-white and0%near-white across30views; this bounded saturation proxy excludes rolled edge highlights and is not a calibrated photometric or aesthetic metric.
- evidence/candidate2: integrated player front/quarter/rear proof under accepted final physical source. evidence/before and candidate1 retain the visual progression.

No Blender asset is needed: the existing procedural model permits exact aperture repair and preserves interactive hit regions. No commits made. Visual result still requires owner's subjective acceptance; no proprietary Apple scene equivalence claimed.
