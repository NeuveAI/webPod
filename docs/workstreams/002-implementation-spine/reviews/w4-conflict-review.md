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

# Re-review — W4 corrections at `9b125af`

**2026-08-29 · independent antagonistic re-review**

## Verdict: APPROVE — 0 Critical, 0 Major, 2 Minor

The three blocking findings from the first review are closed. I reproduced the
source-bound baseline from an empty `git archive` of
`3c5db2aa4bffd070d116a20169213ae57259ecb5`, installed its frozen lockfile, and
served it to a fresh named Chrome session. The resulting report is byte-identical
to the committed identity: SHA-256
`2727153de49cf2061d2da83b95e896d1ccbebc4736bcae6fb9d3e78bd3483d36`, **24/43**,
RMS **8.729602094291078**, worst **22.4129**; body black 2/8, body white 2/8,
wheel black 3/4, wheel white 4/4, Select black 1/4, Select white 1/4, and steel
11/11. The archive contained 483 Git files; its tree, rig digest, lock digest,
browser build and viewport agree with the correction artifact. This directly
closes the prior 18/43 source-contamination failure.

The final two committed reports are also byte-identical to each other (SHA-256
`fffa27707b80f7e48008fb090ed2e0a3aedb66901964454e0705cf8399be9fd2`) and parse
to 24/43, RMS **8.733272850932646**, worst **22.4129**, steel 11/11 and white
wheel 4/4.

### Sheen roughness: the missing physical lever is now falsified

The Three grounding is stated correctly: the required agentic-context clone is
`ae46171bed` and identifies itself as 0.185.0, while the installed package is
0.185.1. In both, `sheenRoughness` participates in the Charlie direct-sheen and
IBL sheen paths; it is not a dead JavaScript-only property.

I parsed the raw `webpod-sheen-roughness-sweep-v1` artifact independently and
checked all five values (`1, 0.9, 0.7, 0.4, 0.1`) across all 43 rows. The
1.0→0.1 response is exactly the claimed one: black-body k0 **−5.7040**, k7
**−5.0636**, and k3/k4/k5 **−7.1292/−7.0229/−5.2401**. Thus lowering the
uniform scalar darkens both already-deficient edges; 1.0 is the physical upper
bound, so there is no untested continuation in the useful direction. The
earlier feasible-missing-lever Major is closed.

I rechecked the remaining `MeshPhysicalMaterial` families against the grounded
shader and the recorded finite-difference work. Iridescence, transmission,
dispersion and anisotropy would introduce a different material identity or
directional/chromatic behavior absent from Pencil; clearcoat normal was already
tested as a second spatial lobe and correctly rejected; the remaining uniform
base, clearcoat, specular, environment and sheen scalars cannot independently
raise both edges while holding the centre. I found no untested physically
permitted uniform mechanism that supplies the required edge/centre separation.

### Crown archive: exhaustive and controlled

The raw `webpod-edge-crown-sweep-v1` artifact has exactly **42** unique
combinations: depths `0.5, 1, 1.5, 2, 2.5, 3` crossed with extents
`18, 21, 24, 27, 30, 33, 36`. Every row contains exactly 43 measurements. I
recomputed the controls from the raw rows rather than trusting the prose:

- all 42 preserve steel 11/11 and wheel-white 4/4;
- black-body k3, k4 and k5 each have one invariant value across the sweep;
- best black k0 is **−13.4831** at 3px/27px;
- best black k7 is **+4.3378** at 3px/24px;
- no candidate satisfies both edges, so there is no hidden joint winner.

The focused geometry suite independently passed zero-profile byte identity,
the 330×552/r26 enclosure, 14px shell thickness, positive-area triangles,
finite unit normals, actual first-hit probe identity, and unchanged screen/wheel
clearances. At HEAD, **81 focused device/calibration tests pass**, package
TypeScript is clean, and scoped ESLint is clean. The crown stays a bounded real
mesh deformation; it does not paint the answer key or couple sibling materials.

## Minor findings

### Minor 1 — the archival schema is descriptive, not executable

Both raw artifacts carry versioned schema names and the present files are
complete, parseable and hash-bound, so this does not invalidate the reviewed
evidence. But there is no parser/test requiring five sheen rows, 42 unique crown
combinations, 43 measurements per row, or the exact constraint grid. A future
producer could emit an incomplete object with the same schema string while the
focused suite remains green. Before this calibration format becomes a standing
gate rather than one reviewed artifact, give it a closed parser and deletion/
duplication plants.

