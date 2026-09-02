# W9a contact-following rigid wheel tilt evidence

Date: 2026-09-02

## Outcome

The owner-rejected local basin and uniform slab translation are both absent.
The production click wheel now rocks as one rigid plastic disc around its
flush centre pivot. The pointer contact radius becomes the low side; no mesh
vertex, mesh normal, UV, material, silhouette or pairwise distance changes.
Select remains separate and audio source is untouched.

Implementation commits:

- `5a5ba8d1894958073467b8075f9fd4e47fae8981` — center-pivot rigid transform,
  production pointer-angle routing and replacement gates;
- `09156ea8d9530b338502094ed3ac54d204ee5fb6` — final 0.006 mm low-side
  calibration constrained below the physical under-floor clearance.

## Geometry and interaction proof

The focused production tests establish:

- all 3,225 production ring vertices and normals remain bit-identical;
- every pairwise distance in the transformed production mesh is preserved;
- a dense 0°–360° sweep in 2° increments places the pointer radius low, the
  opposite radius high and perpendicular radii at neutral depth, including
  the signed-angle seam;
- immutable inner/outer object-space circles cannot pinch, bulge or crawl;
- device rotation transforms the wheel normal by the same single rigid
  quaternion rather than rewriting normal attributes;
- low-side travel is 0.006 mm and remains below the 0.05-model-unit fixed-floor
  clearance, preventing the overlap exposed by the first rejected capture;
- release is monotonic and frame-rate invariant from 15 through 360 Hz;
- reduced motion, cancel, lost capture, blur, unmount, detach and rebind restore
  the exact rest transform with bounded demand invalidation and no idle loop;
- mounted mouse/touch/pen input routes live angles to physics while semantic
  navigation and feedback remain independently owned.

The static source gate also rejects a wheel height field, mutable wheel
attributes, auxiliary shader/light, proof pose or route query bypass.

## Immutable production-browser proof

Flagged Chrome served exact commit
`09156ea8d9530b338502094ed3ac54d204ee5fb6`, tree
`338bfbb8834fc813786c2bd6757eae989f29026e`, source fingerprint
`24b3697bd7f83b33b11a98a1eda837306ac324c3987fe80f29036003c8959c36`
across 194 files. Health expected/current fingerprints matched.

The existing `/_spike/device` route used the ordinary
`mouse.move → mouse.down → captured hold → mouse.up → 120 ms settle`
lifecycle through `CompositeDevice`. No synthetic control pose, query
parameter or proof API exists. The complete SHA-256 index is
[summary.json](w9a-rigid-wheel-tilt/summary.json).

The matrix contains black and white × front and quarter × rest, held and
released. Each held frame differs from rest; every released frame is
byte-identical to its corresponding rest frame. Direct inspection of all four
held macros shows no diagonal clipping wedge, travelling oval, stamped halo,
silhouette change or crawling circular seam:

- [black front held](w9a-rigid-wheel-tilt/black-front-held.png)
- [black quarter held](w9a-rigid-wheel-tilt/black-three-quarter-held.png)
- [white front held](w9a-rigid-wheel-tilt/white-front-held.png)
- [white quarter held](w9a-rigid-wheel-tilt/white-three-quarter-held.png)

## Verification

- immutable Chrome evidence: 1 pass;
- package/device: 193 pass, 0 fail, 63,157 expectations;
- repo typecheck: 11/11 projects clean;
- repo lint: clean;
- client and SSR build: green;
- repo tests: 1,089 pass, 0 fail, 67,099 expectations;
- gates: 16 automated pass, 0 automated fail;
- U14 and U15 remain the standing manual owner/reviewer inspections.

No audio source changed.
