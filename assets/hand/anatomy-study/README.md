# Anatomical articulation study — not an approved glove

Open `anatomy-study.blend` in Blender. Frames 1–25 show the source rest structure,
55–85 show the pinch study, and 115 returns to rest. This is a five-digit human
comparison study, not a decision on the final cartoon glove's digit count.

- Blue rods: four finger metacarpals. Blue sphere: wrist anchor; individual carpal
  bones are deliberately omitted.
- Ivory rods: proximal, middle and distal finger phalanges.
- Coral chain: thumb metacarpal, proximal phalanx and distal phalanx.
- Turquoise crossbars: local flexion axes. The two additional turquoise markers
  at the index/thumb tips show proposed pad positions and normal directions.

The source rest structure is created through Blender's installed Rigify
`rigify.metarigs.human.create` API, then uniformly scaled and rotated. Its source
is Blender Foundation's Rigify human metarig, distributed with Blender under
GPL-2.0-or-later. No third-party glove mesh is included. The thumb is parented to
the hand root independently of the index metacarpal. Local finger hinge axes and
segment lengths are retained; the pinch is an authored structural study.

In this normalized source frame, **+Z is palmar and -Z is dorsal**. The previous
rejected model used the opposite convention. Do not mix those conventions.

The contact fit varies thumb-base orientation, thumb MCP/IP flexion and index
MCP/PIP/DIP flexion. It never rotates the index middle/distal joints sideways.
The fit uses artist-selected search bounds, not medically established range limits.

This does not establish final glove quality. Surface padding, actual pad contact,
thumb webbing, palm masses, all four cursor states, skin deformation, smears and
independent production controls remain to be built and reviewed. Numeric contact
and axis checks are evidence about this study only. Browser integration remains
subject to the owner's design AND rigging approval.

Rebuild: `/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/hand/build_anatomy_study.py`