### Minor 2 — previewable WIP, still not H-6-ready

I compared fresh front/back captures from an immutable `9b125af` archive with
Pencil MCP screenshots and resolved properties for saved components `VWaJS` and
`zbTc3`.

The original gray slab complaint is materially improved: the black front now
reads as dark polycarbonate rather than medium gray, the silhouette is recognisably
iPod-like, and the steel back has coherent broad reflections. The remaining
visual discrepancies are conspicuous:

- the white front has a strong cyan lower bloom that Pencil's restrained pearl
  gradients do not have;
- the white wheel edge is too weak, so wheel, Select and body collapse into one
  pale field instead of Pencil's recessed three-level hierarchy;
- the pale outer sidewall is visually dominant in both colourways, while Pencil
  makes the 330×552 shell itself the primary enclosure with a thin seam;
- the rendered back is only a reflective plate, whereas `zbTc3` includes etched
  identity, wordmark, inlay recess and settings composition. That may belong to
  the later composite layer, but it prevents a literal front-and-back H-6 match
  today.

This is good enough to show the owner as an explicit early material/geometry
preview and to validate object direction. It is not good enough to ask for H-6
aesthetic acceptance. H-6 remains owner-only and uncleared.

## Source-conflict ruling recommendation

The corrected evidence now verifies a real source conflict inside the reviewed
physical/Pencil envelope. Ranked owner choices remain:

1. relax the body stop table locally at its edge rows;
2. narrowly relax the ban on spatial optical response, with a physically named
   polymer mechanism and anti-banding visual gate;
3. relax Pencil silhouette/physical geometry last.

The implementation corrections are approved; this approval does not waive the
red ±4 stop gate or grant H-6.

# Final re-review — `ff67c3c` / `dec74ed`

**2026-08-29 · independent antagonistic re-review**

## Verdict: REQUEST_CHANGES — 0 Critical, 1 Major, 0 Minor

The final visual correction is source-faithful and reproducible. The remaining
blocker is the new archival schema claim: its outer envelopes are enforced, but
its 43 measurement rows are not a closed or semantically valid schema.

### What independently passed

I exported/read saved Pencil components `VWaJS` and `zbTc3` only through Pencil
MCP and compared them with all three committed product captures. Pencil confirms
the canonical 330×552/r26 enclosure, 230px wheel, 84px Select, 1–1.5px visual
seam, and the back's 286×296 inlay at `(22,150)` with identity and three footer
lines.

I then created an empty archive of implementation commit `ff67c3c`, installed
its frozen lockfile, served `/_spike/device?capture=1`, set a fresh browser to
exactly 330×552, and recaptured all three states through the real calibration
API. The new files are byte-identical to the committed evidence:

- white front `4aa5458544730bf0bb84e4b0e6ed4fbbfe5d8a76fc996f755156618810c9d1d3`;
- black front `bf11784ed6d8599494dee99d973a92d41d2a6ca4c186c3706f6a140c248f56ef`;
- steel back `e01a5fe2e9698fa2afc7e391dbdd0667c6d110cbb94f966e2b77c135b782a7af`.

The visual questions all pass:

- the saturated cyan lower bloom is gone; the lower fill is cool-neutral;
- the white wheel is visibly recessed and distinct from the pearl body, while
  Select reads as the raised third level;
- the narrower bevel and seam stop the pale sidewall from becoming a second
  front frame;
- the black shell reads as black polycarbonate rather than the former gray slab;
- the steel back retains physical broad reflections and now contains the saved
  etched identity, wordmark, Settings inlay, six rows, selected Assistant row,
  and legal/serial/live copy. The transparent artwork layer does not paint the
  steel reflection.

W4-D28 is appropriately narrow. It records the owner's explicit rejection of
the gray/flat calibration and Pencil-first priority for final W4 appearance,
while preserving the broad spec, ±4 table and historical evidence rather than
silently rewriting them. H-6 remains owner-only as stated.

Interaction and composite contracts did not regress. Focused device,
calibration and composite suites passed **124/124**, including mounted pointer
capture/cancel/lost-capture, back-face annulus removal, screen mesh identity and
transform replay, HTML-in-canvas, context loss/restore, tier publication and
the mounted singleton-store integration. The full repository suite passed
**935/935**. Typecheck is 11/11, repo lint is clean, production client/SSR builds
complete, and `bun run gates` now reports 16 automated passes, zero automated
failures, with only owner/manual U14 and U15 outstanding. The prior naming-lane
failure was concurrent and nondeterministic; it did not reproduce in the
standalone full suite or the aggregate gate run and is not a W4 failure.

