# GPU responsiveness: feature-complete supervision

Status: active. User explicitly requested sustained supervised execution through feature completion on2026-09-12. Lead owns this checklist and browser; implementation and independent review stay separate. Latest pushed source767905d, PR6 open against PR5; C1/C2 integration is in progress. Local production validation still serves e940356 until the integration freezes. This document and workstream023 are the tracker; earlier board references are historical. Later checkpoints supersede earlier planning states below.

## Correctness and authority

Primary: user requires responsive phone playback/navigation/device handling/sticker spawning/dismissal, GPU operations where they make sense, workers for heavy CPU work, no reduction in rendering/effect quality. Latest AGENTS.md forbids useState, force-push, npm-family tools, credentials access, direct design.pen access, and Neuve shell/board tracking. Preserve unrelated .gitignore and existing user Night Shift placement. Sources in resources plus installed dependencies are canonical for library/protocol design.

Supporting: gpu-pack-flip-trace-analysis.md proves editor visibility raycasts dominate the provided6×CPU trace; gpu-pack-flip-investigation.md records hidden guard and remaining positivefade stalls. gpu-final-validation-checklist.md final implementation checkpoint describes existing coverage; earlier unresolved rows superseded by its later evidence are not new work. Existing pixel/geometry parity proofs remain authoritative constraints. Current behavior is reference for exact visuals and interactions, not authority to retain main-thread stalls.

## Completion checklist and dependency graph

1. Post-guard attribution: short current-Chrome main CPU profile during edit→flip/dismiss→repeat, with automatic stop/finally cleanup. Record source hash, emulation, exact gestures and limits. Existing user trace remains preserved. No recordings exceeding10seconds or full trace left active.
2. Exact visible contour work: design report from haptics, then bounded implementation dispatch and independent review. Canonical types, reuse/ownership, latest-result and current-pose interaction rules must be explicit before code. No geometry simplification, timing truncation, shader/FX reduction, unbounded cache, memorycap expansion or per-event message flood. Lead validates actual current Chrome after source freeze.
3. Lifecycle: mobile_framing audits exact hide/resume, reducedmotion, realGPUloss/fallback scenarios. Lead runs observed current-Chrome checks once implementation settles; source fixes only for actual failures. Tool/keyboard/human parity and cancellation remain required.
4. Integrated final build: affected package types/lint and focused concurrency/parity proofs, clean production build at current localhost origin, actual phone6× interaction pass including playback/navigation during flips, pack immediate/normalpickup, edit/return/cancel, resize and lifecycle. Preserve user inventory and restore normal devserver/browser settings. No active diagnostics, observers, traces or debug source.
5. Independent final review and PR: coherent commits pushed to existingPR6, evidence refreshed. Resolve critical/major findings; keep release review/merge/deploy status explicit. A manual process gate is not permission to stop implementation while useful authorized work remains.

Dependencies:1+design research→2implementation→2review+runtime→4;3sourceaudit parallel with1/design, live3 after2. Remaining detected bottlenecks loop through attributed source→boundedfix→review→runtime until no scoped feature/regression remains unresolved. Do not call a narrow improvement feature complete.

## Verification criteria

Objective: exact contour/occlusion parity against current calculation including partial occlusion/offscreen/corners, stale/out-of-order/cancel/unmount/resize/loss handling, bounded messages and current/candidate resources. No BVH contour traversal in main React render for worker backend; avoid duplicate query for identical pose/resource. Heavy work must not block renderer/input worker scheduling. Supported browsers use worker/WebGPU; fallback stays fully usable. Run canonical app/package typecheck and scoped eslint for every changed package; document boundary invariants and type casts.

Runtime: same existing current Chrome target and iPhone emulation at6×CPU, short repeatable gestures and clean production build. Attribute remaining long tasks before claiming success. At minimum repeated transitions must show no recurring >50ms main task attributed to the former contour chain and input/playback updates must continue during handling. Report actual frame/EventTiming data without equating main RAF to GPU FPS or promising universal frame rate. Cold initialization and repeated handling are separate scenarios. Screenshot comparison verifies unchanged visible controls, contour fidelity, materials and motion; deterministic parity proves geometry/math.

Human judgment: final perceived quality remains user-reviewable in PR. No new product timing/style tradeoff is authorized. Existing pending release review is recorded separately from feature completeness. No new confirmation is required for scoped reversible fixes, read-only investigation, bounded browser checks, commits or PR updates.

## Artifacts and ownership

