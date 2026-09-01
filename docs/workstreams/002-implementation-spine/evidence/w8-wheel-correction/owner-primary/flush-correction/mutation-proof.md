# Flush click-wheel correction — mutation proof

Each plant was applied with `apply_patch`, its targeted suite was run, and the
source was restored before the next plant. The final clean run is recorded in
`verification.txt`.

| Plant | Reintroduced defect | Result |
|---|---|---|
| A | wheel base `frontFaceZ - 1`, restoring an axial pocket | **red:** 2 failures; front base and center top plane diverged |
| B | Select patch `surfaceOffset: -0.5`, restoring separate depth | **red:** production structural gate rejected any Select surface offset |
| C | outer seam `0.5 → 2.5`, restoring a broad moat | **red:** 2 failures; literal and `0.1mm` physical cap |
| D | Select patch replaced by a `1.2`-deep `CylinderGeometry` | **red:** production structural gate rejected the cylinder |
| E | white Select `metalness: 0 → 1` | **red:** 3 failures across topology/material/OEM gates |
| F | seam floor `0.05 → 1`, restoring a deep visible trench | **red:** 2 failures; floor depth and `0.02mm` physical cap |

The restored targeted suite passes `29/29`. These plants distinguish topology
from appearance: brightening a ring material could not satisfy the top-plane,
sidewall, source-shape or depth gates.
