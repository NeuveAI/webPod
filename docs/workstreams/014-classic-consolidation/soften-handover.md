# Material response refinement

Snapshot committed before edits: `335501b` — Consolidate Classic enclosure, materials and LCD scrollbar. Related device/hardware prerequisites are included; unrelated worktree changes remain separate.

## Final response

- Grain contrast is multiplied by 0.96 around its original midpoint before encoding color, bump and roughness maps. Pattern, UV scale and average finish remain stable (subject to 8-bit quantization).
- Aluminum roughness increases from 0.48/0.46 to 0.56/0.54 for Black/Silver; environment intensity decreases from 0.8 to 0.72. Front and Select still reference the same immutable material parameters and the same three maps.
- The existing flush plastic window removes diffuse white wash (black diffuse albedo), retains colorless dielectric reflection, and increases specular intensity from 0.35 to 1, environment response from 0.16 to 1.1 and alpha blend weight from 0.12 to 0.2. This makes the actual studio-card reflection visible across the screen. No painted highlight or shader patch is added.
- Transmission remains zero: a transmission-pass experiment softened the LCD text, so it was discarded. The final cover keeps the direct LCD image sharp. No screen geometry, thickness, aperture, plane, UI or light-rig changes were made after the snapshot.

## Evidence and audit

`evidence/soften-before-*` records the snapshot. `soften-after-*` shows final Black/Silver front, oblique, side and a tilted reflection view. The existing capture script now includes yaw 18/pitch -20 for the reflection view. Front and oblique images were visually inspected: the screen reflection changes with pose, text stays legible, and the front/Select share the softer finish.

345 device/panel tests pass, typecheck passes all 11 projects, production build and changed-file lint pass. Existing geometry and shared-material contracts remain covered. Logs are saved in evidence/soften-*.txt. Refinements remain uncommitted for visual review against the snapshot.
