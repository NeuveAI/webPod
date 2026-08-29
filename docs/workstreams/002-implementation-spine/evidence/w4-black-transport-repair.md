# W4 black polycarbonate transport evidence

## Source comparison

Pencil was read only through its MCP. The resolved black reference uses a
neutral five-stop near-black body, subtle broad white radial/lateral transport,
a dark gray seam, and independently graded wheel and Select materials. The white
reference remains the control for colourway isolation.

The installed Three 0.185.1 sources were read from
`node_modules/three/src/materials/MeshPhysicalMaterial.js`, the physical shader
chunks, and `examples/jsm/nodes/materials/MeshSSSNodeMaterial.js`. The retained
implementation uses classic WebGL `MeshPhysicalMaterial` because the
HTML-in-canvas path is WebGL-based; only the bounded internal-transport term is
added at shader compilation.

## Native candidates

All captures are 660×1104 device pixels for a 330×552 device at DPR 2, in the
same dark room and front pose:

- `w4-black-transport/black-low.png` — selected; neutral black with restrained
  broad transport and separate surface lobes.
- `w4-black-transport/black-balanced.png` — rejected; broad face begins to lift.
- `w4-black-transport/black-high.png` — rejected; gray cast compresses material
  hierarchy.
- `w4-black-transport/white-control.png` — unchanged colourway control.

## Mechanism checks

- The obsolete brown lower-edge emissive texture and its export are absent.
- The black material is opaque (`transparent=false`, `transmission=0`).
- The custom term is added after Three's physical diffuse/specular terms and is
  bounded by explicit ambient, scale, and edge coefficients.
- The transport direction is normalized from the actual W4 key position.
- Black and white seams are distinct authored materials; mirror-back steel is
  not reused for either.
- No route, panel, layout, token, or Pencil source was changed by this repair.

Full command results are recorded by the workstream gate output for the commit.
