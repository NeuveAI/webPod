# Native worker integration review

Status: APPROVE for the corrected bounded worker lane and final driver ed439fcb (see final disposition below). Earlier REQUEST_CHANGES findings below are retained as review history. Independent CPU009 worker-side source review; no full native activation, visual, latency, or manual-process acceptance. Main-side controller/Canvas review is separate. This reviewer did not author these four sources; the accepted CPU025 modules are dependencies whose caller contracts were inspected, not self-approved again.

## Exact checkpoint

Reviewed `/tmp/webpod-complete-host-checkpoint/manifest.json` against live source hashes, all matching at review time:

| Source (packages/device/src/) | SHA256 |
| --- | --- |
| device-render-worker.ts | 822a71fc704874cd06a75e32f889bd27b739e066c7cd5032a0f146ad1d9badf3 |
| device-render-worker-protocol.ts | 29d52c05e3517200dc08170eea4e520d42017e58e0aab1046500b14769aee439 |
| native-carry-adoption.ts | ab187c46d9d9b381792dbb4336526ff921737fb3ef0fb297ee1d7ba4c48d357f |
| sticker-carry-render-frame.ts | 52e1873ef7df7663977096fb03292a9cbc9c3efe3c84ef35016eac71f2c1b6cb |

Binding context: gpu-worker-scope.md and gpu-renderer-host-plan.md; current host implementation diary. No browser or trace actions, application edits, or commits by this reviewer.

## Major: candidate compilation freezes the displayed device

`device-render-worker.ts:125` suppresses every render whenever `compiled` is false. Detached equipped, pack, warmup and carry compilation clear that global flag around asynchronous work (lines157–158,180,198,212). Motion continues advancing, but an already-valid displayed device cannot submit frames or projection until the unrelated candidate finishes; it then jumps to the current pose. Invisible artwork warmup can cause the same stall. The backend's latest-compilation `isReady()` check also forbids the old graph while a candidate compiles, so removing only the flag is insufficient.

This is avoidable source behavior, not an invented timing measurement. Installed Three0.185.1 `src/renderers/common/Renderer.js:1026–1036` restores temporary render state before its asynchronous per-object compilation; the following loop explicitly yields between objects for animation. The author independently confirmed this finding. Preserve initial displayed-scene readiness and backend liveness separately from candidate completion. Keep candidate roots detached until their exact compile resolves; retain synchronous suppression only during atomic multi-owner adoption. A held-compile experiment must show current renders/projections advancing, candidate absence until completion, and exact failure/retirement cleanup. Correction and independent rerun are pending.

## Ownership and protocol findings

The resource transaction queue is bounded to four outstanding tasks and closes queued incoming ports/images on overflow or retirement. Each started assembler assumes ownership and cleans up its own failure. Renderer disposal aborts active preparation, drains deferred carry replacements, disposes scene resources and the backend; queued work is subsequently skipped. Initial chassis compilation completes before `ready`, and the main host creates sticker controllers only after that message, so initial compilation does not overlap sticker compilation through the current live caller.

Paint admission checks current layout revision and an independent current visibility revision, not the older layout/visibility fields retained inside the raster envelope. It also checks epoch, raster revision and extent; stale images close and acknowledge without upload. Dynamic raster upload preserves sampler identity and retains the old allocation until the first admitted new snapshot. The controlled allocation proof is not an actual GPU-resize proof.

Carry private geometry admission compares the complete accepted producer stamp; damage delivery verifies resource id, kind and artwork id. Source artwork ownership survives rejected gesture frames so later bitmap-free messages retain a valid map. Geometry, texture, material and pending port cleanup is idempotent. Native carry geometry is already in world coordinates and is attached directly to the scene, matching the GL completed-frame path.

Before first carry adoption, the policy retains the displayed source and at most one complete replacement for each pack/equipped owner. Supersession rejects these undisplayed candidates. Valid carry adoption attaches the carry and drains replacements synchronously; matching source handoff clears carry. Previous pack/equipped resources are disposed before their corresponding accepted ACK, allowing the main owner to release the old private leases only after renderer references retire. This correctly requires current-plus-candidate resource overlap; it does not prove the complete dynamic workload fits the shared budget.

