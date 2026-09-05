# Blender design and rigging review — revision 3

Owner approval is requested for the design and rigging before browser integration.
No approval has been inferred from continued work or feedback.

- [Four states: idle → pinch → grab → press](four-states.mp4)
- [Coordinated thumb/index pinch, side view](pinch-motion.mp4)
- [Transient directional smear and recovery](flick-smear.mp4)
- Editable source: `assets/hand/review-v3/padded-glove.blend`
- Independent rig library: `assets/hand/review-v3/hand-rig.blend`

The thumb now has a separate longitudinal base-turn control. Its sweep toward the
index is distinct from that turn. The index MCP and PIP flex during the same pinch
transition. The actual anatomical drawings and rig mapping are documented in
`reference/thumb-opposition-drawings.md` in this workstream.

The main view is dorsal and more top-down; the detail view deliberately exposes
the pinch from the side. Palm and exposed-skeleton stills are included alongside
these clips. The directional smear clip uses a wider review camera to prevent
cropping; it is artist-keyed, not connected to live cursor acceleration yet.

Checks: independent library contains no meshes; all glove vertices have normalized
weights; tested geometry is finite; no lateral PIP/DIP animation; motion scale
recovers to (1,1,1). These checks support review and do not establish owner approval
or certify anatomical correctness. The glove's surface finish and gesture quality
remain visual judgments for this review.

The source uses Blender corrective smoothing and subdivision. Browser export and
acceleration triggering are still pending and will follow approval, with their own
runtime verification. Browser mounting remains disconnected.
