# Padded glove — revision 3 review candidate

`padded-glove.blend` is the editable Blender source. `hand-rig.blend` is a library:
append its `HandRig_v3` object. The library was inspected and contains one rig
object, one armature and **no meshes**. The source separates RIG, SKIN and STUDIO.

The anatomy foundation comes from Blender's installed Rigify human metarig
(Blender Foundation, GPL-2.0-or-later). This adaptation has three fingers plus a
thumb, a compact palm, widened middle-finger placement, an open thumb bind pose,
and an original padded skin. Final digit count remains subject to owner preference.

Thumb opposition is informed by the actual eOrthopod/MMG and Orthobullets drawings
listed in `docs/workstreams/013-cartoon-hand-cursor/reference/thumb-opposition-drawings.md`.
The reference drawings do not prescribe this model's numerical pose angles.
The earlier numerical contact optimizer is removed from the build script.

## Controls

Select the named control bone and edit its Custom Properties:

- `CTRL_thumb`: `base_turn` turns the metacarpal about its long axis; `base_sweep`
  and `base_lift` position the thumb base. `MCP_flex` and `IP_flex` bend its two
  phalanges. Properties are artist-facing degrees in the rest bone's local axes.
  The metacarpal uses YXZ rotation order so its longitudinal turn does not move
  the base bone's endpoint; sweep/lift position that endpoint separately.
- `CTRL_index`, `CTRL_middle`, `CTRL_pinky`: separate MCP/PIP/DIP flexion and MCP
  spread. Middle/distal finger joints have no sideways driver.
- `CTRL_motion`: travel plus a `smear` property; zero restores normal proportions.
  Directional stretch is inherited by the entire bound skin, including the cuff.

The same timeline animates all four states and a short flick. Markers identify
idle (1), pinch (37), grab (73), press (109), return (145), smear (155), recovery
(169). The pinch transition moves thumb and index together. At its endpoint,
index MCP/PIP add 30°/40° relative to the relaxed bind pose; these are authored
animation choices, not universal anatomical limits.

## Review scope and limits

The camera views the dorsal side. Three decorative points are on that side;
thumb/index side evidence is also rendered. The skin uses normalized heat weights,
volume-preserving armature deformation, corrective smoothing and subdivision.
Those Blender modifiers are not assumed to transfer directly to a browser export.

The smear is keyed for design review. It is **not yet driven by live cursor
acceleration**. Browser code remains disconnected; no approval has been inferred.
Final approval must cover design, anatomical motion, deformation, four states,
camera and smear treatment before browser integration.

The audit checks joint participation, absent lateral finger-hinge rotation,
weight coverage, sampled finite geometry and smear recovery. It cannot certify
anatomical correctness, collision-free surfaces or visual quality. Render review
and owner approval remain necessary.

Rebuild in order:

1. `scripts/hand/build_glove_v3.py`
2. `scripts/hand/review_glove_v3.py`
3. `scripts/hand/inspect_glove_v3.py` and `scripts/hand/render_detail_v3.py`

Run each with `/Applications/Blender.app/Contents/MacOS/Blender --background --python`.
