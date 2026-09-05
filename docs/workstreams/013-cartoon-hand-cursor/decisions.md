# Decisions

## Revision 3 — reference-led thumb/index correction

Inspected actual CMC/opposition drawings and recorded the visual observations in
`reference/thumb-opposition-drawings.md`. Removed the contact optimizer from the
glove build. The authored pinch moves thumb and index together: explicit metacarpal
turn/sweep/lift and index MCP/PIP flexion. Changed thumb-base rotation order to YXZ
so longitudinal turn is independent of the base segment's endpoint positioning.
The angle choices are animation decisions, not measurements from the drawings.

`assets/hand/review-v3/padded-glove.blend` now has named digit controls and separate
RIG/SKIN/STUDIO collections. `hand-rig.blend` was inspected: one rig, one armature,
zero meshes. The motion layer has an independent transient stretch property.
The flick is artist-keyed for review; live acceleration triggering remains future
browser work, gated by owner approval. No design or rigging approval is inferred.

The review evidence includes four-state renders, a palm-side check, exposed
thumb/index structure and animation. Numeric checks confirm coordinated MCP/PIP
participation and no lateral finger middle/distal-joint rotation. They do not
certify anatomical correctness or surface quality; owner review remains necessary.

## Revision 2 rejected — anatomy governs the replacement

The owner rejected revision 2's anatomy and explicitly requires anatomy research
even with cartoon proportions, exaggerated motion and smear frames. The lateral
index curl and undifferentiated thumb curl invalidate this rig as a foundation.
The historical description below is not evidence of correctness or approval.

`anatomy-research.md` records inspected anatomy and cartoon-hand references and
their application. Establish metacarpal structure, knuckle arc, finger hinge axes,
and thumb-base opposition in a Blender structural study before surface polish.
Check ordinary poses with smear deformation disabled; inspect smears separately
for intentional distortion and recovery. Both design and rigging still require
owner approval before browser integration.

## Owner rejection — revised Blender review only

The owner rejected the first mesh's thin digits, outer-joint flap, palm-side
stitching and palm-facing camera. Exact feedback and the primary image are recorded
in `owner-feedback.md` and `reference/owner-glove.png`. Revision 2 is under
`assets/hand/review-v2/` and `evidence/review-v2/`; the original is retained as
rejected history. No approval has been received or inferred.

Rebuilt the padded volumes with continuous capsules, added a wall-thickness cuff,
surface-following dorsal seams, three flexion joints per digit, heat weights and
artist-facing control properties. Added a 113-frame Blender control animation,
side/palm/rig checks, and explicit documentation of Blender-only deformation
modifiers. Corrected thumb/finger crowding found in the first revision-2 side check.
The fixed camera is roughly 63° above the hand plane, viewing the dorsal side.
All browser mount/style/test changes remain reverted; draft browser code is not
compatible by assumption with this redesigned rig and must not be remounted.

## Owner correction — approval required before integration

The owner explicitly requested approval of design and rigging before browser work.
The earlier assumption that optional style defaults authorized integration was
incorrect. Root mount and glove CSS removed; original native-pointer browser tests
restored, with proposed changes saved in `evidence/browser-tests-draft.patch`.
`apps/web/src/hand-cursor/` is an unmounted draft only. Opened the actual Blender
source for owner inspection. Wait for explicit design AND rig approval before
continuing integration. Earlier browser evidence records a premature prototype,
not an approved product change.

## Earlier implementation history

- User authorized Blender design/rigging, desktop cursor replacement, all four
  poses, acceleration smears and reference research. Optional style question had
  no answer during implementation; proceeded with the documented soft 3D default.
- Authored an original three-finger-plus-thumb glove. Pinch has a curved index
  opposing the thumb, grab curls all fingers, press leaves index extended, idle
  relaxes the remaining fingers. Separate source library contains only the rig.
- Reused existing Three.js and Jotai dependencies. No package/lockfile changes.
  Loader, manager and animation APIs were inspected in installed sources.
- Pointer overlay is client-only, fine-pointer-only, lazily imported and passive.
  A small offscreen WebGL renderer draws the skeleton; a 192px 2D canvas composites
  up to two short-lived multiples. This avoids a viewport-sized GPU overlay and
  keeps smears independent of skin material/shader implementations.
- Stable pointer contact is recalculated after skeletal pose interpolation and
  directional stretch, rather than smoothing the real click location.
- Native pointer suppression requires a successful draw. Loading, invalid asset,
  GPU failure, blur, leaving the viewport, keyboard Tab, touch and editable fields
  restore the underlying native behavior. Context loss falls back until remount
  or a skin change; no automatic infinite retry loop.
- Shared Jotai atoms own input and skin selection. Animation internals are bounded
  renderer state outside React; pointer movement does not rerender React.
- All active enclosure captures take priority over hover, including dragging over
  unrelated controls. No geometry/hit-testing/rotation code was modified.
- Updated the existing native-cursor browser test to the new product requirement.
  The selection-note assertion was already stale (current CSS says `none`); matched
  the existing CSS without changing text-selection behavior.
- Local global guidance says not to add unit tests. Used browser behavior checks
  plus asset-structure inspection, typecheck, lint and production build instead.
- Scoped sequential local work; no agent delegation, commits, pushing or publishing.
  Existing unrelated changes preserved. Commit suggestions are in scope.md.
