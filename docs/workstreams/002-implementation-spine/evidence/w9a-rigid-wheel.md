# W9a rigid click-wheel correction evidence

> Historical owner-rejected result. Uniform negative-Z translation was
> superseded by the contact-following rigid-disc tilt in
> `w9a-rigid-wheel-tilt.md`. This file remains only as provenance.

Date: 2026-09-02

## Outcome

The click wheel is now one rigid visual assembly. Pressing translates the
assembly 0.03 mm along device-local negative Z. It does not deform wheel
geometry, alter normals, move X/Y, change either circular radius, or move a
contact-following optical cue. Select remains a separate control.

Implementation commit:
`ee920aa6fb62ec8eeba97540ba7f3a43c4bcce2d` (`fix(device): make click
wheel travel as a rigid control`).

## Geometry and interaction proof

`packages/device/src/control-physics.test.ts` is a production-tessellation
gate, not a toy patch. Its **11 tests / 22,333 expectations** prove:

- the wheel calibration is 0.03 mm, less than half the rejected 0.08 mm;
- ring and gap-floor position/normal arrays remain exact during press;
- the sole live matrix is identity plus device-local negative-Z translation;
- every production vertex receives that shared transform;
- inner and outer radii and silhouette are unchanged;
- a rotated parent sends travel along the device's local depth axis;
- release is monotonic and restores exact rest;
- switching reduced motion during release invalidates the restored frame;
- detach/rebind restores only the matching assembly;
- Select remains separate and more than ten times deeper;
- releases are time-invariant from 15 through 360 Hz;
- the frozen-clock escape is bounded and idle requests remain zero.

The mounted R3F input test drives pointer down, captured outside move and
release. Navigation receives the moved angle while control physics receives
one press and one release. Mouse, touch, pen, cancel, lost capture, blur and
keyboard Select remain covered. Composite runtime and interaction-audio tests
were rerun without changing audio source.

Four fresh `git archive` scratch-tree mutations were self-checked:

| Plant | Focused result |
| --- | ---: |
| Restore wheel travel from 0.03 to 0.08 mm | 2 failures |
| Add bounded depth to assembly local X | 2 failures |
| Rotate the assembly during depth travel | 2 failures |
| Re-trigger physical press on captured pointer move | 2 failures |

Each plant asserted its edit landed before the suite ran. Scratch trees were
separate from the working tree.

## Immutable production-browser proof

The browser served exact commit
`ee920aa6fb62ec8eeba97540ba7f3a43c4bcce2d`, tree
`ef93e2bb35cd393b25c4b44a59c0fbe3243cd59d`, source fingerprint
`89c1bc66f7b55b3b997d791f1d2b5211e678411fb98407c94104337c99281762`
across 194 files. Health expected/current fingerprints matched.

The route is the existing `/_spike/device`. Flagged Chrome used the ordinary
`mouse.move → mouse.down → captured hold → mouse.up → 120 ms release settle`
lifecycle through `CompositeDevice`; the driver observed
`data-wp-wheel-gesture=active`. There is no query-controlled control pose,
synthetic physics state or proof API.

The complete capture and SHA-256 index is
[summary.json](w9a-rigid-wheel/summary.json). All black/white × front/quarter
states are present:

- [black front held](w9a-rigid-wheel/black-front-held.png)
- [black quarter held](w9a-rigid-wheel/black-three-quarter-held.png)
- [white front held](w9a-rigid-wheel/white-front-held.png)
- [white quarter held](w9a-rigid-wheel/white-three-quarter-held.png)

Each held frame differs from rest. Every released frame is byte-identical to
its corresponding rest frame. Visual inspection shows no travelling oval,
pinched edge, altered silhouette or crawling inner/outer seam.

## Final verification

- focused physics: **11 pass, 0 fail, 22,333 expectations**;
- package/device: **184 pass, 0 fail, 84,361 expectations**;
- composite click-wheel/SFX integration rerun: green;
- `bun run typecheck`: **11/11 projects clean**;
- `bun run lint`: clean;
- `bun test`: **1,089 pass, 0 fail, 88,583 expectations**;
- `bun run build`: client and SSR green, 234/393 modules transformed;
- immutable Chrome evidence: **1 pass**;
- `bun run gates`: **16 automated pass, 0 automated fail**; U14 and U15 remain
  the standing manual owner/reviewer inspections.

No audio source was changed.
