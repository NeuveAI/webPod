# Anatomy is a design and rigging requirement

Latest reference pass: see `reference/thumb-opposition-drawings.md` for two actual
anatomy drawings inspected directly in the browser, observations from their arrows
and joint labels, and the explicit mapping to the thumb/index bones. This supersedes
any implication that a numerical contact fit establishes correct thumb motion.

The owner explicitly requires believable anatomy beneath cartoon styling,
exaggerated motion and smears. Revisions 1 and 2 are rejected. Their poses are not
anatomical references, even where the surface became smoother.

## Sources actually inspected

### Bones and proportions

[Stan Prokopenko — Hand Bones](https://www.proko.com/course-lesson/how-to-draw-hand-bones-anatomy-for-artists)

Read the public lesson notes. They distinguish wrist, metacarpus and phalanges;
describe a curved knuckle arrangement and different visible finger lengths on
palm/back because of webbing; and distinguish three finger phalanges from the
thumb's two beyond its mobile metacarpal. Applied requirement: explicit metacarpal
structure, staggered knuckles, separate thumb base and no lateral middle-joint
curl masquerading as ordinary flexion.

### Volume and thumb attachment

[Stan Prokopenko — Hand Muscles](https://www.proko.com/course-lesson/how-to-draw-hands-muscle-anatomy-of-the-hand)

Read the public lesson notes. Thumb-base and outer-palm masses sit around a palm
that has distinct planes. The thumb-base mass originates near the wrist and changes
with opposition; it is not a lump attached beside a finger knuckle. Applied
requirement: show the thumb metacarpal and its base volume, preserve depth at the
thumb/index web, and inspect the same pose from multiple sides.

### Surface form

[Stan Prokopenko — Hand Details](https://www.proko.com/course-lesson/how-to-draw-hands-details-for-realistic-hands)

Read the public notes. Dorsal and palmar finger surfaces differ: flatter dorsal
structure contrasts with compressing palmar pads. Applied requirement: padded
gloves may soften landmarks but must not turn the whole hand into uniformly
inflated tubes or remove the palm's underlying organization.

### Cartoon simplification

[Stan Prokopenko — Cartoon Hands](https://www.proko.com/course-lesson/how-to-draw-cartoon-hands-comic-cartoon-and-mickey-mouse)

Read the public notes, including the three-finger glove example. The construction
still starts with palm, finger gesture and triangular thumb base. Puffy simplified
forms, softened knuckles, reduced digit count and exaggerated shapes can retain
that structure. The three decorative glove points belong on the back. Applied
requirement: retain the owner's padded glove direction while fixing underlying
articulation; do not use cartoon style to justify an impossible ordinary pinch.

### Established rig implementation

Inspected Blender 5.2's installed Rigify sources:

- `/Applications/Blender.app/Contents/Resources/5.2/scripts/addons_core/rigify/metarigs/human.py`: actual palm/finger/thumb rest arrangement, parentage and rolls.
- `/Applications/Blender.app/Contents/Resources/5.2/scripts/addons_core/rigify/rigs/limbs/super_finger.py`: primary bend-axis configuration, master control and optional IK.
- [Official Rigify source](https://github.com/blender/blender-addons/blob/main/rigify/rigs/limbs/super_finger.py).

Rigify is a production rigging reference, not an anatomical authority by itself.
Generated controls and successful skinning do not prove the resulting pose is
anatomically plausible. Pose/axis/landmark evidence remains necessary.

## Review contract

| Aspect | Required ordinary behavior | Permitted stylization |
| --- | --- | --- |
| Digit count | Distinguishable thumb and finger roles | Reduced digit count is possible; final count pending owner preference |
| Finger hinges | Middle/distal joints flex toward the palm | Softer silhouettes and emphasized flexion timing |
| Finger base | Modest spreading at knuckle, on a knuckle arc | Broader spacing for silhouette clarity |
| Thumb | Mobile metacarpal base, then two phalanges; opposition in 3D | Broad pad, stronger gesture and padded proportions |
| Palm | Metacarpal fan, dorsal/palmar distinction and thumb-base volume | Simplified, rounded surface |
| Pinch | Index flexes toward opposing thumb pad | Clear contact gap and anticipation |
| Grab | Fingers close around volume, thumb wraps outside | Exaggerated grip compression |
| Smear | Explicit transient animation layer returning to valid poses | Directional elongation/multiples and elastic follow-through |

No joint-angle range is presented here as a clinical universal. Rig limits are
artist-facing guardrails and must be checked against the intended gestures.

## Next evidence

Show a neutral structure and pinch from dorsal and side views, with joint axes
visible; verify thumb opposition without sideways finger hinges. Only then add
glove polish and review all states/in-betweens. Browser work remains prohibited
until the owner approves design and rigging.

The structural review must make these checks visible:

1. Neutral: wrist, metacarpal fan, staggered MCP knuckles, thumb base and finger
   segments labeled. Joint locations must match the modeled forms.
2. Pinch: index PIP/DIP flexion follows its hinge plane; the thumb's mobile
   metacarpal carries its two phalanges into opposition. Show pad contact from
   dorsal and side views, not just a circular silhouette from one camera.
3. Grab and press: inspect palm cupping, finger overlap, thumb clearance and
   compressed padding. Avoid collapsed knuckles, lateral flaps and intersections.
4. Transitions: inspect intermediate joint motion and preserved volume with
   smears disabled. A clean endpoint cannot conceal a broken transition.
5. Smears: review the deliberate transient distortion separately, including the
   frames before and after it. Exaggeration must recover to the approved anatomy.

Rig and skin remain separate concerns: joint semantics, control axes and pose
definitions belong to the reusable rig; padding, cuff and dorsal decoration belong
to the glove skin. Future skins must be fitted and checked against the same
articulation contract rather than relying on identical mesh proportions.

## Blender structural evidence

`assets/hand/anatomy-study/anatomy-study.blend` contains an actual editable Blender
study based on the installed Rigify human rest structure, plus a 115-frame
rest/pinch/return action. This five-digit comparison does not decide the final
cartoon digit count. `scripts/hand/build_anatomy_study.py` rebuilds it.

Inspected renders in `evidence/anatomy-study/` show the metacarpals and thumb
chain from dorsal and side views. Turquoise crossbars expose the hinge axes;
tip markers expose proposed pad positions and directions. The animation audit
found no PIP/DIP lateral rotation, with a maximum finger joint gap of about
0.00000051 scene units (floating-point tolerance). Contact landmarks are about
0.018 units apart and their normal dot product is about -0.755, so they face
broadly opposite directions, not perfectly head-on.

These checks establish a constrained structural study, not anatomical certification
or final surface contact. Glove padding, actual skin normals, thenar/hypothenar
volumes, all cursor states and smears remain unverified. The owner has not approved
this study or the replacement design. See the asset README for coordinate and
source attribution details.
