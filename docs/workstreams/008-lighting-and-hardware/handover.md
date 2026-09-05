# Lighting and hardware — completed

Same supervised team: Astra physical hardware engineer, lighting/material engineer, independent reviewer. Direct procedural changes selected; Blender not required.

## Delivered
- Broad lower-left area fill gives the body and wheel directional depth; key remains upper-right. Reduced emitter radiance and closer larger sources retain front illumination without extreme steel glare.
- Rear texture roughness encoding corrected from RedFormat to RGBA green-channel data consumed by Three. Revised steel roughness/environment response gives soft graduated reflections. White shell albedo adjusted to retain white identity; LCD/renderer exposure unchanged.
- Nearly flush hold slider with orange end, recessed 3.5mm headphone socket, bottom 30-pin cavity/contact tongue and thirty contacts. Real shell openings, inward walls and bounds-aware hardware; no functional/electrical behavior claimed.

## Verification
Final device suite 225 pass; reviewer total 248 scoped units pass, three package/app typechecks and scoped lint pass. Lead independently reran device/composite/web typechecks and git diff --check successfully. Rear screenshot sweep covers 30 poses with no exact-white pixels within measured plate interior; thin edge highlights and arbitrary untested poses are not covered by that metric. Reviewer independently reproduced measurements. Both finishes and top/bottom oblique geometry visually checked. Sources/limitations and raw evidence in lighting-handover.md and hardware-handover.md.

Browser regression: 8 of9 device-orientation cases pass. Remaining prior native-text-selection expectation conflicts with pre-existing user-select:none in the user-owned route; no app files changed by this follow-up. Preserved that unrelated baseline rather than altering user changes. Final review: reviews/final.md. Browser source fingerprint7245a2eef8acc3c499ee1c826d7c5a4212b1d7d72b36a1fabcdc2f4f7e5fcc7a,243files.

No commits/pushes. Preserve previous user/007 dirty changes when staging. Suggested later coherent slices: correct steel response and balance studio lights; model recessed top controls and dock connector. Final owner visual judgment available through evidence/lighting/final-black-rear-low.png and evidence/hardware/*-oblique-detail.png.