### Major — the archive parser accepts fabricated measurement evidence

`results()` checks only array length and the primitive type of selected fields
(`packages/device/calibration/archive-schema.ts:69-86`). It neither applies
`exactKeys()` to each `ProbeResult` nor enforces the canonical 43-row identity,
surface/token distribution, expected sample positions, RGB bounds, delta
arithmetic, or `pass === (abs(delta) <= 4)`. The tests make this blind spot the
happy-path fixture: all 43 entries are invented `body-black` rows
(`archive-schema.test.ts:5-17`), so an archive with no steel, wheel, Select or
white-body evidence is explicitly accepted as complete.

I planted the defect against both committed raw artifacts without changing the
repo: every baseline and candidate result array was replaced by 43 copies of its
first black-body row; that row gained an undeclared `rogue` property and was set
to `delta: 999, pass: true`. Both parsers accepted the artifacts and preserved
the rogue field. The observed result was:

```text
{"sheenRows":5,"crownRows":42,"firstSurface":"body-black","rogue":"accepted","delta":999,"pass":true}
```

That falsifies `w4-pencil-first-final.md`'s claim that these are executable
closed parsers requiring “complete 43-row measurements.” The 5-point sheen
order, 42 unique crown combinations and physical envelope are real gates; the
measurements on which protected steel/wheel and per-stop conclusions depend are
not.

Required correction: define the canonical ordered measurement identity from
the probe contract (surface, token, `at`, expected colour/luma and multiplicity),
reject extra/missing keys and non-finite/out-of-range RGB values, recompute or
cross-check `delta` and `pass`, and test the actual committed archives in
addition to synthetic fixtures. Retain deletion/duplication plants, and add the
exact all-black-row, rogue-key and inconsistent-pass plants above.

Because this is a claimed evidence boundary and the planted fabrication remains
green, the final verdict is **REQUEST_CHANGES**. Per instruction, this review is
left uncommitted.

# Focused closure re-review — `3b0c405`

**2026-08-29 · independent antagonistic re-review**

## Verdict: APPROVE — 0 Critical, 0 Major, 0 Minor

The evidence-boundary Major is closed. Both committed raw archives parse
directly through the production parsers: five sheen rows and 42 crown rows. Each
baseline independently recomputes to **43 measurements, 24 passing, RMS
8.729602094291078, worst 22.4129**.

I reran the previous review's exact fabrication against every baseline and
candidate set in both archives: 43 copies of the first black-body result, an
undeclared `rogue` field, and `delta: 999, pass: true`. Both parsers now reject
it. I also independently planted and observed rejection for all requested
adjacent failures:

- swapped measurement identity/order;
- missing and duplicate sheen coordinates;
- missing and duplicate crown coordinates;
- `NaN`, positive/negative infinity, −1 and 256 RGB channels;
- wrong mirrored sample count and a changed sample that no longer averages to
  `measuredRgb`;
- changed expected luminance;
- aggregate-count corruption by deleting a result;
- aggregate-passing corruption by flipping `pass`;
- aggregate-RMS and aggregate-worst corruption by changing a delta to 999.

The independent plant runner recorded **19/19 rejected**. The committed focused
suite separately passes six tests / 261 expectations and reads the real archive
files rather than synthetic all-black fixtures. The parser now requires exact
result keys, canonical surface/token/position/expected-stop order, exact sample
cardinality, finite bounded channels, sample averages, recomputed luma/delta,
and the canonical ±4 pass result. The complete coordinate sets and physical
envelope remain enforced before the producer can write either artifact.

Scoped TypeScript and ESLint are clean. The full repository suite passes
**939/939** with 46,197 expectations.

The visual implementation from `ff67c3c` is byte-unchanged through `3b0c405`,
and the five committed visual/Pencil captures are byte-unchanged from
`dec74ed`. Their previously verified SHA-256 digests remain exactly the same.
Therefore the prior Pencil comparison and visual approval stand without a new
aesthetic inference: cyan bloom removed, wheel/recess/Select hierarchy restored,
seam restrained, and steel-back composition complete. H-6 remains owner-only.

No blocking or non-blocking finding remains in this focused W4 lane.
