# Integration ownership and closeout ledger

Snapshot: 2026-09-07, after `canvas-ray-interaction-1` and bounded `front-carry-error-1`. Preparation only: nothing staged, committed, deleted, rebuilt or run in a browser for this inventory. Paths below are repository-relative. Ownership is by responsibility, not an assertion that one agent authored every pre-existing hunk. Workstream016 contents were not read.

## App-owned and adopted015 boundaries

| File | Exact responsibility / hunk anchors |
| --- | --- |
| `apps/web/src/production-device-view.tsx` | Entire current diff: `adaptStickerGrab` import and authoritative `stickerCommands.grab`; forwarding `sourcePeelFront`/`detachTransport` in pack state. |
| `apps/web/src/sticker-grab.ts`, `.test.ts` | Adopted015 grab contract, authoritative hit admission, candidate release and final-release ownership helpers. Newly owned adapter and its regression retain device `projectCenter`/`isValid`; inherited015 cancellation regressions remain required. No WebMCP registry implementation here. |
| `apps/web/src/sticker-contour-presentation.tsx`, `.test.tsx` | Entire files: open contour spans, invisible idle-anchor exclusion, stable admitted pointer/focus owner through visibility changes. Dynamic HappyDOM test uses existing composite dependency; no dependency was added. |
| `apps/web/src/sticker-editor.tsx` | Entire current diff: contour helpers, focused-corner Jotai atom, stable captured/focused hidden grip, idle tab/pointer exclusion, selection reset. Existing timing retained. |
| `apps/web/src/sticker-lift-phase.ts`, `.test.ts` | Entire files: two physical fields from existing normalized lift clock, continuity at .8/1, independent free curl, reverse transport-before-contact. |
| `apps/web/src/sticker-collections-model.ts`, `.test.ts` | Entire current diff: import phase helper; `stickerPeelMotion` returns physical fields while preserving64px travel and existing curl/offset; boundary and reduced-motion expectations. |
| `packages/state/src/stickers.ts` | Entire current diff: optional physical fields on `StickerInteraction`; initial0 values; finite validation and clamp. This is the actual physical-phase state contract. |
| `apps/web/src/sticker-interaction-lifecycle.test.ts` | **Mixed ownership.** First `describe` contains three foreign generation-reentrancy tests: intermediate cancellation, final reduced supersession, final animated supersession. Adopted015 tests after it cover source carry while rear packet hidden and stopping hidden-packet clock. New phase test `existing clock reverses transport before contact and retargets either physical subphase` is ours. Do not stage whole file as exclusively ours. |
| `apps/web/scripts/sticker-hud.integration.test.ts` | Current diff is015 fixture work: provenance wrapper, real listening-earnedC03 seed, native edge-driver branch, conditional recorder; three new witness/admission/save regressions. Original ordinary contour route/idle suite is retained. |
| `apps/web/scripts/sticker-edge-wrap-driver.ts` | Adopted015 driver; our corner-only flag, six-view matrix mode,19-pose sampled geometry sweep, four-case witness parser/validation, mouse/touch off-rear pickup/cancel/flick/relocation and request/reload assertions. Historical ordinary16-edge mode retained. |
| `apps/web/scripts/sticker-matrix-recorder.ts` | Entire test-only actual GL recorder; drawElements/drawArrays parity, raw buffers, raster/pose/draw correlation, bounded upload cache and disposal. Enabled only by capture env. |
| `apps/web/scripts/sticker-edge-provenance.ts`, `.test.ts` | Lead/inherited015 provenance infrastructure adopted by native lane, **not newly authored solely by this agent**. Must travel with the fixture/driver. Preserve exact external-source allowlist policy; do not extend it to hide task edits. |

### Mixed `sticker-collection.tsx`

015/adopted integration anchors: `sticker-grab` import; `StickerPointer.grab`; `RearCandidate.grab`; `clearRearCandidate`; commands.grab; `poseKey`; lifecycle release/cancel on pose/tier/signout/unmount; `start(...grab)`; source validity checks; actual `grab.projectCenter`; final release `sampleOwnedStickerRelease`; source-grab document arbitration; Escape candidate release; off-rear carry/editor return guard; rear-only packet rendering. The newly implemented physical phase addition is the `updateStickerInteraction({ peel: motion.peel, sourcePeelFront: motion.sourcePeelFront, detachTransport: motion.detachTransport, ... })` publication.

Protected foreign anchors: `mountStickerToolControls`/`StickerUiActions` import; `toolActions` ref; the effect assigning current `rear`, `humanBusy`, `reducedMotion`, `open`, `close`, `navigate`, `lift`, `place` handlers; and registry-mount effect. Preserve these exact behaviors and current callback freshness. Adjacent final return guard is015, not part of the registry block. Never whole-file stage this mixed file without a reviewed combined boundary.

