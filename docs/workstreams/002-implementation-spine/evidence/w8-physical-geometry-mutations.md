# W8 physical-geometry mutation proof

Each plant was applied to the working implementation, checked with `rg` to
prove the edit landed, run against the narrow owning suite, then reverted.
These are behavior gates, not assertions that derive both sides from the value
under test.

| Reintroduced defect | Plant | Result |
|---|---|---|
| Oversized forehead | Apple raster `screenTop: 27 → 54` | 2 layout failures: model forehead became 47 instead of 24; LCD-to-wheel gap became 36 instead of 59 |
| Oversized wheel | Apple raster `wheelDiameter: 235 → 265` | 2 layout failures: radius became 116 instead of 103; wheel top became 274 instead of 287 |
| Flush Select button | photo profile `selectRecess: 0.3 → 0` | 3 failures: the face was no longer below the ring and both explicit 0.3mm profile assertions failed |
| Front-shell corner overshoot | pre-bevel inset changed from `seamWidth + faceBevel` to `seamWidth` | product-shell test failed with the rejected 334.6-unit projected width against the 330-unit enclosure |
| Two independent slab planes | rear-shell seam displaced by +2 units from the shared `productShellDepths()` result | 3 product-shell failures: maximum Z, boundary handoff, and shared seam no longer agreed |
| Rear/front crown gap | front crown depth scaling replaced with a constant 1 | 2 curved-shell failures: the rear handoff moved off its plane by 0.80 / 0.45 units instead of remaining zero |
| Rear terminal wedge | quarter-ellipse plan inset replaced with a linear axial inset | 2 failures: the midpoint left the ellipse and adjacent-normal turn rose to 1.383 radians against the 0.23-radian ceiling |
| Collapsed play/pause spacing | `interSymbolGap: 3.5 → 0` | 1 decal-layout failure: the explicit visible gap contract failed |
| Undersized skip controls | skip bounds `20 × 13 → 13 × 13` | 1 decal-layout failure: measured x and width no longer matched the physical-image box |

The production suites also assert: a single shared axial depth contract; every
open rear-shell boundary edge lies on the one material seam; indexed vertices
share finite unit normals; rear sections taper monotonically into the full
seam silhouette; the front bevel never exceeds the steel outline; and the
rear handoff remains planar while crown displacement grows only toward the
front face. Select-specific gates also assert a 4-unit annular gap, a face
strictly below the ring, and no domed/proud geometry or calibration parameter.
