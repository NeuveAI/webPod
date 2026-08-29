# W4 source-conflict review

**2026-08-29 · independent antagonistic review · range `a61e99c^..afd3c5c`**

## Verdict: REQUEST_CHANGES — 0 Critical, 3 Major, 1 Minor

I cannot verify a source conflict. The implementation has materially improved: the
front shell is now genuinely strip-tessellated, its cap normals are analytic rather
than inherited from Earcut facets, the bevel/core invariant is enforced, first-hit
sampling solves the rendered mesh, body-only calibration has an explicit ownership
boundary, and the clearcoat-normal experiment was correctly reverted. Those changes
close the geometry defect from the previous W4 review.

The conflict proof fails at its first required control, however. An immutable archive
of `afd3c5c`, installed with its frozen lockfile and served in a fresh browser session,
reproduced **18/43**, not 24/43. Steel reproduced **7/11**, not 11/11, and white wheel
reproduced **3/4**, not 4/4. A second report against the live working tree produced
22/43, steel 11/11 and white wheel 3/4. The checked-out `rig.json`, the committed
`afd3c5c` rig, and `/tmp/w4-preserved-candidate.json` have three different SHA-256
digests. There is therefore no single source-identified baseline on which the claimed
finite-difference limits or 3–36px sweep can rest.

### Review setup and source truth

Read: AGENTS.md; strict-critique and review protocol; team-orchestration;
interface-craft; interface-design-guardrails; modern-web-guidance; global-patterns;
agent-browser; cdp-session; W4 dispatch, decisions, diary, HITL register, luminance,
geometry and prior-review artifacts. There is no Neuve board by repo law.

`design.pen` was accessed only through Pencil MCP. Saved component `VWaJS` is a
330×552 reusable frame with circular 26px corners, a dark 280×212 display well, a
272×204 panel, a 230px pale wheel and an 84px Select button. Its visible identity is
pearl-white polycarbonate with restrained cool edge shading—not a broad metallic rim.

The required agentic-context Three clone is at `ae46171bed`, version **0.185.0**, not
0.185.1. I therefore grounded shader/material semantics in that clone and checked the
installed 0.185.1 package for the reviewed API surface. The version mismatch must not
be represented as an exact 0.185.1 clone citation.

## Findings

### Major 1 — the claimed fresh-session baseline is not reproducible

From an immutable `git archive afd3c5c`, with a fresh frozen install and a new browser
session, `tune.ts report` returned:

| surface | pass |
| --- | ---: |
| body black | 1/8 |
| body white | 2/8 |
| wheel black | 2/4 |
| wheel white | 3/4 |
| Select black | 1/4 |
| Select white | 2/4 |
| steel | 7/11 |
| **total** | **18/43** |

The black per-stop deltas were `−32.48, −9.66, +3.91, +9.28, +14.06, +7.45,
−6.05, −26.31`. This is not measurement noise around the reported candidate. The
live-tree run also disagreed, at 22/43. Because the proof does not bind its baseline
to one commit/tree, rig digest, browser build, viewport and report digest, “24/43,
steel 11/11, wheel-white 4/4” is not an independently checkable premise.

The stage-ownership unit tests pass and correctly reject room, camera, lights, steel,
sibling materials and form keys from a body-black patch. That proves path filtering;
it does not prove the browser started from the same frozen scene. The current evidence
demonstrates exactly the leakage risk it was meant to eliminate: different sessions
start from materially different candidates.

**Required correction:** produce the conflict evidence from an immutable reviewed
archive, record commit/tree, exact rig digest, source fingerprint, browser version and
report digest, and make the runner fail if any differ. Reproduce 24/43, steel 11/11 and
wheel-white 4/4 twice from independent fresh sessions before using that baseline for
any sensitivity or geometry conclusion.

### Major 2 — an allowed uniform physical lever remains untested

The claim that no permitted `MeshPhysicalMaterial` mechanism can create additional
edge/centre separation is incomplete. Three exposes **`sheenRoughness`** independently
from `sheen` and `sheenColor`; the Charlie sheen BRDF depends on view/light angle and
its roughness (`MeshPhysicalMaterial.js:241-258`,
`lights_physical_pars_fragment.glsl.js:347-364,505-512`). It is a scalar, spatially
uniform material control. Testing it does not paint a gradient, author a stop-local
map, alter Pencil geometry, or violate the spatial-optics ban.

