# Review: W8 — Volumetric owner correction, geometry lane

## Verdict: REQUEST_CHANGES

### Correctness Check

- Source of truth: Loaded `AGENTS.md`, `scope-volumetric-device.md`, W8 dispatch, the complete workstream decision log (including both D-064 entries), `decisions/volumetric-device.md`, the diary, owner-correction evidence/summary/screenshots, the project review prompt, strict-critique skill, workstream-scoping framing, and the team review protocol. Three/R3F behavior was checked against `/Users/vinicius/code/agentic-context/three.js` rather than recall.
- Kanban ticket: Not applicable. `AGENTS.md` and D-002 explicitly state that this repository has no Neuve shell or Kanban board; no ticket was invented.
- Correctness target: Checked coherent bounded topology and normals, neutral/beauty corner proof, world-space product rig, material/environment ownership, front/quarter/edge/rear continuity, physical LCD bounds and layer separation, responsive camera fit, native DPR rasters, and DOM/mesh alignment. The committed crops are visually free of the former lower-corner pinch, the rig geometry matches 45°/40° plus the subordinate low strip, the 375×812 capture is unclipped, and the active LCD remains 272×204 / 4:3 / 320×240.
- Dispatch scope: The five commits stay within the expected device, composite interaction, existing spike/test route, and W8 paperwork surfaces. The geometry/light commit, LCD commit, selection commit, browser-proof commit, and evidence commit are coherent and separately reviewable.
- Dependency/HITL status: Geometry/orientation work was unblocked. Production sensor UX remains deferred. Owner-only visual acceptance and U14 thumb occlusion remain open and are not auto-cleared by this review.
- Neuve HITL gate: Not applicable by repo law (D-002). No human-routed Neuve unit exists.
- DoD checklist: Static/build/browser gates are green, but the physical-continuity and material-ownership targets are not met because of the two Major findings below. Independent strict approval and owner visual acceptance therefore remain open.
- Review lanes: This artifact covers only the assigned geometry / lighting / materials / camera / LCD visual-physical continuity lane. Interaction teardown was inspected only at the seam needed to ensure the screen and camera evidence were not misleading.
- Type/lint/doc gates: `bunx tsc --noEmit -p packages/device/tsconfig.json`, `packages/composite/tsconfig.json`, and `apps/web/tsconfig.json` passed. `bun run lint`, `git diff --check` (one trailing-whitespace documentation hit only), focused device/composite tests (54 passed), and `bun run build` passed. No new `useState`, `any`, lint disable, non-null assertion, or unchecked production cast was found in the range. One exported-helper comment is stale (Minor below).
- Git history/staging: Commits `44dccdd`, `5b37c40`, `52fe26b`, `1107ae8`, and `fe9ecc4` are scoped, ordered, trailer-free, and human-readable. Unrelated dirty and untracked files were preserved; no implementation, index, or history mutation was performed.
- Verification evidence: Visually inspected all neutral/beauty corner crops and the front, three-quarter, edge, rear, mobile, screen-close, and top-control captures. Re-ran the flagged-Chrome volumetric Playwright test to a temporary evidence directory: 1 passed with the same source fingerprint and no page errors. The recorded summary reports exact 320×240, 640×480, and 960×720 rasters and mobile projected extent equal to its safe limit. Independent coordinate probes measured the uncaptured crown/control offset defect below. Installed Three `WebGLRenderer.js:2198-2203,2729-2733` proves the environment-intensity defect below.
- Decision-log status: VD-28 through VD-31 record the owner corrections. D-064's canonical-vs-rotated ruling is respected by this review; no rotated pose is graded against the static stop table. D-064's plant law was also applied: independent probes asserted their changed inputs/coordinates before measuring. No finding contradicts the method used elsewhere in this review, and each conclusion below follows from the cited runtime mechanism rather than merely arriving at the desired verdict.

### Findings

