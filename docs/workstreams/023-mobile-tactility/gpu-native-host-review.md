# Independent native main-host review

Final bounded source status: **APPROVE** for the main-host manifest below after independently rerunning the documented corrections. The REQUEST_CHANGES findings below are historical and explicitly closed in the final section. This report covers the main-host side only; worker orchestration/protocol/carry adoption are independently reviewed by Aristotle. Previous query/raster and assembly helper approvals retain their exact hash boundaries. No browser actions or application edits by this reviewer.

## Confirmed Major — identical equipped updates repeat preparation

Frozen `packages/composite/src/native-sticker-controller.ts` update queues a pending scene on `preparing || waiting` even when the resource semantics are unchanged. Pump has no compatible-current check. A callback/pose-only update received while awaiting adoption therefore launches another full preparation/private transfer/compile immediately after the current ACK. Repeated pack pose updates can perpetuate this churn, including an empty placements list.

Actual controller reproduction: `evidence/gpu-worker/renderer-host/reviewer-equipped-dedup.ts/json`. The resource producer is controlled; the query geometry/controller is real. A single identical refresh while waiting yields2 preparations/2 sends instead of1. Author correction is authorized after browser freeze: track exact resource identity, distinguish epoch supersession, and suppress duplicate work before send/adoption while retaining latest actual changes and A→B→A correctness. Independent rerun pending.

## Live transition capacity gate

Parent reports actual native warmup+packet+liner presentation succeeded, but saved-placement/packet replacement failed transaction admission while old packet/carry resources remain live. This reviewer did not run that browser action. Source confirms a slot appearance change changes the full pack resource key and currently reacquires every private geometry/damage/artwork while retaining the previous packet until replacement ACK. The earlier static catalog10+packet8+carry2 proof does not cover this overlap. Required follow-up is an exact replacement-owner workload and compatible immutable resource reuse, without reducing geometry, effects or budget protections. This remains a full native integration blocker irrespective of the duplicate equipped correction.

## Collection motion seam

Frozen collection effect now reads the per-device `motionAuthority.readIntent().orientation`, invokes its existing admission/cancellation logic immediately and subscribes via `subscribeIntent`; returned unsubscribe handles replacement/unmount. Orientation props remain the no-authority fallback. Production passes the same route-owned authority. This avoids a React pose subscription and restores access to current motion rather than frozen rendered props. Existing side effects remain source-equivalent; focused lifecycle/reentrant checks and final seam verdict pending.

## Additional checks under investigation

- Native physical controller registration for WebMCP: only the GL ClickWheelInput effect currently calls bindAgentControlPhysics, while the native adapter creates its own unregistered controller. Confirmed registration inventory shared with author; native physical/agent parity requires the same owner.
- Native keyboard front admission currently updates from renderer response subscription. Review must ensure immediate main pose changes gate keyboard input before a projection reply, matching pointer admission.
- Carry artwork cumulative bytes are incremented after sendFrame transfers the bitmap. Verify/avoid reading dimensions from a transferred object; snapshot byte size before transfer is the safe ownership boundary.

Exact final hashes, corrected proofs/types/lint and complete source verdict will be appended after the bounded author corrections. Full native appearance/input/fallback/6× and explicit manual process gate remain lead-owned and are not approved here.

## Review progress and independent reproductions

The equipped dedup correction now passes the expanded real-controller/controlled-producer proof: identical waiting refresh does not redo preparation, A→B→A retains admitted A after obsolete B rejection, actual epoch supersession prepares the required candidate, and later compatible updates stay quiet. This closes that specific finding; final whole-host approval still waits on the other issues below.

`reviewer-input-intent.ts/json` confirms Enter still produces native physical commands after main binding orientation changes to rear but before projection notification. Pointer-down checks current pose, but keyboard attachment and held move/capture admission lag the renderer subscription. This violates immediate main-authority admission; correction requested.

`reviewer-terminal-pose.ts/json` runs the actual extracted main host handler at a controlled pose/listener boundary. Reliable settlement with final sequence2 leaves host pose/listener at sequence1. Independent worker reviewer confirms final projection is coalesced and may be awaiting credit, while reliable settlement/checkpoint can arrive first. Required correction is freshness-guarded reliable pose/query adoption before public listeners, without requiring a projection ACK.

Native agent physics registration inventory confirms the only bindAgentControlPhysics call is in the GL scene bridge. Native creates a separate unregistered controller, while pressAsAgent resolves its physical owner from that registry. The same native controller must be registered and unregistered through the composite owner; a second controller is not an equivalent fix.

Basic collection proof `reviewer-collection-intent.ts/json` executes the extracted imperative effect with real scoped Jotai notifications and controlled interaction callbacks. Immediate sync, front→rear→front and cleanup pass without React pose renders. The setup currently synchronizes before subscribing, leaving a synchronous reentrant publication window; author was asked to close this and avoid stale pose-key publication before final seam acceptance.

