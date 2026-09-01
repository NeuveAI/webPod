# W9a mutation plants

All plants were applied to production source with `apply_patch`, verified to be
present, run against the focused suite, and reverted before final gates.

| Plant | Mechanism falsified | Result |
| --- | --- | --- |
| wheel travel `0.08 → 0.18 mm` | subtle wheel limit and Select-dominance | 2 failures, exit 1 |
| `normal.needsUpdate = true → false` | GPU receives changed physical normals | 1 failure, exit 1 |
| release frame cap `24 → 240` | bounded hostile-scheduler release | 1 failure, exit 1 |
| delete moving `wheelContact(next.contact)` | travelling load follows live captured ray | 1 failure, exit 1 |
| delete pointer `releaseSelect()` | release returns Select instead of sticking | 1 failure, exit 1 |
| delete the live `setReducedMotion(true)` invalidation | restored CPU arrays must reach the demand-rendered GPU frame | expected 3 invalidations, received 2; 1 failure, exit 1 |
| increment rather than reset the healthy-clock stall counter | valid 240/360 Hz releases must not hit the hostile-clock escape | 240 Hz wheel settled at 100 ms instead of at least 120 ms; 1 failure, exit 1 |
| reintroduce a `DeviceCanvas.controlEvidencePose` prop | production source must expose no proof-only pose API | static absence gate failed; 1 failure, exit 1 |
| delete the direct reduced-motion release invalidation | the non-running reduced-motion branch also must render rest | expected 2 invalidations, received 1; 1 failure, exit 1 |

Each corrective plant first asserted that its edit landed, then failed at the
claimed mechanism. All were reverted before final gates. The healthy-clock
plant is deliberately distinct from the frozen-clock gate: one proves ordinary
time-based motion, while the other proves the safety escape.
