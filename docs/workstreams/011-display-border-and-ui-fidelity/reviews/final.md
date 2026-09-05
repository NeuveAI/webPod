# Independent review — display border and UI fidelity

**Verdict: APPROVE.** No unresolved major or critical findings in the completed border and two reference-backed UI changes. The disputed counter removal was not performed: IMG_2280 clearly shows “1 of 947”, and the lead/owner clarification remains separate. This review does not imply blanket UI equivalence or authorize unrelated feature removal.

## Border and geometry

The new8-unit opening margin is2.94% of active width, consistent with the approximate photographic border ratio. Glass and mask expand outward together. The active272×204 geometry,320×240 semantic texture, native coordinates and UV mapping remain unchanged. Independent candidate front/quarter images in both finishes show a visibly wider black surround, straight LCD edges and complete uncropped Now Playing content. No extra mesh, overlay, resource or input mapping path was introduced.

The enlarged top passes coordinate256. Float32 spacing there is2^-15, approximately3.052e-5; half a storage ULP is1.526e-5. The projection test tolerance change from1e-5 to2e-5 therefore accommodates measured1.452e-5 quantization. It does not relax the complete crowned-shell active boundary ray checks or change the aperture-repair algorithm. Those front/quarter checks pass independently, preventing a repeat of the bowed occluding bevel.

The scoped baseline hashes in `../evidence/reviewer-baseline.json` show Device, front-surface, form, aperture algorithm, materials, lighting, renderer, product studio and backplate finish unchanged. Geometry implementation differs only in the display surround constants and their public glass dimensions.

## UI

I inspected IMG_2277 and IMG_2280 directly and read the full UI investigation. Title-only Songs rows and transport status while browsing are supported by the references. The final changes reuse the existing TitleBar and provider-qualified Jotai playback observation. The indicator is absent when idle/no track, follows playing/paused changes, and preserves the title/battery structure. It adds no provider subscription or component-private state.

Only global Songs suppresses artist secondary presentation; row data, album metadata, search provenance and queue semantics remain. The mounted test verifies idle/playing/paused transitions and preserved Albums secondary content. The counter is unchanged, and my integrated capture explicitly checks “1 of 4” after native navigation into Now Playing.

## Independent gates and evidence

- `bun test packages/device`:230pass,0fail; `../evidence/reviewer-device-tests.log`.
- `bun test packages/panel`:123pass,0fail, repeated after fixing a nullable expected value in the new test; `../evidence/reviewer-panel-tests.log`.
- Separate TypeScript checks for device, panel, composite and web: pass. Panel rerun after that test fix.
- Scoped lint across the four geometry/layout files and two panel files: pass.
- Independently authored and ran `../evidence/reviewer-native-capture.ts`: both finishes, native keyboard Albums→tracks→Now Playing→back→Songs, title-only row assertion, playing/paused status and preserved counter. Six screenshots and metadata in `../evidence/reviewer-final`; no browser page errors. The pause transition uses a deterministic provider event. This verifies keyboard/runtime composition, not pointer-coordinate calibration; pointer mapping did not change.

The integrated Songs screenshot reads cleanly within the widened border. Candidate quarter images provide the corresponding oblique geometry evidence. Captures use a local live worktree and deterministic provider at1024×1100,DPR2; they are not a committed-build attestation. No broad unrelated browser suite was run, no implementation edits were made by reviewer, and existing dirty work was preserved.