### Mixed `sticker-interaction.ts`

015/adopted anchors: off-rear source carry exception in `setStickerRearVisible`; early return when sourcePlacement exists; animation frame allows active source carry with rear packet hidden. Newly owned phase anchors: phase-helper import; `updateStickerInteraction` physical derivation; `initialLift`; physical publication in return and peel branches.

Protected foreign anchors: `animationGeneration`; increment in `stopStickerAnimation`; captured animation/gesture generations and `isCurrent`; all checks after synchronous publications, before completion, before requeue, and the guard incorporated into the off-rear frame conditional. Some phase/return lines now contain both owners' logic. Retain exact guard order; do not replace a mixed line with a phase-only version. First three lifecycle tests are its corresponding foreign regression coverage.

### Explicit exclusions

`packages/state/src/contract.ts` current diff is foreign actor/audio-feedback semantics, not the physical sticker contract. `apps/web/package.json` adds `@webpod/tools`; both `bun.lock` hunks concern tools dependencies. None belong to our integration change. Do not stage/revert them in015.

All changes in app `sticker-webmcp*`, `webmcp.ts`, native WebMCP tests, `device-page.tsx`, orientation app files, composite/panel interaction files, state feedback/detent/store/silence files and tools package remain with their owners. Native compatibility checks may read/run shared tests without assuming ownership.

The lead's015 domain/center changes (`packages/stickers`, server/state placement tests, sticker-editor-model) and engineer's entire device geometry/collision/canvas files are dependencies, not this agent's staging authority. Device `sticker-contract.ts` exports grab/contour/pack fields; engineer owns that file. No edits to `packages/state/src/contract.ts` were needed for physical lift.

## Proposed commit boundaries, not executed

1. Prefer the foreign owner landing its WebMCP registry/generation/package changes first using reviewed hunks. Rebase the proposed015 index patch onto that exact accepted base. If commit ordering must differ, lead and foreign owner should explicitly agree a shared lifecycle prerequisite commit; never silently absorb their changes.
2. Lead/device owner: domain center acceptance plus unified geometry/source topology/visibility/grab/canvas event correction and their tests. Current front-support correction and full-range review are still open, so this boundary is not ready.
3. App integration: adapter/grab, contour ownership and physical lift files plus only015 hunks of collection/interaction/lifecycle tests, depending on both contracts above. A single coherent integration commit avoids temporarily shipping mismatched physical fields or missing guard behavior.
4. Native test/provenance infrastructure: four script files plus existing fixture delta. It may accompany integration if required by repo CI; keep test-only recorder and real-route driver identifiable.
5. Evidence/docs: selected authoritative provenance, failure/correction records, current proof manifest and acceptance report. Choose an explicit file list after final gates; do not `git add docs/workstreams` or all untracked output.

For eventual staging use exact paths and reviewed index patches/`git add -p` on mixed files, then inspect `git diff --cached --check`, `git diff --cached --stat` and full mixed-file staged diff. These are proposed checks only; no staging or commit authorization is inferred here.

## Diagnostic retention and cleanup inventory

Our app/native capture directories under `evidence/sticker-edge-wrap/early`:

- Initial visual baselines: `cage-1`2.2MB, `cage-1-close`5.2MB, `cage-sweep-1`14MB. Preserve authored-art/closeup and spatial-only limitations.
- Rejected/fixed front-shape chain: `final-matrix-1`46MB (rejected ribbon), `front-residual-1-native`68MB (corrected six views).
- Cold inverse/correlation chain: `cold-inverse-matrix-1`70MB, `cold-inverse-interaction-1`2.2MB (invalid edge-band witness), `cold-inverse-interaction-2`2.2MB (real event-coordinate defect).
- Actual event-coordinate diagnosis: `hidden-route-1`2.7MB, including source-hashed evidence-only preload, pointer paths, canvas/DOM offsets, before/after originals and clean provenance.
- Current capture and partial acceptance: `canvas-ray-matrix-1`70MB; `canvas-ray-interaction-1`5.9MB. The complete desktop side success and front crash must both remain represented.
- Front crash diagnosis: `front-carry-route-1`6.1MB and `front-carry-error-1`6.1MB. Preserve runtime error JSON, exact event trace, after-error original, preload source/hash and matching build provenance. `front-support-failure-1` is engineer-owned reproduction, not ours to delete.
- `wrapped-witness-1` through`5` are engineer-owned proof bundles used by our runs. Keep source capture dependencies and distinction between superseded and corrected manifests. They are small relative to raw capture JSON.
- The eight advisory/geometry/integration diaries include failed fan/WASM/collision proposals; retain compact source-backed failure rationale. Geometry/ammo/LOD probes and copied fixtures belong to engineer/lead lanes, even if an advisory originated here.

