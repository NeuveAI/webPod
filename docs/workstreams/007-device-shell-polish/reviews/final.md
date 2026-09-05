# Review: Device shell polish

## Verdict: APPROVE

Reviewed the frozen implementation against scope.md, decisions.md, the user screenshots and both engineer handovers. No unresolved Critical or Major findings. No platform-decision registry was found outside the unassigned workstreams; no other workstream content was used. Repo law supersedes the generic Neuve/kanban workflow. Existing unrelated dirty changes were excluded from attribution.

## Correctness and review coverage

- Rear composition/inlay are removed from the rendered model and dead texture helpers have no remaining callers. The old plane exceeded the inset rear face; removing it eliminates its side-visible text. Live calibration targets now identify the exposed steel mesh directly.
- Analytic rear normals match the superellipse sweep and quarter-ellipse roll: rear cap is -Z, seam normals are lateral, and shared indexed vertices preserve geometry continuity. The installed Three toCreasedNormals implementation mutates the nonindexed extrusion as used. Its 45-degree threshold preserves the square LCD wall while smoothing the plastic bevel before crown deformation. Existing material values and geometry dimensions are preserved.
- Memoization/disposal remains paired for surviving geometries and textures. Removed resources are no longer allocated. Compatibility-only rearInlay fields remain accepted without affecting rendering, as explicitly recorded in the handover.
- Settings starts closed, opens through a labeled button, uses native modal inertness, synchronizes visibility through a Jotai store, handles Escape/Close, restores focus and wraps Tab among current visible controls. Appearance and audio preferences remain live; audio reaches the existing CompositeDevice controller. Stage/composite keyboard handlers cannot receive dialog descendant events. Unmount resets visibility.
- Reviewed quarter, rear-quarter and side geometry screenshots and fresh desktop/mobile settings screenshots. No rear glyph leakage is visible; chrome reflections and both physical finishes remain. Geometry captures are development evidence, not immutable snapshot claims. Aesthetic preference remains the owner's judgment.
- Changes are separable into geometry and settings slices. Route edits coexist with pre-existing user changes and require hunk-level staging. No commits or pushes were made.

## Findings resolved during review

1. Light-room toolbar CSS overrode modal button backgrounds while retaining pale text. Engineer scoped room overrides to direct-child toolbar buttons; fresh light-room screenshot confirms readable controls.
2. A removed rear-inlay source marker silently made an existing aperture test slice extend to the end of the file. Engineer replaced the marker and added ordered-bound assertions, also correcting an existing invalid front marker. Final device tests pass.
3. Added lifecycle documentation for exported modal behavior and its focus boundary handling.

## Independent verification

- Final per-package/app `bunx tsc --noEmit -p` for packages/device, packages/composite and apps/web: PASS.
- Final scoped `bunx --bun eslint` on all eight changed device files, device-settings.tsx, route and three affected browser tests: PASS.
- `bun test packages/device`: 222 PASS, 0 FAIL, 83,099 assertions.
- Focused app/provider/orientation and composite interaction-audio tests: 56 PASS. These cover provider transport ordering, cancellation, orientation lifecycle, audio mute/unmute and teardown.
- `bunx --bun playwright test --config apps/web/tests/playwright.config.ts apps/web/tests/settings-menu.e2e.ts`: 3 PASS (10.1 seconds). Verified activation, closed state, preferences, both dismiss paths, keyboard containment, resumed playback/rotation and mobile bounds on the existing production route.
- Browser source: `1b2fe3993159b220bc4f33dd78495f155aaa4b8b53bcb8d9aaeba3cf10a87626`, 239 files, worktree snapshot. This supersedes the engineer's earlier fingerprint after final code/doc corrections.
- Engineer's adapted pointer-cancellation and Apple-retry browser checks also pass; those two were inspected but not independently rerun.
- `git diff --check`: PASS. No added useState, type escapes, lint suppressions or workstream names in production code.

Browser coverage is Chrome with the repo's CanvasDrawElement flag; this review does not claim Safari/Firefox or real Apple-account authorization coverage.
