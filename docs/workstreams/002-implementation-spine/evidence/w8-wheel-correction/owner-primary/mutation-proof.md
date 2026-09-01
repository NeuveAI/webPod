# Owner-primary white 5G correction — mutation proof

Each plant was applied with `apply_patch`, the owning test was run, and the
production value was restored before the next plant. The final clean run is
recorded in `verification.txt`.

| Plant | Reintroduced defect | Command | Result |
|---|---|---|---|
| A | White shell `#F6F3EC → #F4F7FA`, restoring the rejected cool/blue faceplate | `bun test packages/device/src/owner-oem-white.test.ts` | **red:** 1 failed, 5 passed; warm-channel relation received `-6` instead of `>= 8` |
| B | White legends `#FAF8F2 → #7B838E`, restoring the medium dark-grey ink | same | **red:** 1 failed, 5 passed; legend luma `130.09`, below the required `> 237.15` |
| C | Select color collapsed into the wheel color `#F6F2E9 → #D5DADD` | same | **red:** 1 failed, 5 passed; warm-channel relation received `-8` instead of `>= 10` |
| D | Wheel-well floor restored to dark/cool `#D9E1E9` at albedo `0.6214` | same | **red:** 1 failed, 5 passed; seam-floor albedo fell below wheel albedo `0.7` |

This file records the colorway pass at that point in history. Its geometry
sentence was superseded by the owner's later binding flush-topology correction;
the current six geometry/material plants are recorded in
[`flush-correction/mutation-proof.md`](./flush-correction/mutation-proof.md).