Supervisor's latest actual native packet→carry→placement attempt reported a resource-capacity fallback during packet replacement. The prior static catalogue proof covered one full packet plus carry candidates, not two complete packet generations during replacement. This is an unresolved combined-host acceptance blocker. The separate main review also confirmed duplicate equipped preparation; that finding is not reassigned to this worker lane. No source verdict here overrides either issue.

Persistence remains authorized by the existing guarded main transaction/final-fit contract, not by GPU carry ACK. Worker ACK means resource adoption, not physical compositor presentation or permission to save.

## Independent checks

- Device and composite TypeScript checks: pass.
- ESLint on the exact four worker sources: pass.
- `renderer-host/carry-adoption.ts`: nine actual policy/source-owner cases pass.
- `renderer-host/channels.ts`: ten lifecycle cases pass, including 10,000 coalesced offers.
- `renderer-host/query-matrices.ts`: 37,120 comparisons; maximum error2.842170943040401e-14, exact Select child-local frame.
- `raster/resize.ts`: actual wrapper/installed StorageTexture with controlled GPU handles; all six allocation/copy/cleanup assertions pass.
- Existing free-carry, return-path, projected-bounds and HTML-in-canvas suites:18 tests pass,862,699 assertions.

These are offline source, math and lifecycle checks. No new live phone timing, full material/image parity, complete transition-budget success, or failure-matrix browser result is claimed. The supervisor retains the final process ledger and native acceptance gate; missing machine correlations are not a correctness waiver.

## Independent transition admission reproduction

`evidence/gpu-worker/sticker-warmup/reviewer-transition-admission.ts/json` now exercises actual native adapters and actual canonical/private workers with exact PNG alpha; only browser texture decoding and bitmap objects are controlled. The actual texture-cache implementation preserves shared URL/image/alpha identities; acquisition evidence records hashed resource keys, kinds and counts without raw request data. It holds the acknowledged ten-artwork warmup, a current eight-print packet, current and candidate actual carry outputs, a landed equipped surface, then prepares the next eight-print packet with its first slot changed to placed. No previous visible owner is released prematurely.

The candidate fails at print3 after two prints, with26 transaction entries,24 private owners,11,828,136 private bytes and80,773,300 accounted bytes at rejection. The existing prospective execution reservation exceeds admission even though the settled count is below the limit. All final worker/owner/byte counts return to zero. The retained assertion requires transition success and intentionally fails on this checkpoint; scoped proof lint passes. This independently reproduces the supervisor's live failure class without claiming identical browser memory or timing. Author resource-reuse correction and independent rerun are pending; budget inflation is not a proposed fix.

## Additional confirmed native seam: stale unrelated command rewinds motion

The main-side reviewer raised independent-channel preservation. This reviewer reproduced it using the actual accepted motion driver with controlled RAF/clock and delayed main projection receipt: `renderer-host/reviewer-motion-channels.ts/json`. Orientation coasts to5.6899237049°, then a reliable same-epoch wheel-contact command carrying the older main pose resets yaw to0°; the next tick jumps to8.0619646381°. `device-motion-driver.ts:114` replaces the entire current pose from every command before updating only its target channel. This is a Major at the native integration seam; earlier command-admission evidence did not verify that independent autonomous channels preserve their latest state. The original driver author owns the bounded correction, and this reviewer will verify its channel/epoch/new-intent semantics independently. No driver edit by reviewer.

## Resource reuse follow-up (not frozen source acceptance)

The author exposed a same-controller `owner`/`reuseFrom:current.cache` API. The exact transition workload now passes through real adapters/workers and the actual shared texture cache. Its eight-print replacement requires zero new geometry, damage or artwork deliveries; appearance changes while immutable resources remain shared. Managed transaction bytes80,780,836 with22 private owners, paper bytes9,061,272, and carry bytes6,660,240. Final counts are zero. The preceding failing shared-cache result is retained in `reviewer-transition-admission-before.json`; the earlier non-shared mock figure is superseded. Renderer-side reference lifetime, cancellation and frozen source checks remain pending, as does the real browser transition.

