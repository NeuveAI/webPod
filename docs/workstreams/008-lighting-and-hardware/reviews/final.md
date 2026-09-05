# Review: Lighting and physical hardware

## Verdict: APPROVE

No unresolved Critical or Major findings in this follow-up. Reviewed against scope.md, decisions.md and both frozen handovers. The latest owner request supersedes earlier fixed lighting/material values. Prior dirty app/panel/shell work was treated as baseline, not attributed to this slice. No competing workstream specifications were read. The lead explicitly confirmed the existing text-selection test failure remains outside this scope.

## Findings and resolutions

- The small dock collar lip extended about 0.076 body units beyond the old envelope. Final code retains its 0.1-unit offset to prevent coplanar flicker and includes top and bottom fixture bounds in completeDeviceEnvelope(form). Generated-part bounds tests pass; orientation pivot remains coherent.
- An apparent dark band above the dock in the oblique image was investigated rather than assumed harmless. Reconstructed-camera raycast identifies device-dock-reveal at local Y=-266.16, inside the shell, with the tongue behind it. It is a view into the recessed near wall, not floating exterior geometry. Additional pitch captures support that interpretation.
- Screenshot measurement initially included annotated ROI images on repeat execution. The measurement now excludes those generated annotations.
- Contribution captures have an important inherited limitation: combined includes the separate front StudioEnvironment, while key-only/fill-only disable it. The handover and metric method explicitly disclose this. Both isolated front captures share the same absent IBL, supporting the lower-left footprint comparison; combined-minus-key is not presented as pure fill.
- A dense sweep caught a remaining fully clipped rear angle after the first candidate. The final lower-radiance, nearer-source revision was recaptured and remeasured. No acceptance was based solely on selected flattering poses.

## Code and behavior assessment

Lighting remains two physical, world-fixed RectAreaLights outside the rotating model. The final key/fill sizes, distances and powers broaden coverage while reducing source radiance. The rear still uses its own explicit procedural room map; front and fixtures use StudioEnvironment. No global tone mapping, renderer exposure or LCD changes were introduced. White plastic albedo restoration is scoped to that surface.

Confirmed the actual roughness bug against installed Three source: roughnessmap_fragment.glsl.js reads texelRoughness.g, while RedFormat maps to gl.RED. Final RGBA data provides near-unity green modulation with opaque alpha and no color-space conversion. The only assigned runtime roughness-map consumer is steel. The regression checks the installed shader channel, texture format, green values and effective roughness. Steel remains metalness 1 with original silver base color; softened roughness and reduced room gain preserve reflected variation.

Hardware reference photographs were inspected from the original iFixit 5G Video [headphone/hold guide](https://www.ifixit.com/Guide/iPod+5th+Generation+(Video)+Headphone+Jack+%26+Hold+Switch+Replacement/604) and [logic-board guide](https://www.ifixit.com/Guide/iPod+5th+Generation+(Video)+Logic+Board+Replacement/615). The pill slider, thin jack collar and wide dock are proportionally consistent; this is not manufacturing CAD certification.

Reviewed actual convex aperture subtraction, interpolation, winding, surface-conforming placement and inset depths. The steel has real missing triangles at each opening; nearby steel stays opaque. Jack floor, insulator walls, dock tongue and thirty contact lands are physical geometry. The new six-material fixture palette is explicitly recorded as local to this family, including its neutral-diagnostic limitation. Geometry and materials have paired memoization/disposal; materials are shared by category, not recreated per contact. No frame loop or extra render pass was added. DeviceHardware does not introduce functional lock behavior or intercept existing transport actions.

## Independent verification

- Final `bunx tsc --noEmit -p` for packages/device, packages/composite and apps/web: PASS.
- Final scoped `bunx --bun eslint` over all 18 changed/new hardware and lighting implementation/test files: PASS.
- `bun test packages/device apps/web/src/device-preview-orientation.test.ts apps/web/src/production-device-view.test.ts`: 248 PASS, 0 FAIL, 141,387 assertions across 34 files. Includes 225 device tests, real aperture raycasts, generated fixture envelope/normal checks, orientation lifecycle and provider transport regressions.
- Independent opened-shell audit: 21,676 triangles; zero nonfinite positions and zero normals outside 1e-5 unit-length tolerance.
- Independent final raw-image sweep calculation: 30 samples; maximum interior all-RGB255 fraction 0%; maximum all-channels-at-least-250 fraction 1.94628099%, matching the handover. Reviewed the former worst angle (-24 pitch, 195 yaw), high rear, front/quarter, contribution captures and oblique hardware details. The documented ROI excludes edge highlights and does not certify every possible orientation or radiometric accuracy.
- All 12 entries in capture-source-sha256.json match the final source files.
- `git diff --check`: PASS.
- Independent `device-orientation.e2e.ts`: **8 PASS, 1 existing failure** (29.2 seconds). Passing cases cover mouse/touch edge capture, coast/flick, exclusion of LCD/wheel/Select from rotation, rear reach, pitch/roll, rounded-corner grabbing, pointer cancellation, Settings appearance changes and Reset view.
- Browser snapshot fingerprint: `7245a2eef8acc3c499ee1c826d7c5a4212b1d7d72b36a1fabcdc2f4f7e5fcc7a`, 243 files, worktree snapshot. Chrome with the repo's CanvasDrawElement flag.

## Existing browser-test limitation

apps/web/tests/device-orientation.e2e.ts:251 (`pose preset controls are absent and native text remains selectable while idle`) fails at line 256: expected `.webpod-device-preview__selection-note` user-select `text`, actual `none`. The route was already dirty before this task and already contained both root user-select:none and selection-note user-select:none in the initial contract inspection. Neither app route nor this browser test was changed by the lighting/hardware slice. The test expectation therefore conflicts with the supplied baseline. It is explicitly left unchanged per lead direction; the full browser suite must not be described as passing.

No commits or pushes. Lighting/roughness and hardware are separately stageable, but shared already-dirty files require hunk-aware staging. Final aesthetic preference belongs to the owner; the evidence supports the scoped functional and visual improvement without claiming exhaustive angle or cross-browser certification.
