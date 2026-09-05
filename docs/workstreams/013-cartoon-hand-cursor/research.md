# References and implementation research

## Revision 2 — applied reference, replacing the rejected first design

Primary: owner attachment preserved at `reference/owner-glove.png`. The owner
rejected the initial model; its proportions, camera and skin-weight method are
anti-sources for this revision.

| Observation from owner reference / feedback | Applied change | Review evidence |
| --- | --- | --- |
| Padded, substantial digits | Constant-width capsule volume with rounded ends; finger diameters 0.66–0.70 model units; no tapered segment junctions | `evidence/review-v2/idle.png` |
| Thumb opposes a curved index | Dedicated side-bend controls make a readable open pinch | `evidence/review-v2/pinch.png` |
| Rolled substantial cuff | Open rounded-rectangle mesh with inner/outer walls and rounded lip | All four pose renders |
| Back of hand faces viewer | Dorsal is +Z, finger flexion is toward palm (-Z); camera at approximately 63° above hand plane | Same fixed camera for all four poses |
| Detail belongs on back | Three restrained surface-following seams, weighted to the underlying dorsal surface | `palm-check.png` and dorsal views |
| No flap at outer finger | Replace discontinuous nearest-chain weighting with heat diffusion; three bending joints per digit; volume preservation and corrective relaxation | `outer-joints.png`, actual 113-frame rig transition |

Supporting rig references revisited:

- [Andy Cuccaro's hand rig, creator description](https://www.blendernation.com/2022/09/01/carrtoon-hand-rig-free-download/): separation of artist controls and deformation rig. This revision supplies named curl/spread/side-bend controls; it does not claim Cuccaro's IK/FK feature set or use his asset.
- [Blender Armature modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/armature.html): preserve-volume deformation. Blender-only review uses this explicitly; any later browser export needs its own deformation parity check.
- [Blender skinning/automatic weights](https://docs.blender.org/manual/en/latest/animation/armatures/skinning/parenting.html): heat weighting is a starting point and must be inspected under actual poses. Direct page retrieval was unavailable; the installed Blender operator is used and the results are checked through renders.
- [Johnson Martin's hand topology study](https://johnson-martin.artstation.com/projects/5XBw58): supporting pointer to deformation-oriented topology. The linked topologyguides page returned 403; no claim that its full guide was read or its topology reproduced.

The revision remains Blender-only. No reference link or numerical check substitutes
for visual inspection of the rigged result, and no design approval is inferred.

## Earlier research history

Researched 2026-09-05. References inform original work; no third-party asset used.

## Form and posing

- [Andy Cuccaro's Toon Hand Rig](https://www.blendernation.com/2022/09/01/carrtoon-hand-rig-free-download/): creator's overview of three-finger hand, layered controls and IK/FK. Supports simple finger chains independent of appearance.
- [Four-finger glove pose collection](https://www.cgtrader.com/3d-models/character/clothing/cartoon-glove-hand-rigged-with-4-fingers): visual reference for cuff/palm proportions and readable curled silhouettes.
- [Lucian Bogdan glove model](https://bigfrog.artstation.com/store/VXgXj/cartoon-glove-hand-with-4-fingers-low-poly-3d-model-uv-mapped): artist reference for rounded low-poly glove forms.
- [Cartoon hands in gloves](https://www.turbosquid.com/3d-models/cartoon-hands-in-gloves-rigged-for-maya-3d-model-1995257): visual reference for padded palms, rolled cuffs and finger spacing.

The cursor needs greater silhouette separation than a full-size character hand:
index-led idle, opposed thumb/index pinch, all fingers closed for grab, index
extended with other fingers curled for press. Keep size modest to avoid covering
the iPod's controls. Use a distinct contact marker per gesture.

## Motion

- [SMEAR, Blender Extensions](https://extensions.blender.org/add-ons/smear/): author describes elongated in-betweens, multiple in-betweens and motion lines. Use directional deformation and short-lived multiples rather than continuous blur. No add-on dependency.
- [Bloop Animation: The Art of Smear Frames](https://www.bloopanimation.com/the-art-of-smear-frames/): supports sparse, deliberately drawn transitions and different treatment for fast actions.
- [Animation Club: Smears](https://animationclub.school/blog/the-art-of-smears-in-2d-animation/): stretched silhouettes and overlapping hands communicate trajectory.

Design: compare acceleration against a time-based moving baseline, with absolute
speed/acceleration floors to reject jitter; cap duration, displacement and scale.
Time-based pose blending and wrist follow-through should be frame-rate independent.

## Canonical technical sources

- [Blender glTF manual](https://docs.blender.org/manual/en/5.0/addons/import_export/scene_gltf2.html): mesh skinning, pose-bone animation, named actions; constraints need baking to exported transforms.
- [Three.js docs](https://threejs.org/docs/): GLTFLoader and AnimationMixer use canonical installed 0.185.1 types. Exported skeleton drives all poses; runtime does not encode skin-specific finger geometry.
- [MDN coalesced pointer events](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents): API has limited availability; ordinary pointermove is a valid universal source and must remain supported.
- [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion): honor live preference changes, retaining direct positional feedback.
- Local Jotai source: `/Users/vinicius/code/.better-coding-agents/resources/jotai/docs/core/store.mdx` — external store get/set/sub shared by renderer and callbacks.
- Existing integration: `packages/device/src/cursor-intent.ts`, `apps/web/src/device-preview-orientation.ts` — authoritative hover and captured enclosure state.

Modern-web-guidance search completed through bunx. Its reveal/mask guidance is
adjacent but does not define a skeletal cursor; use a pointer-transparent canvas,
feature detection, transform positioning and explicit native fallback.
