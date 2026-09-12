# Review: GL program-only warmup and wrapped preview

## Verdict: APPROVE

### Correctness Check

- Source of truth: current AGENTS.md, lead's explicit two-file program-only warmup dispatch, gpu-gl-wrap-preview-fix.md, prior gpu-gl-warmup-retention-analysis.md, exact frozen source and installed Three185.1 shader/program implementation.
- Tracker: workstream documents; no Neuve board/shell under repo law.
- Scope: only StickerSurface.tsx and PrepareStickerAsset's caller in StickerPackScene.tsx. Exact frozen SHA-256 values independently verified and copied to evidence/gpu-worker/gl-runtime-failure/gl-wrap-preview-reviewer-manifest.json.
- Target: avoid invisible warmup CPU damage/contour retention without changing visible print preparation, material/shader variants, compile readiness, caps or ownership.
- Type/lint/doc gates: independent device/composite/web typechecks and production/proof lint pass. Diary qualifies sampled retained-stage bytes versus execution peak and CPU proof versus browser rendering.
- Source staging: bounded two-file source change, separate from restored diagnostics/evidence. Reviewer made no application, browser, build, server or commit changes.
- Runtime gate: real GL human wrapped rotation, current contour/control update, save/restore and no artwork failure remain lead validation. This source verdict is not feature-complete or browser performance approval.

### Findings

No Critical/Major finding in the frozen implementation.

### Independent source checks

Only PrepareStickerAsset selects `purpose="program-warmup"`. Every equipped, parked packet, source-fallback carry and prepared carry call retains the default visible-print path. Warmup itself forces its group hidden; projected/picked print lookup remains scoped to actual equipped/carry owners. The raw low-resolution geometry is the same existing warmup geometry and never substitutes for a displayed print.

The null-texture argument disables the existing preparation hook without a new producer, cache, damage algorithm or cap. The same material factory still constructs the six appearance/side variants using actual artwork, roughness, studio environment, finish, alpha threshold and standard physical flags. Existing applyStickerWear explicit-null initialization installs identical GLSL and custom program cache key; prepared damage changes uniform values only.

The program-only readiness callback occurs in a committed layout effect after raw meshes/materials are attached. Parent geometry/texture/preparation-epoch keys remount the children for those generations, and studio changes create new readiness callbacks. Existing all-surfaces readiness, actual renderer compilation and program polling remain the public readiness barrier. The new path does not call artwork-ready directly.

Installed WebGLRenderer.compile traverses mesh objects using `scene.traverse` (lines1433–1459), so the additionally hidden warmup group does not omit material compilation. Target lights retain their existing visible traversal. prepareStickerPrograms clones/retains material program owners, captures actual programs and clears the temporary hierarchy; abort/context loss still disposes those owners. No program-lifetime implementation changed.

### Independent verification evidence

Commands rerun from repository root:

```sh
bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/gl-runtime-failure/gl-warmup-program-parity.ts
bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/gl-runtime-failure/gl-warmup-mounted.ts
bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/gl-runtime-failure/gl-human-rotation-program-only-warmup.ts
bun test packages/device/src/sticker-program-preparation.test.ts packages/device/src/sticker-wear.test.ts
bun run --cwd packages/device typecheck
bun run --cwd packages/composite typecheck
bun run --cwd apps/web typecheck
```

All pass. The parity proof invokes the unchanged production factory and actual installed WebGLPrograms parameter/cache-key builder, comparing fully patched GLSL for all six variants before/after damage uniform assignment. The mounted proof confirms three committed callbacks, six raw meshes, disabled preparation for warmup, unchanged visible-default preparation input and zero transaction ownership. Its R3F/artwork boundary is mocked; it does not claim GPU compilation.

The actual-worker mounted regression includes exact real PNG alpha, full packet, actual wide PW-A01 placement, current private contour ownership, rotated candidates at approximately0/10.407/20.815/31.222degrees, and final transaction/paper/private ownership zero. The current print remains while candidates prepare. The warmup resource omission in this workload is justified separately by the mounted component and shader parity proofs; the workload does not pretend to run browser GL rendering. The previous contour-only omission failure is retained as a falsification control.

Program preparation plus wear tests independently pass11 tests/453 assertions, covering retained clones, exact callbacks, mutable uniforms, abort, timeout, context loss, disposal and synchronous failure. Scoped lint passes for both production files and all three focused proof scripts. Three package typechecks pass.

### Suggestions (non-blocking)

Keep real-route GPU readiness and successful human rotation evidence separate from these source/worker tests. Do not label the largest retained sampled stage as an execution peak or infer a general memory guarantee for every catalogue/layout combination.

### Neuve Dogfood Feedback

Not run: current AGENTS.md prohibits Neuve shell/board and uses workstream documents. No fabricated ticket or approval routing.