No deletion is currently appropriate: task acceptance is incomplete. Failed evidence is useful causal evidence, not cleanup noise. After acceptance, redundant byte-identical raw buffers may be losslessly archived/deduplicated **only** with retained raw SHA256, an explicit retrieval manifest and no broken proof references; do not delete the only exact source/draw correlation. Generated build output is reproducible and not a commit candidate; do not clean `apps/web/dist` while other owners may depend on it. Fixture temp SQLite/profile/service directories already dispose in `finally`; all owned browser/build sessions have exited. No broad `/tmp` deletion: unrelated agents may own similarly named probes. Evidence preloads are inert files, not installed browser hooks.

## Remaining execution and acceptance gates

After engineer/reviewer source freeze, choose new absolute evidence directories; never overwrite the failed run. Existing actual route only:

```sh
bun apps/web/scripts/sticker-edge-provenance.ts <matrix-dir>/build-provenance.json > <matrix-dir>/build.log 2>&1
WEBPOD_STICKER_EDGE_WRAP=1 WEBPOD_STICKER_MATRIX_CAPTURE=1 WEBPOD_STICKER_EDGE_WRAP_EVIDENCE_DIR=<matrix-dir> WEBPOD_STICKER_EDGE_BUILD_PROVENANCE=<matrix-dir>/build-provenance.json bun test apps/web/scripts/sticker-hud.integration.test.ts > <matrix-dir>/native.log 2>&1
```

Engineer must rederive/review all four exact8+24 trajectories and **full preview meshes at every admitted center**, not only grabbedUV inversion, and rebind actual six-view source buffers/pose/raster/provenance. Current pickup/hidden/partial/release locations stay fixed unless a separately diagnosed evidence error requires review. Then:

```sh
WEBPOD_STICKER_EDGE_WRAP=1 WEBPOD_STICKER_EDGE_INTERACTION=1 WEBPOD_STICKER_EDGE_WITNESSES=<rebound-manifest.json> WEBPOD_STICKER_EDGE_WRAP_EVIDENCE_DIR=<interaction-dir> WEBPOD_STICKER_EDGE_BUILD_PROVENANCE=<matrix-dir>/build-provenance.json bun test apps/web/scripts/sticker-hud.integration.test.ts > <interaction-dir>/native.log 2>&1
```

Do not set MATRIX_CAPTURE for this run. All four mouse/touch side/front cases must finish: held partial contact, cancel/no-save, exact hidden-edge flick, uninterrupted relocation, exactlyonePUT, unchanged other sticker, reload equality. Existing negative points also backface; they do not isolate BVH from material culling. Reviewer must independently inspect attached/partial originals and actual sequence video; static state assertions cannot certify physical contact or visual continuity. Grip rotation across visibility while pointer-captured remains a native gate beyond HappyDOM retention.

Actual frame/performance gate is still unimplemented for the wrapped path: current pointer-trace timestamps measure driver completion, not input-to-present or dropped frames, and per-draw matrix queries are explicitly unsuitable. Do not invent a passing performance command. Use the same existing fixture/route with a reviewed test-only frame observer/trace before final source freeze, or an evidence-only preload bound to its own hash; record paint/frame intervals and draw idle/memory across actual repeated gestures, with recorder off and no concurrent geometry audit. The ordinary existing fixture's3-second idle-draw assertion is available via `WEBPOD_STICKER_HUD_EVIDENCE_DIR=<ordinary-dir> bun test apps/web/scripts/sticker-hud.integration.test.ts`; it does not exercise wrapped interaction because the edge branch returns early. Broader ordinary-mode verification is a separate serial compatibility run, not wrapped performance proof.

Scoped app types/lint and app grab/contour/phase/collections/lifecycle/return tests plus foreign WebMCP/state-feedback regressions remain required after actual source changes. Current previous passes are inherited evidence only until the final source/build set is fixed. No new public proof route, auth bypass, product diagnostic hook or hidden test state is proposed.

## Subsequent observer preparation

After the snapshot above, root authorized a bounded observer: `apps/web/scripts/sticker-frame-observer.ts` and `.test.ts` are now app/native-owned015 files, with narrow imports/install/read/finally/gate additions in the existing fixture/driver. The same EDGE_INTERACTION command now emits `wrapped-frame-observation.json`; no new route or extra env mode. Passive actualdown→release rAF windows include initial/tail delays, bounded raw samples, sampled stage/distance, longtask interval overlap and capability label. Fixed host-qualified250ms-single/2×100ms criteria and insufficient/overflow checks are implemented but have **not yet been run natively**. The remaining performance gap is evidence/acceptance, not absent instrumentation. Precise script-function attribution and photon latency are not claimed by this observer.5unit tests/35assertions plus217fixture assertions pass; reviewer approval is pending. Add these two files to the native infrastructure commit boundary; package/lock exclusions stay unchanged.

