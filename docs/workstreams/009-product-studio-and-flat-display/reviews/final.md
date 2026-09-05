# Independent review — product studio and flat display

**Verdict: APPROVE.** No unresolved critical or major findings in this workstream. Reviewed the latest scope/research, implementation, investigator diagnosis, final engineer handover and visual evidence. Prior dirty changes are baseline and are not attributed to this initiative. No implementation edits or commits by reviewer.

## Correctness and visual judgement

The LCD was planar; the failure was the shell's inner bevel. The new segment-distance candidate selection includes Three's miter extension, then restores the authored contour vertices consistently through depth. The exterior crown and click-wheel opening remain intact. Independent front/quarter bezel images show a straight top and sides with intentional rounded corners, clear text and no old crowned top intrusion. The final DPR3 front boundary evidence reports zero spread across seven samples in both finishes; its bracketed pixel method and limitations are explicit.

The new complete crowned-shell ray test is independent of the repair's candidate predicate. I initially reproduced a failure at a steep quarter near-side edge: target [135.9,58,26.1701] was occluded at [141.5919,59.9010,30.6797]. This is the legitimate vertical wall in front of a recessed LCD, outside its active width. The final test preserves tight front/all-edge and quarter top/bottom checks, while allowing near-side occlusion only outside the active LCD width. This adjustment is supported by geometry and close images, not a blanket tolerance. An isolated mutation restoring the old predicate fails the border regression. Probe/log artifacts retain the investigation; intentionally failing probes do not use test-discovery filenames.

There are three real world-space RectAreaLights, outside the rotating model group. Their physical positions, sizes and powers are preserved during isolation; the same passive PMREM studio remains installed. Rear steel now uses that shared studio by default, while explicit legacy room/map overrides remain available. PMREM targets, generators and card geometry/materials have ownership and disposal paths. New card tests exercise actual resource disposal. Existing corrected green-channel roughness encoding and physical hardware are preserved.

AgX applies to physical surfaces, while the composite LCD MeshBasicMaterial remains toneMapped=false. I checked installed Three's material-dependent tone-mapping selection and R3F's initialization ownership. Investigator live parity shows the underlying LCD is pixel-identical across NoToneMapping/AgX with glass hidden; the visible physical glass changes channels by at most 6/255. This is consistent with the chosen physical overlay, without changing panel source colors.

Whole-object images support approval: black retains dark polymer identity with controlled highlights; white remains distinguishable from the grey wheel; rear steel retains soft reflective gradients and edge separation instead of a broad white plate. The quarter key/fill/rim passes have distinct effects. At that rotated pose the conspicuous broad front-left band comes mainly from the rim, while fill supports the lower wheel; lamp roles are world-fixed, not permanently attached to device faces. This is an interpretation of product photography, not an assertion of Apple's private setup.

Reviewed final-studio isolated passes and rear -30/180, plus candidate2 front/quarter/rear context and final-display front/quarter close crops. The documented 30-view central ROI saturation proxy reports 0% strict and near white. It excludes rolled edges and is bounded sampling, not proof for every angle or a substitute for the visual judgement above. Top hardware and bottom dock remain readable in these views.

## Independent verification

- `bun test packages/device packages/composite` plus the four production-device-view, playback-diagnostics-view, device-preview-orientation and device-preview-orientation-source app test files: **347 pass, 0 fail**, 47 files. See `../evidence/reviewer-unit.log`.
- `bunx tsc --noEmit -p tsconfig.json` separately in device, composite and web: pass. Device repeated after final test edits.
- Scoped `bunx --bun eslint` across changed renderer, environment, studio, light, aperture, material and route code/tests: pass; final modified tests repeated.
- Production orientation browser suite: **8 pass**, including rotation, pointer cancellation, Settings appearance changes and Reset view. Snapshot fingerprint `59f76805a8955a606ecdb74f897fad5742451ef918e1a29443ed42e40aa12122` (244 files); shared snapshot lock serialized. See `../evidence/reviewer-browser.log`. Subsequent changes were tests/evidence only.

The existing ninth browser test, “pose preset controls are absent and native text remains selectable while idle”, was deliberately excluded. Its native-selection expectation conflicts with the already-existing `user-select:none` behavior and is unrelated to this workstream. This review does **not** claim the entire browser suite passes. Final appearance remains subject to the owner's visual preference.