The tuner varies `sheen` but never `sheenRoughness`. Its scalar sensitivity run also
reveals that base `roughness` and `reflectivity` produced exactly zero pixel change in
both directions at the reviewed baseline, while `envMapIntensity`, `specularIntensity`
and `sheen` did move pixels. That is evidence of an ineffective or bypassed control
path, not a finite-difference proof over the intended BRDF. The reverted independent
clearcoat-normal lobe narrows one hypothesis only; it does not exhaust uniform sheen
roughness (nor validate the no-effect scalar paths).

**Required correction:** wire and sweep `sheenRoughness` over its physical range while
holding the exact §12.3 sheen strength/color, and first prove every claimed scalar
control reaches the live material with a planted response test. If sheen roughness is
rejected, preserve the full per-stop response and the physical/aesthetic reason—not
only the optimizer result.

### Major 3 — the 3–36px edge-crown conclusion is not admissible yet

The new geometry itself passes strong focused gates: strip spacing is bounded,
analytic cap normals are continuous, front and back are bent together, shell thickness
is preserved, invalid `thickness <= 2*bevel` is rejected, and the ray probe solves the
actual tessellated surface. These are meaningful corrections.

But the requested sweep result—best edge errors around 13.5 without centre or sibling
coupling—has no immutable raw artifact in the reviewed range. It is downstream of the
non-reproducible baseline and cannot establish that 3px through 18–36px preserves the
same steel/wheel controls. Nor is there committed visual evidence for every boundary
showing the Pencil 26px silhouette, thickness, manifold/intersection status and all
non-body rows invariant. A bounded geometry test is not a rendered feasibility sweep.

**Required correction:** rerun the complete sweep from the source-identified baseline;
record each crown value, all eight body rows, frozen steel/wheel rows, silhouette bounds,
thickness/manifold/intersection checks, and front/back captures. A residual near 13.5
becomes conflict evidence only after those controls remain invariant.

### Minor — current visuals are previewable as WIP, not H-6-ready

The black front now reads recognisably as an iPod and is much better than the original
gray slab. The steel back is smooth and plausibly reflective. The white front, however,
loses the Pencil hierarchy: body and wheel are nearly the same value, the wheel boundary
is weak, and the bright broad perimeter reads more like a separate metallic frame than
the saved pearl shell's restrained edge. The back also lacks the designed back-face
detail, though that may be outside this slice's visual acceptance.

It is suitable to show the owner as an explicit **work-in-progress comparison**, but
not as a candidate asking for H-6 aesthetic sign-off. H-6 remains owner-only.

## Planted and focused checks

- 32 focused device tests passed: crown tessellation/continuity/thickness, stage
  ownership, first-visible-hit identity and actual-surface solving, luminance tolerance,
  material contract and optical-map channels.
- Fresh immutable `afd3c5c` report contradicted the headline baseline (18/43).
- Live-tree report independently contradicted it differently (22/43).
- Body-black scalar sensitivity showed live response for env intensity, clearcoat
  roughness, specular intensity and sheen, but **zero** response for base roughness and
  reflectivity at the tested perturbations.
- Pencil MCP inspection and screenshots were compared against fresh white/black front
  and steel-back browser captures.

## Ruling recommendation

No source-conflict ruling should be made yet because a feasible missing lever exists
and the proof baseline is not reproducible. After the corrections above, if the exact
same immutable experiment remains red, rank the owner choices as:

1. **Relax the stop table locally at the body edges** while preserving Pencil geometry
   and the ban on spatially authored shading. The table is a 2D output target and is the
   least destructive constraint if physically uniform materials cannot realize it.
2. **Relax the spatial optical ban narrowly** only for a physically motivated molded-
   polymer microstructure, with smooth low-frequency bounds and explicit anti-banding
   review. This preserves silhouette but risks returning to painted-answer-key shading.
3. **Relax the Pencil/physical envelope last.** The 330×552, 26px silhouette and current
   coherent shell are foundational object identity; changing them to chase eight pixel
   samples would be the highest-cost and least defensible option.

Until the immutable baseline and `sheenRoughness` experiment are complete, the verdict
is **REQUEST_CHANGES**, not VERIFIED SOURCE CONFLICT.