Latest app-owned additions: `StickerLandingOutline` in contour presentation and its regressions; optional `targetContour` command/production forwarding; actual pointerAtom subscription for held-only outline gating. These are narrow additions beside the existing mixed collection/adapter changes and do not modify WebMCP action registry or generation guards. Test-owned frame observer now records execution and supplied frame timestamps separately. Native driver/schema adds front invalid-release/reentry and proof-bound target visibility, with helper regressions in the existing native fixture. Retain both affine-target and affine-hit failed native evidence plus build/capture/proof chains: they substantiate the borrowed-hit transform fix, carried-material visual finding, target projection world-dirty correction, and observer clock correction. None is currently disposable as a redundant accepted run.

New app-owned `sticker-carry-anchor.ts` is a transient Jotai sidecar; owned integration hunks add adapter anchor copying, actual pickup capture, lifecycle mounting, production pack forwarding, and explicit reset/cancel cleanup. Corresponding regressions are in existing grab/lifecycle files. The foreign generation guards and registry hunks remain intact; anchor cleanup is additive and does not change persisted StickerPlacement or server schemas.

## Approved current corrections: selective commit feasibility (2026-09-07)

**A coherent app-only commit is feasible; the full measured device/native bundle is not separable as a whole-file staging operation.** Prepared `evidence/sticker-edge-wrap/early/app-corrections-index-patch/app-corrections.patch` against HEAD `2f1001a0b72b1829a581123e4cc4691f0c60319e`. `git apply --check --cached` passes without mutating the index. No file was staged or committed and no product source changed for this preparation. Reviewer will independently apply it to an isolated HEAD-backed tree; validation of the combined working checkout does not substitute for that isolated check.

Intended exact subject: `Keep sticker editing responsive and hide controls during moves`.

| Included path | Exact selected responsibility; exclusions |
| --- | --- |
| `apps/web/src/sticker-editor.tsx` | Add interaction-stage wrapper hiding the appearance subtree for peeling/placing/settling; derived current-or-last presentation subscription; exact draft/projector/projectionVersion contour memo; necessary imports/type split. Exclude every `StickerContourPaths`/`StickerContourGrips`, focused-anchor ownership and wrapped visibility hunk. HEAD's existing contour rendering remains in this selective patch. |
| `apps/web/src/sticker-editor-model.ts` | Only selectAtom import, raw projected placement atom rename and exact element-identity selector. Exclude adjustment-limit wording and reset-at-edge changes, which belong to the broader wrap/domain work. |
| `apps/web/src/sticker-editor-model.test.ts` | Only appended metadata-notification/exact placement identity regression. Exclude changed edge/reset expectations. |
| `apps/web/src/sticker-editor-carry.test.tsx` | New actual DOM test for idle rotation/wear, no controls in all three move phases, current query counts, readiness invalidation, exit snapshot and source switching. It imports only already-existing HEAD updateStickerInteraction/projectionVersion contracts, not new carry anchor or physical-phase fields. |

The rejected target outline was introduced and removed entirely within the uncommitted worktree, so its removal is **not a deletion relative to HEAD**. The durable correction in this app-only patch is explicit movement suppression of the existing appearance HUD. Do not stage collection or production adapter merely to manufacture an outline-removal diff.

Excluded dependency groups:

- Device measured performance changes in `sticker-visibility.ts`, `sticker-collision.ts`, `sticker-contour.ts` and their `StickerPackScene.tsx` integration rely on the earlier uncommitted actual-shell visibility/contour infrastructure. The same mixed scene file also contains capture/grab, sourcePull/anchor and unresolved partial/free geometry. Whole-file staging would bring that work along. A separate device backport would require a new owner-reviewed patch and isolated verification; this preparation does not claim it is ready.
- App native performance helper/observer are individually test-only, but their current fixture branch requires untracked edge provenance infrastructure and shares setup/imports with the large untracked edge driver/recorder. Whole-file staging of the fixture would include broad earlier wrap validation. They remain with the broader integration/native bundle. Native2 metrics are evidence for the **combined frozen source**, not performance measurements of this isolated four-file patch.
- No collection/interactions/state physical fields, carry sidecar, shared contracts, package scripts, lockfile, registry or foreign WebMCP generation hunks are included. No existing foreign staged/unstaged work should be reset or absorbed.

After independent patch review the lead may stage this exact reviewed patch with an index-only operation, inspect its cached diff and commit only the four-file boundary. The broad unresolved wrap/device/native implementation remains visibly uncommitted; completing this small correction commit must not be presented as completing the original physical-wrap task. Cleanup of diagnostic histories remains deferred until their supporting evidence can be archived without broken references. This ledger and patch preparation performed no cleanup, tests, build or browser run.
