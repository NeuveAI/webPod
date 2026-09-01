# W8 physical-geometry mutation proof

Each plant was applied to the working implementation, checked with `rg` to
prove the edit landed, run against the narrow owning suite, then reverted.
These are behavior gates, not assertions that derive both sides from the value
under test.

| Reintroduced defect | Plant | Result |
|---|---|---|
| Oversized forehead | Apple raster `screenTop: 27 → 54` | 2 layout failures: model forehead became 47 instead of 24; LCD-to-wheel gap became 36 instead of 59 |
| Oversized wheel | Apple raster `wheelDiameter: 235 → 265` | 2 layout failures: radius became 116 instead of 103; wheel top became 274 instead of 287 |
| Flat Select button | photo profile `selectRise: 1 → 0` | 2 layout failures: proud height and the explicit photo-profile contract both failed |
| Front-shell corner overshoot | pre-bevel inset changed from `seamWidth + faceBevel` to `seamWidth` | product-shell test failed with the rejected 334.6-unit projected width against the 330-unit enclosure |
| Two independent slab planes | rear-shell seam displaced by +2 units from the shared `productShellDepths()` result | 3 product-shell failures: maximum Z, boundary handoff, and shared seam no longer agreed |
| Rear/front crown gap | front crown depth scaling replaced with a constant 1 | 2 curved-shell failures: the rear handoff moved off its plane by 0.80 / 0.45 units instead of remaining zero |

The production suites also assert: a single shared axial depth contract; every
open rear-shell boundary edge lies on the one material seam; indexed vertices
share finite unit normals; rear sections taper monotonically into the full
seam silhouette; the front bevel never exceeds the steel outline; and the
rear handoff remains planar while crown displacement grows only toward the
front face.
