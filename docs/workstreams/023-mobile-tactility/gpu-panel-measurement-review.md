# Review: native panel dimension cache

## Verdict: APPROVE

### Correctness Check

- Source of truth: AGENTS.md, gpu-panel-measurement-scope.md, implementation diary, frozen host/helper, existing projectNativePanel and query.applyPose/publishMatrices path. Scope authorizes only the host and private measurement helper.
- Tracker: workstream documents only; no Neuve board/shell under current repo law.
- Correctness target: preserve actual integer offset dimensions and exact projection math while removing dimension getters from pose adoption. Cache invalidation must not replay query/carry/public notifications.
- Scope/dependencies: reviewed on completed contour integration; no contour, content-fit, raster, DPR, optical or input math changes. Frozen hashes independently verified and copied to panel-measurement/reviewer-manifest.json.
- Type/lint/doc gates: device, composite and web typechecks pass independently; scoped source/proof lint passes. Diary distinguishes controlled getter counts from real browser rounding and performance.
- Staging: two-file bounded source slice; no reviewer source edits, build, server, browser or commit actions.
- Runtime gate: actual route framing/hit alignment, border/fractional/writing-mode rounding, resize/hidden reentry and production CPU attribution remain lead-owned. Approval does not predict a 132 ms saving or claim browser FPS.

### Findings

No Critical/Major finding in the frozen source.

### Verified ownership and behavior

Setup attaches/styles/fits the actual panel before constructing its generation-local measurement owner. The owner observes border-box changes but obtains its numerical values from the original offsetWidth/offsetHeight getters. It does not substitute contentRect, CSS parsing, writing-mode conversions or physical pixels. Thus the prior browser rounding source remains unchanged; supplied fixture integers are not presented as browser rounding evidence.

Pure adoptPose reads the cache and keeps its existing acceptance guards, query.applyPose, sticker/carry notifications and settlement order. Observer updates call only projectPanel, which reads the current query screen matrix/current layout and preserves identical-transform assignment suppression. query.applyPose publishes matrices before projection; a notification after a newer pose therefore cannot restore a captured old transform. The helper introduces no RAF loop, fitting call or capture request.

Hidden observations and reads avoid offsets. Zero/invalid measurements suspend projection while retaining the last numerical pair; equal-size positive reentry still publishes once because availability changed. Initial zero waits for the first positive measurement under the existing 45-second host deadline. Abort/disposal rejects waiters and removes listeners; host disposal aborts before clearing helper ownership. The existing host visibility listener refreshes before resuming pixel/pose publication, including pre-initialization. No parallel visibility owner is added.

Disposal clears element/callback/size references and rejects stale observer delivery through its disposed guard. New host generations construct fresh caches. Current readiness and terminal/query behavior remain unchanged while only panel transformation is unavailable. External CSS changes are known on observer delivery, not synchronously before it.

### Independent verification evidence

```sh
bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/panel-measurement/check.ts
bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/native-layout/lifecycle.ts
bun test packages/composite/src/html-in-canvas.test.ts
bun run --cwd packages/device typecheck
bun run --cwd packages/composite typecheck
bun run --cwd apps/web typecheck
bunx eslint packages/composite/src/device-render-host.ts packages/composite/src/native-panel-measurement.ts docs/workstreams/023-mobile-tactility/evidence/gpu-worker/panel-measurement/check.ts
```

All passed independently: 16 panel checks including 5,000 cache reads with zero additional getters and six exact matrix comparisons; 16 existing native measurement lifecycle checks; five HTML canvas tests/39 assertions; three package typechecks; scoped lint. Host callback separation was inspected directly in addition to the retained callsite assertions. Controlled observer/getter tests cover equal notification, newest pose, zero/hidden/reentry, initial readiness, abort/dispose and stale callback. No runtime timing claim derives from them.

### Suggestions (non-blocking)

Retain the lead's actual CSS rounding/hit-alignment observations separately from these source and controlled-count checks; use the same production profile method for the performance comparison.

### Neuve Dogfood Feedback

Not run: current repo AGENTS.md explicitly forbids Neuve shell/board and mandates workstream documents. No fabricated ticket, routing or human approval.
