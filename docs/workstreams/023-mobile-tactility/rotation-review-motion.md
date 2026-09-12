# Independent motion/readiness review

Reviewer: geometry engineer, independent of motion author. Reviewed CompositeSceneBridge resync removal, screen-mesh transform notification, projectionDiagnostics forwarding/search opt-in, DeviceCanvas whole-scene Suspense and device-reveal readiness lifecycle. Prior haptics/scheduling changes in shared diffs were kept distinct.

The screen signal now compares mesh world, camera world/projection and CSS viewport dimensions. It publishes synchronously in onBeforeRender before drawing the screen; unchanged rendered poses do not repeat DOM geometry work. Initial attachment and canvas ResizeObserver still synchronize immediately. Removing the independent React layout resync therefore removes duplicate work for the same rendered pose without introducing another RAF. Ordinary rotation keeps screen inside its fixed envelope; no change to camera/trajectory or shared Jotai orientation authority.

Independently reran real-source composite-counts.ts:60 changed poses produce60 syncs/240 layout reads; repeated identical frame skips, camera FOV/pose, viewport and immediate resize checks pass, DPR changes raster without changing CSS hit transform. This is deterministic operation evidence, not a browser timing claim. Projection diagnostics have only inspection consumers and are explicit opt-in, with existing E2E URLs updated rather than assertions removed.

Whole-scene Suspense includes warmup and keeps the DOM canvas mounted. Entry's safety timer distinguishes preparing from failed/missing canvas; it does not start a partial-device entry or skip the curve after slow valid geometry preparation. Independently reran entry-readiness.ts: pending after safety timeout waits, real-ready starts the original per-frame curve/final pose, missing/failed/late-failed canvas completes fallback and disposal leaves no RAF. Geometry worker timeout/fallback is bounded separately.

Review raised that compileAsync could otherwise leave this new readiness wait indefinite. Author added a10s compile-owner deadline starting only after complete scene commit; failure suppresses late resolution and marks wpRenderWarm=failed, while success/error/unmount cancel the timer. Source inspection confirms no geometry-pending timer can report readiness. Independently reran warmup-lifecycle.ts: deadline reports failure, late resolution is ignored, unmount cancels deadline/publication, success retains three warm frames, rejection reports failure and no scheduling remains. Scoped warmup lint passes.

Independent device/composite/web typechecks pass. Scoped motion/source lint passes.14 existing screen/composite tests pass160 assertions. The geometry-move source assertions and known unrelated StudioEnvironment failure are not motion regressions. No new browser trace is claimed.

Final verdict: APPROVE motion and readiness after the bounded compile lifecycle addition. No remaining source correctness blocker in this lane.
