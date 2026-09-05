# Padded glove — owner design/rig review

This replaces the rejected visual direction for review. Browser integration is
disconnected and requires explicit approval of BOTH design and rigging.

## What to open

Open `padded-glove.blend`. It opens on the dorsal review camera, with pinch posed
on frame 29 of **Review • idle → pinch → grab → press**. Play frames 1–113 to inspect
the actual control-driven transitions. The source contains the separate **SKIN**,
**RIG** and **STUDIO** collections.

`hand-rig.blend` contains the same armature, controls, drivers and actions without
the glove mesh. This is the reusable rig source for future skins.

## Reference and changes

Primary reference is the owner's image stored in
`docs/workstreams/013-cartoon-hand-cursor/reference/owner-glove.png`.
The revised form uses rounded padded digits, a fuller back, a curved index/thumb
pinch opening and a rolled cuff with an actual interior. Three restrained seams
follow only the back surface. The camera is about 63° above the hand plane, angled
from the thumb/wrist side, with the back toward the viewer.

## Controls

Select the armature and enter Pose Mode. In the **Controls** bone collection,
select `CTRL_index`, `CTRL_middle`, `CTRL_outer` or `CTRL_thumb` and edit custom
properties in the sidebar:

- `curl`: flexion toward the palm.
- `spread`: lateral movement at the finger base.
- `side_bend`: lateral curvature of the second/third joints (used for pinch).

The wrist and back also have ordinary FK transforms. The deformation collection
contains 14 bones: wrist/back plus three joints for each of the four digits.
Two non-deforming bones mark index/thumb contacts. This is an FK/control-property
rig, with no IK snapping or collision solver claimed.

Four named actions (`idle`, `pinch`, `grab`, `press`) store poses through the control
properties. Their NLA tracks are muted; use the active action for preview. The
review action demonstrates the authored range. The control range itself is not
a guarantee that every arbitrary combination is collision-free.

## Skin and deformation

The source mesh is a continuous voxel-remeshed volume with constant-width finger
capsules, heat-diffusion weights normalized per vertex, volume-preserving armature
deformation, corrective relaxation and a final subdivision finish. Dorsal seams
inherit nearby skin weights. The cuff is a separate rigidly wrist-bound mesh.

This is a Blender design/rig source, not a production-ready browser export.
Preserve Volume and Corrective Smooth are Blender deformation features. After
approval, browser export must prove equivalent joint shape or bake corrections;
the old browser draft must not be treated as compatible with this new rig.

## Reproduce the review

From repository root, sequentially:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/hand/build_glove_v2.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/hand/review_glove_v2.py
```

The second script adds the review timeline/organized bone collections, saves both
Blender sources, renders the side/palm/skeleton checks, audits weights and finite
evaluated geometry across 113 frames, and renders animation frames. Numerical
checks do not prove visual quality; inspect the rendered deformation as well.
