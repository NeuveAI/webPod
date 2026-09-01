# W8 wheel correction — mutation proof

Each plant was applied to the corrected source, its owning test was run, and
the source was restored before the next plant. A plant counts only when the
edit itself was visible in the failure output.

| Plant | Reintroduced defect | Command | Result |
|---|---|---|---|
| A | Select opening `+1 → +4`, recreating the broad dark annulus | `bun test packages/device/src/layout.test.ts packages/device/src/front-surface.test.ts` | **red:** 3 failed, 16 passed; received gap 4 / lip radius 41 |
| B | Wheel inset `1 → 4.25`, recreating the shadow moat | `bun test packages/device/src/layout.test.ts packages/device/src/front-surface.test.ts packages/device/src/materials.test.ts` | **red:** 3 failed, 27 passed; received inset 4.25 |
| C | Select recess `0.5 → 0`, making the button flush | `bun test packages/device/src/layout.test.ts packages/device/src/front-surface.test.ts` | **red:** 2 failed, 17 passed; Select face equalled wheel inner face |
| D | White ink `#7B838E → #5E646D`, restoring the rejected dark treatment | `bun test packages/device/src/materials.test.ts` | **red:** 1 failed, 10 passed; received old color |

The production constants were restored after every plant. The final clean run
is recorded separately in `verification.txt`.