## Frozen worker correction re-review

The compile-stall Major is resolved in worker SHA256`1c3dd62d8ac194c226338cb2edd8f5a9976a30ebe7c059f2d8387e5ad9f3eabf`. Initial displayed-scene compilation still gates first readiness. Detached candidate compilation no longer clears that state, and publication checks initialized/live backend ownership. Every candidate still awaits successful exact backend compilation before adoption. The short synchronous carry/source swap remains atomic without an asynchronous rendering gap.

Independent `held-compile.ts` rerun executes the exact extracted worker publish and warmup functions with a controlled unresolved compiler. The current scene produces two renders and two projections while the candidate remains detached. Resolution adopts once; retirement disposes once without ACK; rejection reports one failure and disposes once without ACK/adoption. This proves orchestration, not actual GPU compilation speed.

The extended worker packet assembler is SHA256`846072ae2234a478f0b09123fd083abdd5395fbae428f5f1a3f6fef8670ee0bf`. Existing exact materials are frame-local; immutable geometry, GPU damage textures and artwork textures use explicit shared references. Borrowed units are retained before asynchronous delivery; failed/aborted candidates release only their own references. The actual assembler/MessagePort `pack-reuse.ts` rerun proves original identity, rejected candidate preservation, old→candidate→next ownership and exactly one final geometry/texture/bitmap disposal. Its resource test uses an empty root plus real resource units, so it does not substitute for full rendered packet visual acceptance.

The coordinated main resource/controller hashes at this check are`40eb87735c57d8f51b7ea9314a824f2202d2fcf930c7325dbd7836b3dc0ba7b5` and`66cbefa2cd07f44bdf44b3b0b06b7ce732f400f5bfaa19953b9f1c7b09ed7633`. Their broader caller behavior remains the separate main-side review. The same full transition workload was independently rerun after freeze and passes. A paired `REVIEW_PACKET_REUSE=off` run through the same default API reproduces capacity failure; that counterfactual is recorded as before evidence, not falsely attributed to an archived implementation hash. The reuse run performs22 private acquisitions over21 keys, including two equal-numeric-damage groups under different identity keys; it makes no claim of global content-addressed deduplication. The replacement itself requires no new resource deliveries.

Device/composite types and scoped source/proof lint pass after this correction. No remaining confirmed blocker was found in the four-source worker checkpoint and the reviewed packet resource call seam. The overall native source verdict remains REQUEST_CHANGES until the separately confirmed independent-channel motion regression is corrected and reviewed. Browser and final manual gates remain open even after that source correction.

The first motion correction preserves active channels, but independent extension of `reviewer-motion-channels.ts` still reproduces a completed-channel rewind: a coast settles at26.6666666667°, then an already-queued unrelated contact carrying the old main pose resets it to0°. Reliable main settlement adoption cannot fix a command already sent before that settlement was received. Program-map membership alone does not preserve completed worker ownership. The original author is correcting this remaining Major; no approval is inferred from the now-passing active-channel case.

## Final bounded source verdict

APPROVE the corrected worker lane at the hashes above, and the original author's driver correction SHA256`9ff5e22008f36e26213bcb9a1f6f5ff3b1f3e3be0dc0bf9e0fafd4f5485e029f`. The initial four-source protocol/adoption/carry hashes remain unchanged except the listed worker correction; packet assembler is the explicitly reviewed extension. This is not approval of the entire main host/Canvas/controller change or preferred native activation.

The completed-channel Major is resolved. Same-epoch unrelated updates preserve current orientation/reveal even after a program settles. A bounded map retains only wheel/select node identities, allowing their current matrices to survive unrelated stale snapshots after release completion. Explicit target commands still admit that target's exact matrix, a new orientation epoch remains authoritative, and full terminal/resume barriers keep the declared complete pose. Incoming workspace translation remains admitted while current rotation is preserved. This adds no historical program or pose queue. I traced the actual main authority's epoch increment and the control controller's explicit down/contact commands to verify these merge rules fit current callers.

