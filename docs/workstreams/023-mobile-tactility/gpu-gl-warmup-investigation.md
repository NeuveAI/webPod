# GL sticker warmup readiness investigation

The existing GL route reported artwork failure for PW-A01 with no prepared IDs despite full tier, painted root and no context loss. The lead retained actual loaded-atom evidence under `/tmp/webpod-gl*`. Native packet behavior succeeded. This investigation establishes a source race; attribution of that browser failure remains conditional on a corrected live GL check.

## Source correction (CPU009)

Scope: final **GL sticker warmup readiness correction** section of [gpu-worker-scope.md](gpu-worker-scope.md); renderer screen/interaction parity, preparation and material parents already accepted. Baseline is carry commit `485d728`. Only `packages/device/src/StickerPackScene.tsx` and adjacent `sticker-warmup-readiness.ts` change.

`PrepareStickerAsset` previously invoked `prepareStickerPrograms` as soon as the texture was available. `StickerPrint` returns null until asynchronous damage/geometry preparation resolves; it mounts front and backing meshes and calls `onSurfaceReady` in its layout effect. The parent never consumed that callback. The actual pinned program helper rejects an empty group before invoking renderer compile, and later children did not retrigger the parent effect.

Each exact surface generation now has three stable appearance callbacks (earned, locked, placed). The parent waits for all three committed surfaces, including callbacks fired before its passive effect, then starts one retained compile. Texture/geometry/retry generations remount the hidden print owners so old prepared frames cannot satisfy a new source; the retry epoch also reaches existing preparation. Environment changes establish fresh callbacks after child material commit. Context restoration starts one new compile; disposal and supersession abort retained program owners and suppress obsolete publication. Child preparation errors reach the existing error callback. No visible print, shader, geometry, native, carry, memory-limit or debug API change.

## Retained verification

Evidence directory: [gl-warmup](evidence/gpu-worker/gl-warmup/).

- `cold-race.ts/json`: actual Three group, six delayed actual meshes, and actual program helper reproduce the old empty-group rejection with zero subsequent compile calls.
- `readiness.ts/json`: executes the exact extracted corrected parent effect with real Three meshes and actual program helper, controlling only the GPU compile/readiness boundary. Eleven checks cover last-surface admission, out-of-order notifications, duplicates, child-before-parent setup, context loss/restoration, retained clone disposal, pending cancellation, failure/retry, and late callbacks after disposal.
- Existing `sticker-program-preparation.test.ts`: 9 tests, 137 assertions pass (program clone ownership, abort/reentrancy, context loss, invalid metadata, timeout and late disposed handles).
- Device, composite and web type checks pass; both source files and retained proof TypeScript pass scoped ESLint.
- `source-manifest.json` records exact baseline and frozen source hashes for independent review.

The proof exercises the extracted effect rather than a mounted React/Fiber renderer. Actual GL packet/liner recovery and artwork appearance remain the lead's browser gate. No build, browser control, committed instrumentation or acceptance claim was made by the author.