- [MAJOR] The front materials do not retain their authored environment response after the correction; every material that now leaves `envMap` null receives the same scene-level gain of `0.20` (`packages/device/src/StudioEnvironment.tsx:25-28`, `packages/device/src/Device.tsx:551-567`, `/Users/vinicius/code/agentic-context/three.js/src/renderers/WebGLRenderer.js:2198-2203,2729-2733`). Three selects `scene.environment` when `material.envMap === null` and then writes `scene.environmentIntensity` directly into the shader's `envMapIntensity` uniform. Consequently the black body renders at `0.20`, not its authored `0.008`; white renders at `0.20`, not `0.0024`; the wheel, wells, Select, glass, seam, and controls likewise lose their per-surface gains. The test named “front dielectrics keep the room as a whisper” only inspects dead parameter records (`packages/device/src/materials.test.ts:269-290`), while the environment-owner test explicitly blesses the null path without mounting it (`packages/device/src/StudioEnvironment.test.ts:16-22`). This contradicts D-057/VD-20's per-material identity and makes the claimed restrained PMREM/material ownership untrue at runtime. The test must exercise the installed renderer semantics or the implementation must preserve a world-space room while retaining per-surface gain.
- [MAJOR] The new cross-crown displaces only the shell, leaving the LCD and wheel anchored to the old flat `frontFaceZ` plane (`packages/device/src/Device.tsx:295-307,520-537,617-625,740-769,825-841`). With the shipped form, the shell is pushed forward by `11.1477` model units at the LCD centre and by `6.6081–12.3800` units around the wheel perimeter, but `displayWellFrontZ`, `glassFrontZ`, `screenFrontZ`, `wheelWellZ`, and `ringZ` never include either crown offset. The nominal `4.25`-unit wheel recess therefore becomes roughly 11–17 units relative to the adjacent physical face, and the supposedly thin LCD stack sits about 7–12 units behind its local shell before its own inset/thickness is counted. This is not a coherent continuous product shell: the new cap deformation and its sibling front components use different surface frames, precisely the unchanged-sibling-path failure the review brief called out. Existing layout tests assert only 2D nested widths/heights, and the corner tests never assert component-to-local-shell Z relationships, so all 54 focused tests remain green over the defect. Derive the controls/layers from the same crowned surface (or deform a shared assembly) and add literal physical-depth gates at representative points.
- [MINOR] The exported tessellation helper's documentation still says it applies a single quadratic via horizontal strips, although it now applies sixth-order X and Y crowns and tessellates in both axes (`packages/device/src/curved-shell.ts:270-279`). That description is now actively misleading for the most topology-sensitive helper in the slice.
- [INFO] The committed screenshot summary fingerprints a worktree snapshot but records `reviewedCommit` and `reviewedTree` as null (`docs/workstreams/002-implementation-spine/evidence/volumetric-device-owner-correction/summary.json:4-10`). The fingerprint reproduced in the independent browser run, so this did not create a separate blocking finding, but recording the reviewed commit/tree would make provenance substantially easier to audit in a dirty shared checkout.

### Suggestions (non-blocking)

- Add one mounted material test that observes the effective environment uniform under installed Three; source-regex ownership is not enough for renderer behavior.
- Add a geometry contract that samples the local crowned face around the LCD and wheel and asserts the glass inset, panel gap, wheel recess, and Select relief against that local surface rather than the uncrowned chassis plane.

### Neuve Dogfood Feedback

- Commands run: None. Neuve and Kanban are explicitly unavailable/forbidden as workflow assumptions by `AGENTS.md` and D-002.
- Artifact refs: This review plus the existing owner-correction evidence and temporary independent Playwright output.
- Kanban updates: None; there is no board or ticket.
- HITL gate: Owner aesthetic acceptance and U14 remain external manual gates; no Neuve-routed gate exists.
- Signal value: Not applicable.
- Sticking points: The generic strict-critique template assumes Neuve/Kanban, while this repository's standing law explicitly replaces them with `docs/workstreams/` artifacts.
- Format feedback: The repository-local scope, decisions, diary, evidence, and review paths supplied sufficient progressive disclosure without a CLI artifact layer.
- Backlog signals: None for Neuve; the actionable backlog is the two Major implementation findings above.
- Feedback artifact: Not created, because repository law says there is no Neuve shell and the user authorized exactly this review file as the only write.

---

# Re-review: fixes `137b5f0`, `4564973`, and `be5f485`

## Verdict: REQUEST_CHANGES

### Correctness Check