Independent expanded `reviewer-motion-channels.ts` proves active and completed coast preservation, completed wheel/select rest across a new orientation, and explicit press admission while preserving the held peer. Author's actual three-channel correction and original driver proofs pass independently. Pinned trajectory evidence remains exact:105 original orientation step cases,19 reveal boundaries and80 original control matrices. Existing orientation/control/orientation-motion suites:23 tests pass,1,761 assertions. Device/composite/web types and scoped source/proof lint pass.

The packet transition proof additionally rejects cross-controller reuse before any reservation changes and rejects retired-current reuse; successful full workload still ends with zero owners/bytes. The failure counterfactual and successful reuse result are separately retained. No new shader math, geometry approximation, lower raster quality or larger resource budget is part of these corrections.

No Critical/Major remains in this bounded reviewed lane. The separate main-side review, actual native full packet/carry/resize/failure behavior, phone6× responsiveness evidence, and supervisor's final manual ledger remain open. Offline success cannot close them. No application fixes or commits were authored by this reviewer during this review.

## Driver acceptance hold: valid reduced-motion main publication

The original author identified an additional actual caller after the preceding checks: `ControlPhysicsController.#release` with reduced motion restores the local control and only invalidates, producing a generic pose update. Persistently retaining every known control matrix would ignore that legitimate rest after a later press. Driver acceptance at9ff5e220 is therefore held, not final. The bounded correction distinguishes main-held controls from worker-owned release/completed samples: generic main poses must admit main-held/rest updates without reopening stale unrelated reliable-command overwrites. The supervisor's browser checkpoint waits for this correction and independent actual-controller proof. Worker compile/resource corrections remain accepted independently.

## Final disposition after reduced-motion caller verification

The hold is resolved. Final driver SHA256`ed439fcb08d97d5919bb8d7ebfea89473d9c013b095cacb57c3b80c0672b43e3` is independently APPROVED, superseding9ff5e220. Main-held versus worker-release ownership is explicit and bounded to the two controls. Generic pose publication admits a held control's legitimate local rest, while unrelated reliable commands preserve either peer. Worker release ownership persists after settlement; explicit down/target cancellation and resume update or clear the appropriate ownership. No protocol expansion was needed.

Independent `reviewer-reduced-control.ts/json` uses the actual ControlPhysicsController and driver, native-style generic pose invalidation and remote settlement delivery: a completed worker release followed by reduced-motion press/release restores exact local and renderer matrices. The separate first-simultaneous-press, active/completed coast, completed-control, held-peer, three-channel, target/new-epoch, workspace translation and terminal/reveal proofs all pass again. Latest23 behavior tests/1,761 assertions, device/composite/web typechecks and scoped source/proof lint pass against this final source. No remaining Critical/Major is known in this bounded worker/driver lane. Full native browser, independent main-host and final manual acceptance remain the supervisor's separate gates.

## Native frame callback receiver follow-up

APPROVE the narrow callback correction: worker SHA256`8f6464f67e9732fe7a18d97458ab2bebfc160d3d108cb0508c4f3b6911bc56ef`, native-input SHA256`769d9b2a0cc817afc48f7424b91767f01b3deeb07374f44187e9d7e6cbe0d67e`. RAF/cancel dependencies now invoke `globalThis.requestAnimationFrame`/`globalThis.cancelAnimationFrame` through closures. The actual consumers call these dependencies as object methods; forwarding bare platform functions would instead supply the dependency object as their receiver. The worker's absolute-time conversion remains unchanged.

Independent `native-frame-receiver.ts` rerun extracts the exact source closures and executes them through the actual motion driver and ControlPhysicsController against a strict branded platform boundary. Both old bare callbacks fail the receiver check; corrected worker pause/resume/dispose and main physical release/dispose perform three requests and three cancellations with zero remaining frames. Existing driver and actual-controller reduced-motion proofs pass again, device/composite types pass, and scoped source/proof lint passes.

The supervisor observed an `Illegal invocation` during phone-to-fullscreen resize, but the original browser stack was not available for this review. This proves and corrects the callback receiver defect; it does not establish that it was the sole cause of that observed resize failure. Actual resize/fullscreen retry remains the supervisor's acceptance evidence. No broader source acceptance is withdrawn by this bounded follow-up.
