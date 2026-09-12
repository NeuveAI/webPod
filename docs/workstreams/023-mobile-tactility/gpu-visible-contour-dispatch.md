# Exact contour query worker dispatch

Parent: gpu-feature-complete-plan.md. Primary implementation contract: gpu-visible-contour-design.md, **Production follow-up** section supersedes earlier strict-zero-age/resident-builder assumptions. Source e940356 (UV cache must remain). User authorizes continued supervised implementation through feature completion. Workstream tracker only; no Neuve shell/board.

Correctness: editor full contour sweeps execute in a dedicated query worker, common GL/native. Same Float64 projection/visibility kernel and currently adopted prepared resources. Exact coherent admitted-pose results publish monotonically within compatible editor lineage; current pointer/tool authority never derives from historical results. Human fade/tool-preview DOM stays inert. No quality, shader, geometry, fade-duration, cap or rendering-worker work changes. No silent synchronous full-sweep fallback. End-to-end result age is measured against current synchronous production behavior, not an invented zero-age requirement.

## Phase A: pure kernel/protocol (haptics)

Ready. Own sticker-contour.ts, sticker-transform-projection.ts reusable sample helper only (retain e940cache), new sticker-contour-query-data.ts, focused kernel proof and gpu-visible-contour-kernel-implementation.md. Extract exact prepared projection using plain immutable data/matrices/rectangle and visibility predicate; existing synccaller delegates same function. Query protocol canonical types per design, no hand-maintained duplicate contour/collider types. Publish signatures early to lead/otherengineer. No worker/UI activation. Required exact path/anchor/null/order parity against existingfunction on real preparedfixtures and hostileclip/occlusion/geometry cases; preserve UVcache proof. Run device/webtypes and scopedlint; frozenhashhandoff. Evidence/gpu-worker/visible-contour/kernel/.

## Phase B: resource/budget preparation (mobile_framing)

Ready in parallel with A; no shared writefiles. Own sticker-contour-preparation-data.ts, sticker-prepared-damage.ts, sticker-collision-preparation.ts and new sticker-collision-budget.ts, focused ownershipproof, gpu-visible-contour-resources-implementation.md. Keep exact existing contourdescriptor separately from native surface/damage resource list. Select only valid adopted contour metadata; support existing private transaction delivery. Extract shared original128MiB collisionbudget with resident-query reservations plus existingactive/queuedbuilds; do not add another budget or change existing queue fairness. Reservationbeforeallocation, exactrollback/cancellation/failure release, no capincrease. Export budget/descriptor signatures early. Preserve existing preparation semantics/cacheidentity. Run affected types/lint and current regressionproofs plus budgetoverlap/cancellation/producersdeclaringdescriptor correctness. Evidence/gpu-worker/visible-contour/resources/.

## Phase C: query owner/worker and shared UI integration

Guarded until A/B APIs freeze and review. Scope fourdesigndata/worker/owner/budgetmodules and sticker-projection.ts/sticker-contract.ts, production-device-view.tsx/sticker-editor.tsx. Exact writeowner split will be set after A/B. At mostone active, onelatestpending, oneresultcredit, current+candidate resources; initialyield/chunkedprivatecollidercopy once/revision, directprivatecontourdelivery with existingbrokerlease. Hardbarriers selection/source/layout/assembly/visibility/owner; compatible motion/preview results monotonic; exactfinalpendingdrain. Measuredresource/latencyevidence beforeactivation accepted. No app fullcontoursweep.

## Review and gates

Independent projection_review reviews A/B frozenpaths (author separation), then C once frozen. Reviewer reruns objectiveproofs and affectedtypechecks; no critical/major finding leftopen. Lead owns actualcurrentChrome browser, probes and servers. No agentbrowseractions. Sharedproductioncurrentlyserves e940 on3000 while sourceengineers work; do not restart/navigate/buildinparallel with leadprofiling.

Implementation agents consume scope/design and local installedThree/transaction/collisiontypes beforecode. No useState, forcepush, npm-family commands, cert/env credentialreads, directdesign.pen, globalappdiagnosticAPI, orunrelated.gitignore edits. Low-risk API decisions record exactinvariant/consumer contract; material scopegrowth returns to lead. Public/non-obvious lifecycle APIs get focusedTSDoc. No commits byagents; lead stages coherent reviewed slices.

Completion evidence afterC: actualmoduleworker tests, copy/detachment/accounting/timeout/lateack/ownerretirement, rapidpose+resourcechanges boundedqueues, human/tool editor andGL/nativebehavior, current-authority capture andfinalrelease, unchanged visualcontour/fade, cleanproductionphone6× noformerfullsweep main tasks and compatible sampleage. Lead then finishes lifecycle/media/fallback checklist. This is not complete when worker code merely compiles.

## C1/C2 ownership lock

A600a57b andB767905d independentlyapproved/committed. C1author haptics owns newqueryowner/worker and minimal query-data protocolrefinement. C2author projection_review owns integration (reassigned after completedA/Breviews); haptics must independently review C2 and projection_review must independently review C1. Neither approves its own source. Initialmobileagent couldnot beresumed dueorchestrator live-slot limit; no taskscope lost.

C1API: createStickerContourQuery({onError?})→request(demand),clear(),subscribe,getSnapshot,dispose. Demand carries lineage/coherentpose/visibility/projection/content+camera matrices, collider snapshot+revision and actualprint identity/revision/validateddescriptor+contour+27quad samples. Snapshot retains stampedresult/error/pending. C2 must not clear in per-pose effectcleanup. Hardbarriers own generation/visibility/layout/assembly/session/source. StructuralAPI agreed; source types remain authoritative.

C2additionalfiles authorized for concrete wiring: apps/web/src/sticker-editor-model.ts explicitquerysessions; optional appJotaibridge; packages/device/src/StickerPackScene.tsx stableGLprojectionowner; packages/composite/src/device-render-host.ts and native-sticker-controller.ts admittednativepose reader. No visibility file change needed(existingborrowedsnapshotAPI). Hostdimensionperformanceoptimization is separate follow-up, not part of this wiring.

GLpose decision: use an explicitdiscriminated query-capture stamp rooted in actual capturedmatrices/layout/assembly/adoptedprint changes; do not fabricate nativeworker motionepochs/frameIDs. Nativearm reusesadmitted RenderPose stamps. Kernelneedsmatrices; stampmetadata must truthfully identifyquerycoherence. C1/C2 coordinate minimalprotocoltype revision and testnative+GL paths. This is an engineering adapter, not a productfidelity change.

## Review assignment update

The independent review agent resumed successfully. It now owns C1 review of the settled query owner/worker/protocol while C2 finishes integration; this replaces projection_review's C1 cross-review assignment. Haptics remains the independent C2 reviewer. Source authors do not approve their own changes. C1 frozen hashes and exact commands are passed directly by its author. This avoids interrupting the active integration for a redundant review context switch.
