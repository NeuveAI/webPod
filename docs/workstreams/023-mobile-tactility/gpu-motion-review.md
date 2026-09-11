# Review: WEBPOD-CPU-018 — authored motion and native input authority

## Verdict: APPROVE — bounded source/interface review

All confirmed source findings are corrected and independently verified. The lead explicitly retains the unresolved Neuve manual/process ledger; this source verdict does not clear it or complete the ticket. This is source/interface review of CPU016, not acceptance of the active CPU009 renderer host or the full CPU012 visual/performance gate.

### Correctness Check

- Source of truth: gpu-worker-scope.md dispatch F and its explicit main-coordinated reveal decision; gpu-pose-coordination-plan.md; final frozen manifest in gpu-motion-implementation.md. Baseline f3d738fca7806f86c31cc849c2312ce2d9de54e8. No separate repository/workstream decision files were found at the named standard paths.
- Independent ownership: reviewer did not author the motion source. CPU011 author corrections were performed only during explicit paused-review handoffs and are reviewed independently by another engineer.
- Inspected the main Jotai authority, preview controls, motion driver/runtime, extracted orientation/reveal/control equations, shared clickwheel controller/core, GL input/rigid bridge and narrow page/Canvas subscription integration. Host command/projection/native physics seams were inspected for interface risks; their moving implementation is outside this verdict.
- Original orientation equations differ only in their import path. Retained pinned comparisons prove 105 exact orientation steps, 19 reveal boundaries and 80 exact control matrices, including original transformed rest components and invalid/rollback timestamps. No approximation, matrix decomposition or new trajectory replaces the baseline.
- Independent existing suites: 103 tests, 2,278 assertions, seven files; all passed. Command covers preview source/behavior/release, control physics, wheel unit/integration and CompositeDevice integration. Zero-test invocations are not used as proof.
- Independently reran all six retained motion proofs: parity, control-parity, driver, authority, native-input and provider. Two remote control channels use one renderer frame and zero main control frames; notification receipt does not gate rapid reliable commands. Actual CompositeInputBoundary invokes provider synchronously before any rendering acknowledgment. These are offline checks, not browser activation or timing measurements.
- Device and web typechecks and scoped lint across frozen sources, changed assertions and proof scripts passed. Final corrected authority and capture cleanup passed another independent run of the same 103 tests, both package typechecks and focused lint.
- Git remains unstaged/uncommitted by reviewer; unrelated and host-owned changes are not accepted implicitly. Full current-Chrome entrance, rapid/resumed hit alignment, wheel/Select, media, hide/replacement/failure and 6× CPU comparisons remain mandatory CPU009/012 gates.

### Findings

1. **Major, corrected:** apps/web/src/device-motion-authority.ts publication originally set Jotai and then sent the captured orientation without checking synchronous subscriber replacement. An actual adapter listener superseding yaw10 with yaw20 ended with public yaw20 but sent yaw10 at a newer epoch. The author now checks the exact published intent after notification. Independent `evidence/gpu-worker/motion/reviewer-reentrancy.ts` passes and emits only yaw20; its JSON preserves the prior failing values. Projection/settlement notification guards were also tightened.
2. **Major, corrected:** direct publishIntent previously relied on the preview binder to cancel an old run. The adapter now retires and rejects the old active run itself, with reentrant intent/epoch guards before sending. Independent rerun of authority.ts sends old projection and settlement after direct supersession: zero stale progress, current yaw225 retained, old completion rejected.
3. **Major, corrected:** Select capture moved from a child component whose unmount cleaned capture into a parent controller surviving frontInteractive=false. A layout effect now explicitly disposes both capture owners and clears the cursor at admission loss; keyboard registration also follows admission. Source inspection confirms teardown uses the same idempotent shared controller cleanup exercised by native-input.ts; real browser transition testing remains the integration gate.

### Suggestions (non-blocking)

The active host native physics subscription currently echoes remote progress through invalidate→sendPose. Host author confirmed and will suppress that echo while retaining exact local query updates and immediate input publication. Native reduced-motion initialization/change cleanup is likewise a host integration obligation. These have not been presented as completed CPU016 browser validation.

### Neuve Dogfood Feedback

- Claimed WEBPOD-CPU-018 after reading show/context; ticket sources and exact validation scope match the dispatch.
- Installed CLI range f3d738f→HEAD with include-uncommitted: scan `.neuve-artifact/scan-1789136396-583481000-13476.json`; focused authority sources `.neuve-artifact/sources-1789136397-284865000-13697.json`; focused blame triage `.neuve-artifact/triage-1789136453-370940000-14222.json`.
- Focused triage remained evidence-correlation blocked and showed manual units. It did not detect or prove the actual reentrant defect. No machine-correlation approval or waiver is inferred.
- Required MCP review-shell capability could not be called: current tool inventory contains neither get_review_model nor a tool-search entrypoint. Lead was notified. No raw artifact workaround or invented repo ID was used. This process gate remains explicit. Lead accepted ownership of the remaining shell/manual ledger; reviewer does not clear it or complete the ticket.
- Local bounded feedback `.neuve-artifact/feedback-record-1789136573-287360000-15174.json` records source/check correlation noise and unavailable shell capability. First feedback note exceeded the240-character limit; shortened retry succeeded. No source or credentials entered feedback.

### Final independent evidence

Independent reviewer-reentrancy.ts additionally verifies two authority instances remain isolated and a stale detach cannot detach a replacement binding. Seven retained scripts (six author proofs plus independent reviewer probe) passed. Logs for final checks: /tmp/cpu018-tests-final.log, /tmp/cpu018-device-types-final.log, /tmp/cpu018-web-types-final.log and /tmp/cpu018-final-delta-lint.log; full source lint was /tmp/cpu018-lint.log. No browser, trace, commit or application edit occurred in the motion review. The explicit brief CPU011 author interruptions are outside this verdict and independently approved by CPU019.

### Bounded GL companion staging review

Independently inspected `/tmp/webpod-cpu016-companions.patch`: APPROVE as the CPU018 companion source slice. DeviceCanvas publishes live orientation through the authority getter and only face/admission changes through React; DeviceMotionBridge updates the rigid GL model. Original control rest tuples and channel cancellation match the reviewed driver and80-matrix proof. Canonical TanStack `/webpod` validates only worker/webgl values; this patch does not activate the native renderer. Production→Composite→Canvas forwards the same authority object, without creating another state/input owner. PeelingPrint subscribes locally to authority orientation so its exact carry preparation still follows device rotation without whole-page updates. Existing useSyncExternalStore import and frozen runtime cancellation/adoption semantics remain intact. `git apply --cached --check /tmp/webpod-cpu016-companions.patch` passed without staging. The source checks above cover these live seams; native host changes outside this explicit patch remain excluded. Lead owns applying/staging/committing the patch.