Lead: this plan, gpu-pack-flip-investigation.md, evidence/gpu-worker/pack-flip/, final integrated evidence; browser/servers/git only.
Design: gpu-visible-contour-design.md (haptics). Lifecycle: gpu-feature-complete-lifecycle-plan.md (mobile_framing).
Implementation dispatch will name exact files and gpu-visible-contour-implementation.md/evidence/gpu-worker/visible-contour/; reviewer writes gpu-visible-contour-review.md. Low-risk implementation decisions must explain exact invariants in that diary; changes to visible behavior or ambiguous lifetime authority return to lead before edits.

Current ready scope: post-guard profile and readonly design/lifecycle audits. Implementation remains guarded until typed query/ownership and verification boundary are specified. User's existing quality and performance constraints supply acceptance; no new product choice is required at this point.

## Active checkpoint

Post-guard profile completed and explicitly stopped/disabled: evidence/gpu-worker/pack-flip/post-guard-main.cpuprofile,7.424sec, source8d95ff9. Application inclusive sampling: stickerProjectedQuad524.319ms, StickerCollection926.671ms, StickerAppearanceEditor347.992ms, preparedcontour215.411ms. Nested values overlap. Immediate implementation is exact UV sample-index reuse (gpu-projection-sample-cache-scope.md), preserving nine live position reads; full async contour transport is deferred until this redundant work is removed and clean-production attribution repeated.

Lifecycle audit complete: gpu-feature-complete-lifecycle-plan.md. Current Chrome has no safely scoped deterministic genuineGPU-loss trigger; crashing shared GPU process is forbidden. Record live genuine-loss coverage unavailable, preserve exact source/controlled fallback proofs, and do not call synthetic failure genuine loss. Observed hide/resume and reducedmotion remain executable. One preliminary visibility attempt overlapped development reload and lost the observation object; no pass is claimed. No observer remains in the current document. Retry once on frozen source, then final integrated build.

## Supervision checkpoint after A/B

Completed and pushed: e940356 exact UV sample reuse;600a57b exact data-only contourkernel;767905d shared collision reservation/private contourdescriptor. A/B individuallyreviewed, noUIactivation. C1haptics authorsqueryowner/worker; C2projection_review reassignedauthor afterA/Breviews and implementscommoneditorcapture/lifetime. They willcross-review disjointC1/C2source, never selfapprove. Originalmobileengineer couldnot beresumed dueorchestrator slotrestriction; work reassignedexplicitly withartifacts, notdropped.

Cleanproductione940 validationstillshows83–95ms taskcluster whileeditorfades, so contourworker is required. Additionalprofile attributes125ms sampled offsetWidth reads inhostposeadoption; track as next bounded candidate afterqueryworker runtime. No generic rewrite or qualitychange.

Underlyinglifecyclebaseline nowverified: realhidden→visible afterdisablingconnectorforcedfocus (task-ownedMCPsessionclosed), noheld/animatingstate afterresume andexactNightShift placement retained. BrowserRenderingmedia reduce: control/back-front transitionsand reducedentry pass; restoredNoemulation. These need finalqueryintegration regression, notinitialrediscovery. LivegenuineGPUloss remains unavailable safely insharedChrome; noGPUprocesscrash orfakepassedgate.

Productionlaunchfix was operationalonly: useabsolute root.env.local path withbun --cwd; relativepathloadedwrongdirectory. Noauthreset/codechange/credentialoutput. Current3000 servescleanproductione940; normaldevserver mustberestored afterfinalvalidation. RawscopedCDP9348 remains currentChrome; DevToolsMCP9347 is intentionallystoppedforcorrectvisibility, canrestartwhenneeded. Noactiveprofilesorobservers.

## Current integration checkpoint

C1 reports exact worker parity and lifecycle proofs, geometric deduplication across 1000 unchanged notifications, and a real default-model current/candidate/output/build reservation peak of 70,885,700 bytes within the original 128 MiB cap. These are author results pending independent review, not browser acceptance. C2 is implementing stable GL ownership, truthful GL/native pose capture and the shared editor subscription. Cross-review precedes the clean production runtime pass. The panel box measurement hotspot remains a separate follow-up after that pass; no render-quality or timing change is authorized.

Independent C1 review found a reproducible capacity recovery defect: rejecting a compatible candidate under shared-budget pressure retired the displayed current result. Author correction is required before acceptance; genuine session/layout/source barriers must still clear obsolete presentation. A clean integrated build passed before this finding, but it is not the final accepted build. C2 independent review runs alongside the correction. No new browser profile was started.