- Source of truth: Re-applied the original W8 scope, owner target, VD-28 through VD-34, both applicable D-064 laws, and installed Three 0.185.1 renderer behavior. No settled visual or architecture decision was relitigated.
- Kanban ticket: Not applicable by `AGENTS.md` and D-002; no Neuve/Kanban state was invented.
- Correctness target: The original runtime PMREM defect is closed. `StudioEnvironment` publishes one world-space PMREM texture, front materials bind it explicitly, authored gains remain `0.008` black / `0.0024` white / `0.16` glass, and only `steel-back` binds the legacy calibrated room. The original flat-depth defect is closed for the default form: shell, LCD stack, visible wheel, Select, and default ray plane resolve through `front-surface.ts`; dense independent wheel sampling found only `0.00000347` model-unit conservative-sample error and no intersection. Neutral and beauty bottom-corner crops remain smooth.
- Dispatch scope: `137b5f0` is the geometry/material repair, `4564973` closes the gesture/error and browser-proof seams, and `be5f485` records immutable evidence. Commit boundaries remain coherent and trailer-free.
- Dependency/HITL status: Owner aesthetic acceptance and U14 remain manual. This re-review does not auto-clear them.
- Neuve HITL gate: Not applicable by repository law.
- DoD checklist: Default-form geometry, materials, responsive bounds, DPR acuity, typecheck, lint, build, and browser proof are green. The public injected-form path still violates the one-depth-frame contract, so independent approval remains blocked.
- Review lanes: Targeted geometry / lighting / materials / camera / LCD continuity re-review. Gesture geometry was inspected because `4564973` claims to move it into the shared physical depth frame.
- Type/lint/doc gates: Device, composite, and web TypeScript checks passed. Sixty-nine focused tests passed (44,286 expectations), repo lint passed, and the production build passed with only the existing chunk warning. The stale sixth-order/X-Y tessellation documentation is corrected at `packages/device/src/curved-shell.ts:268-279`.
- Git history/staging: Fix commits are scoped and trailer-free. Unrelated dirty/untracked files, implementation, index, and history were untouched.
- Verification evidence: Re-ran the flagged-Chrome volumetric suite to a temporary directory: 1 passed, no page errors, 375×812 fit remained `0.818667 ≤ 0.818667`, and DPR rasters remained exactly 320×240 / 640×480 / 960×720. The committed summary correctly identifies reviewed commit `4564973e10a655c4684189492afcdfaae042ca58` and tree `8fc7834ee389e60d1cfe1393c57e2980409de642`; `git rev-parse 4564973^{tree}` independently returned the same tree. Fresh worktree proof appropriately had null immutable refs and was not substituted for the committed evidence.
- Decision-log status: VD-32 and VD-33 accurately explain and close the two original Major mechanisms for shipped defaults. The new finding below is a sibling-path gap in VD-32/VD-34's absolute shared-frame claim. The 6.2-crown plant asserted its substituted values before measurement, satisfying D-064's plant law.

### Findings

- [MAJOR] The visible wheel and gesture annulus still diverge whenever the supported injected `form` differs from `DEFAULT_DEVICE_FORM` (`packages/device/src/Device.tsx:99-104,526-539`, `packages/device/src/click-wheel-input.tsx:32-53,208-212,371`, `packages/device/src/front-surface.ts:153-164`). `Device` publicly accepts `form` and resolves the visible wheel from `resolveFrontAssemblyDepths(form)`, but `ClickWheelInputSurface` has no form/depth input and positions itself from the module-level `DEFAULT_FRONT_ASSEMBLY_DEPTHS`. An independently asserted old-crown plant (`bodyCrown = bodyCrossCrown = 6.2`) moved the correct ray plane to `31.68683` while the mounted/exported plane stayed at `26.59175`, a `5.09508`-unit mismatch behind the visible wheel surface (`31.43683`). The new unit test checks only equality between two default-derived symbols (`packages/device/src/click-wheel-input.test.tsx:43-49`), so it cannot catch this supported-path divergence. D-012 makes form a public injected modelling input, and the owner target says shell/display/wheel/Select/input share one frame; freezing only the interaction sibling to defaults breaks both. Thread the resolved front-assembly depths (or at least `clickWheelInputZ`) through the same canvas/context/props path used by the visible `Device`, then plant a non-default form through the mounted boundary and prove the input plane remains 0.25 ahead of that form's wheel.

### Suggestions (non-blocking)

- Make the dense independent perimeter check part of the test rather than deriving production and proof from the same 256 samples; the current error is harmless, but an independent resolution better protects future form changes.

### Neuve Dogfood Feedback