Existing affected checks:52 input/physics/orientation/Composite tests pass with1,134 assertions;59 Composite media/runtime/audio tests pass with345 assertions. Composite typecheck passes at this checkpoint. These checks do not cover the newly reproduced native admission/terminal sequencing failures.

## Frozen correction reruns

Source checkpoint: /tmp/webpod-host-transition-freeze/manifest.json. Independent immediate-input reproduction now reports admittedBeforeProjection:false. The actual adapter checks current front admission at native down/move/up and keyboard event entry; existing physical up/cancel cleanup remains available. WorkerDeviceCanvas registers the same returned controlPhysics in the agent registry and unregisters before disposal. The carry controller captures bitmapBytes before transfer, so cumulative accounting no longer reads detached dimensions.

The adapted collection proof includes the full lexical effect declarations and a reentrant Jotai publication from rear back to front. Initial state, front/rear/front, reentrant drain and unsubscribe all pass. The effect subscribes before initial synchronization and unsubscribes if setup throws. This closes the identified collection seam issue; no broad pose React subscription was introduced.

The adapted terminal proof extracts both actual host handler and actual adoptPose guard. Reliable settlement sequence2 and checkpoint sequence3 update query before listeners. Older sequence/epoch samples produce no listener notification. This closes reliable final-pose delivery at the tested boundary. Its controlled query has no screen node; exact Panel projection relies on the already-reviewed projection helper plus source inspection of current screen matrix/camera/layout inputs, not a newly claimed GPU image comparison.

The initial proof failures above are historical confirmed defects, superseded only by these explicit corrected reruns. Main-host final source verdict remains pending transition-owner/caller review and final frozen checks. CPU016's independent motion-channel defect was handed back to its author for correction and separately reviewed by Aristotle; it is not self-approved in this host report.

## Final bounded main-host source verdict — APPROVE

All30 source hashes match /tmp/webpod-host-transition-freeze/manifest.json. The retained evidence/gpu-worker/renderer-host/reviewer-main-host-manifest.json identifies this review's exact main-side subset; worker/protocol/native carry adoption/frame orchestration remain Aristotle's separate acceptance. Prior exact helper/assembly approvals are retained; this verdict does not self-approve the separately authored motion driver.

Independent transition rerun: reviewer-transition-admission.ts passes with catalogue warmup, existing packet, candidate packet, equipped print and current/candidate carry concurrently. Exact main/private owners are reused under the same renderer owner; candidate adds no geometry/damage/artwork copies in the tested appearance transition. Cross-owner and retired-owner reuse reject without reservation. Final texture/query/transaction/paper/carry ownership reaches zero. The worker assembler pack-reuse.ts also preserves exact resource identity across current→candidate→next, rejects stale/aborted reuse and disposes each resource once at the last release. Controlled PNG alpha/bitmap boundaries are declared in those artifacts; these are not GPU/image comparisons.

Source tracing confirms cache references are acquired before prior owners retire, current query resources survive until exact candidate acceptance, failed candidates release only their own references, and renderer retirement releases transferred private leases. Query and renderer ownership remain distinct, including warmup query retirement. No budget increase or independent producer was introduced. The new resource maps are bounded by the existing pack leaf/resource admission and controller current/candidate ownership, with no cross-renderer cache.

Confirmed equipped dedup, event-time keyboard/capture admission, agent physical registration, pre-transfer byte accounting, reentrant collection subscription and reliable query-before-final-listener issues are closed by corrected source and the focused evidence described above. Same-turn media dispatch remains in the unchanged composite input authority, independent of renderer readiness/ACK.

Final independent gates:111 existing affected input/physics/orientation/Composite/media/audio tests pass,1,479 assertions (/tmp/cpu009-host-final-tests.log); device/composite/web typechecks pass; all30 frozen source files and the focused revised reviewer scripts pass scoped ESLint. Exact source hashes were checked immediately before these gates. No new application code was authored during this host review.

Stageability: the main host is a coordinated graph importing the worker protocol, exact resource assemblers and native controllers. Do not stage these files as a standalone partial host commit. Combine the exact reviewed main manifest with separately approved worker/assembler/protocol manifests and already committed preparation/motion/resource dependencies. Collection's narrowly reviewed optional authority effect and Production prop seam can be staged only against the lead's exact baseline patch; this does not approve unrelated moving Production changes.

Full native clean-entry/packet/peel/carry/drop, real raster fidelity, complete GL fallback/context loss and current-Chrome6× responsiveness remain mandatory lead-owned acceptance. The earlier browser replacement failure is not declared resolved by this source verdict alone; the clean existing-route retry must confirm the corrected ownership under actual transfer/compile/render behavior. No manual process waiver or whole-goal completion follows.