## Runtime checkpoint at dbe65c2

Reviewed commits56c02ca C1, be77986 C2, dbe65c2 panelcache. All14project types passed at C1/C2; targeted paneltypes/lint and source review passed. Clean C1/C2 transition has no observedlongtasks/LoAF; warm resultage17–36ms, first118.9ms (separateinitial151ms). Main contour/raycast samplechain removed. Postpanel profile alsohasnogetterframes, browserinteger/fractionalrounding/restoration passes withCSSOMprecision-derivedbounds. Reports gpu-visible-contour-runtime.md, gpu-post-panel-attribution.md, gpu-panel-measurement-runtime.md.

Active blocker found byfinalGLhumancheck: actuallargewrappedPW-A01 rotation0→10.407deg reachesdraftbutprintpreparationrejects existing96MiB executioncap. Browser boundeddiagnostic and actualworkerrepro agree, ~85MBresident/31entries/one94KBprivatecontour. Savedplacement remainsunchanged. Centered.25proof wasinsufficient; exactsavedwidth.72048/wrapreproduces. DroppingunusedGLwarmupcontours alone wasfalsified (only1500bytes), no cosmeticfixshipped. Authors are investigatingactualinvisiblewarmup CPUretention vs nativeGPU-onlypath, preserving shaderreadiness/quality/caps. Temporarydiagnostic source restoredbyteexact; currentlocalbuildstillcontainsboundederror markersuntilnextcleanrebuild. Noactiveprofiler/trace/observer. FinalGLrecovery andremaininglifecycle/media gates remain open; do notdeclarefeaturecomplete.

## Active fix and supervision handoff

GL failure confirmed inbrowser and actualworker exactsavedplacement at96MiB transaction bytecap (not128MiBcollisionbudget). Five invisibleGL shaderwarmups retain~28.94MB canonicaldamagefields. Chosen minimalfix underimplementation: explicit program-only StickerPrint mode ONLYfor permanentlyinvisible PrepareStickerAsset; keep actualartwork/materialvariants/frontbackcompile/readiness and existingretainedprogramowners, bypassunused damage/contourpreparation. SameGLSL/programkey and actualwrappedrotation cap/finalzero proofsrequired. Authorprojection_review; independentreviewhaptics. Reviewagent preparingfinitefinalcloseout checklist. No capincrease orvisiblequalitychange.

Current pushedHEADdbe65c2/PR6bodyupdatedwithactiveGLgate. Currentlocalserver session11831 servesdbe65c2+boundeddiagnosticbundle; source diagnostic sticker-latest-preparation.ts restored SHA c6ed30bfd2ecddb737fe99192f68b82298afaf643a880e3c974669a44866fc95. Marks collected+cleared; maximum16permodule preventsunboundedretention. Mustcleanrebuild/reload afterfix. CurrentoriginalChrome remainsGLqueryroute; phone6×; noactiveprofile/trace/observer. RawCDP9348session40820 stillcurrentinstance; MCP9347 intentionallyoff forvisibility. UserNightShiftplacementretainedexactly and noheld/pendingdraft aftercancel. Restoredefault /webpod, ordinarydevserver, mediaNoemulation andowneddiagnosticcleanup atfinal.

## Final live checkpoint at 1b007f6

Program-only GL warmup independently approved and pushed. Clean build and all14types pass. Actual wide wrapped human edit plus tool preview/release now pass on both GL and native worker, preserving exact saved placement. Physical packet pickup/Escape cancellation, physical controls/media time progression, same-DPR3 resize roundtrip and reducedmotion restoration pass. See gpu-feature-complete-final-results.md and final evidence directory.

One final lifecycle defect remains: actual tab hidden→visible without blur leaves orientation isBeingHeldtrue. Author projection_review fixes only orientation interruption and existing tests; reviewer haptics independently reviews. Current placement is unchanged and manual cleanup clears the flag. No active trace, profile or observer. Restore ordinary devserver after current-source retest, then update PR and close goal. No new broad optimization scope.

## Feature-complete acceptance at d9434f5

All finite rows in gpu-final-closeout-checklist.md now pass, including independently reviewed hidden cancellation and actual same-Chrome retest/reentry. GL wide-wrap capacity failure is fixed without raising caps or changing visible quality. See gpu-feature-complete-final-results.md for current evidence and explicit genuine-GPU-loss limitation. Final PR delivery follows; merge/deployment remain separate release actions.