- Commands run: None; Neuve/Kanban remain unavailable by explicit repository law.
- Artifact refs: Existing immutable owner-correction summary, fresh temporary Playwright output, and this appended re-review.
- Kanban updates: None; no board exists.
- HITL gate: Owner aesthetic acceptance and U14 remain manual.
- Signal value: Not applicable.
- Sticking points: No new workflow friction beyond the previously recorded mismatch between the generic Neuve template and repo law.
- Format feedback: Repository-local workstream artifacts remained sufficient.
- Backlog signals: None for Neuve; the remaining blocker is the injected-form interaction-depth seam.
- Feedback artifact: Not created because this review file is the only authorized write and the repository has no Neuve workflow.

---

# Second re-review: fixes `325e8e4` and `0442b26`

## Verdict: APPROVE

### Correctness Check

- Source of truth: Rechecked the remaining VD-32/VD-35 shared-depth requirement, D-012's injected-form contract, D-064's plant law, and the original owner geometry/interaction target. No settled lighting, material, camera, LCD, or interaction decision was reopened.
- Kanban ticket: Not applicable by `AGENTS.md` and D-002; this repository has no Neuve/Kanban workflow.
- Correctness target: `DeviceCanvasOrientationContext.form` is now exactly `device.form ?? DEFAULT_DEVICE_FORM`, the same value passed through to the visible `Device`. `ClickWheelInputSurface` resolves its mounted position from that context form. The shell, visible wheel, Select stack, and ray plane therefore remain in one form-dependent depth frame.
- Dispatch scope: `325e8e4` contains the context/input implementation and mounted regression proof; `0442b26` updates only immutable evidence and W8 decisions/diary. Both commits are scoped, coherent, and trailer-free.
- Dependency/HITL status: No implementation blocker remains in this lane. Owner aesthetic acceptance and U14 remain manual and are not cleared here.
- Neuve HITL gate: Not applicable by repository law.
- DoD checklist: The sole remaining Major is closed. Default and injected-form geometry, installed-Three PMREM ownership, LCD dimensions, responsive camera fit, DPR acuity, typecheck, lint, tests, build evidence, and browser proof are green. Independent geometry-lane approval is now satisfied.
- Review lanes: Targeted final geometry/interaction-depth re-review, with default browser/mobile/DPR regression verification.
- Type/lint/doc gates: Device, composite, and web TypeScript checks passed. Twenty-eight directly relevant tests passed, including the mounted R3F 6.2-crown plant, PMREM ownership, front-depth, LCD raster, capture teardown, and default input geometry. Repo lint passed. No new type escape, `useState`, lint disable, or documentation regression was found.
- Git history/staging: `325e8e4` and `0442b26` are trailer-free and preserve a clean implementation/evidence split. No implementation, index, history, or unrelated dirty file was modified during review.
- Verification evidence: An independent numeric plant first asserted `bodyCrown = bodyCrossCrown = 6.2`, then measured mounted-contract Z `31.686829725438358`, `resolveFrontAssemblyDepths(plantedForm).clickWheelInputZ` `31.686829725438358`, corresponding ring outer Z `31.436829725438358`, exact forward offset `0.25`, and default drift `5.095078779518875`. The mounted R3F integration test independently passed the same relationship. A fresh flagged-Chrome run to a temporary directory passed with zero page errors; 375×812 remained `extentX 0.818667 ≤ limitX 0.818667`; DPR rasters remained exactly 320×240, 640×480, and 960×720.
- Decision-log status: VD-35 correctly records the formerly missing injected-form interaction contract. The committed summary identifies reviewed commit `325e8e4eb8c070372b79ae7f12c59ae4eadc7244` and tree `2e67be51dc95456029aa2a88fc4ca5f3df8ebaa5`; `git rev-parse 325e8e4^{tree}` independently returned that exact tree. D-064's plant-edit prerequisite was explicitly satisfied before measurement.

### Findings

- [INFO] No Critical, Major, Minor, or Suggestion findings remain in the assigned geometry / lighting / materials / camera / LCD continuity lane.

### Suggestions (non-blocking)

- None.

### Neuve Dogfood Feedback

- Commands run: None; Neuve/Kanban are explicitly unavailable by repository law.
- Artifact refs: Immutable owner-correction summary, temporary fresh browser output, and this second appended re-review.
- Kanban updates: None; no board exists.
- HITL gate: Owner aesthetic acceptance and U14 remain manual.
- Signal value: Not applicable.
- Sticking points: None beyond the previously recorded generic-template/repo-law mismatch.
- Format feedback: Repository-local workstream artifacts remained sufficient.
- Backlog signals: None from this final re-review.
- Feedback artifact: Not created because this review file is the only authorized write and the repository has no Neuve workflow.
