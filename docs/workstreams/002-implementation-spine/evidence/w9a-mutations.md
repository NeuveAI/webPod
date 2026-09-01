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

The plant counts are intentionally small. Each gate fails at the claimed
mechanism, while the unrelated geometry and lifecycle cases continue to pass.
