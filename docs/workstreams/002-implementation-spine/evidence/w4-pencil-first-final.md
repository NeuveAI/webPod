# W4 Pencil-first final visual evidence

## Source identity

- Implementation: `ff67c3c` (`fix(device): restore Pencil material hierarchy`)
- Tree: `41a49a519046e04401306ca161ec5d0c91b1f398`
- Route: `/_spike/device?capture=1`
- Native product viewport: 330×552
- Saved Pencil sources, read and exported only through Pencil MCP:
  - VWaJS — 330×552, circular radius 26; display well 280×212 at (25,50),
    panel 272×204 at (29,54), wheel 230×230 at (50,291), Select 84×84 at
    (123,364), thin cool seam.
  - zbTc3 — 330×552, circular radius 26; etched mark and webPod wordmark,
    286×296 settings inlay at (22,150), and three legal/serial lines.

Pencil's exported reference PNGs are 498×720 because their visual bounds include
the authored outer shadows. The component frames and all product captures are
330×552.

## Reviewed-Minor closure

| Finding | Cause | Source-bound correction | Evidence |
|---|---|---|---|
| Cyan lower bloom | Saturated `#8FB4D8` fill inherited from a superseded stop fit | Neutral cool `#D7DEE7` fill, still a real lower-left room light | white and black front captures |
| Weak white wheel hierarchy | Wheel response sat too close to the pearl shell and the recess was shallow | Darker pale wheel, roughness 0.56, lower environment response, 2.25px recess; Select remains raised | white front capture |
| Dominant sidewall | 5.875px front bevel and 2px seam widened the border beyond VWaJS | 3.5px bevel and Pencil's 1.5px cool seam | both front captures |
| Incomplete back | Bare steel shell omitted zbTc3's product composition | Transparent printed/etched composition over unchanged anisotropic steel | steel-back capture |

## Captures and digests

All three product images were recaptured from the committed implementation in a
fresh named `agent-browser` session at a 330×552 viewport.

| View | File | SHA-256 |
|---|---|---|
| White front | `w4-pencil-white-front-330x552.png` | `4aa5458544730bf0bb84e4b0e6ed4fbbfe5d8a76fc996f755156618810c9d1d3` |
| Black front | `w4-pencil-black-front-330x552.png` | `bf11784ed6d8599494dee99d973a92d41d2a6ca4c186c3706f6a140c248f56ef` |
| Steel back | `w4-pencil-steel-back-330x552.png` | `e01a5fe2e9698fa2afc7e391dbdd0667c6d110cbb94f966e2b77c135b782a7af` |
| Pencil VWaJS export | `VWaJS.png` | `1326930d83303a841c53fe1781853169bc1eaae039c59bd8c2bdb91a58d7238d` |
| Pencil zbTc3 export | `zbTc3.png` | `6479044d0caffe65f7f5fcc4be4109ea4544b5d4e418730c47011491668a1409` |

## Implementation and evidence posture

Three.js assumptions were grounded in
`/Users/vinicius/code/agentic-context/three.js`, then checked against installed
Three 0.185.1: MeshPhysicalMaterial retains the physically lit shell and steel;
the back artwork is a CanvasTexture marked sRGB and rendered as a transparent,
tone-map-independent printed layer. It supplies markings, not fake reflection.

The archival sheen and crown JSON descriptions are now executable closed
parsers. The measurement boundary now derives one ordered 43-coordinate
identity from the canonical stop definitions and admits no extra row fields.
It validates surface/token/position/expected-stop identity, exact mirrored
sample cardinality, finite 0–255 RGB and luma domains, sample averaging,
`delta = measured − expected`, and the canonical ±4 pass result. Tests parse
both committed archives, recompute count/pass/RMS/worst aggregates, require the
exact five-point sheen sweep and all 42 unique crown coordinates, and reject
the reviewer's duplicated-black-row + rogue-key + `delta: 999, pass: true`
fabrication alongside adjacent coordinate, arithmetic, range, deletion and
duplication mutations. Producers validate through the same parsers before
writing evidence.

The pass used `global-patterns`, `modern-web-guidance`, `interface-craft`, and
`interface-design-guardrails`. Visual review emphasized physical hierarchy,
crafted edge treatment, faithful source geometry, and a coherent front/back
product composition. The historical ±4 data remains intact as conflict evidence;
W4-D28 records only the owner's narrow final-appearance supersession.
