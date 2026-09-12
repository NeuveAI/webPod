# Independent native query and raster helper review

Verdict: **APPROVE the five bounded helper sources below**, after correction of one confirmed Major. This is source acceptance only, not approval of the moving host, renderer worker, controllers, Scene integration, native interaction matrix, visual parity, fallback or 6× performance. No browser actions or application edits were performed by this reviewer. Parent owns the remaining human/process ledger; no waiver is inferred.

## Exact reviewed manifest

| File | SHA-256 |
|---|---|
| `packages/device/src/native-element-image.ts` | `ef26a67f163de01181704ca393f038add509f46c22934a5b5235aa0fc24b6cf4` |
| `packages/device/src/device-query-view.ts` | `2f5b8b7464ef9b6959138fe34deba8af69e1f0f461e0acd9be54a5bbaab49b28` |
| `packages/device/src/sticker-projection.ts` | `e51fdad206c87d7cfd4a50726db04e01a7b3e84f17c0d470b5b0a88a230f834c` |
| `packages/composite/src/native-pack-layout.ts` | `e10aed7376ff19a28546c76c668e793a11c736af2724eb1d0e6994f68f9ec5d6` |
| `packages/composite/src/native-pack-query.ts` | `9d95c87eb320293047b6cce93536b116a9d974eeb7ff35c0454b5c13dda1fc09` |

Initial author snapshot: `/tmp/webpod-host-helper-freeze/manifest.json`. The corrected query hash above supersedes initial `99ac9e0ccb42151d2484b160a36e1c2f404b2b1186fdd0228440de2007b9153c`; the other four hashes are unchanged.

## Confirmed finding and independent closure

**Major, corrected:** `device-query-view.ts` originally assigned opacity 1 to every non-glass query material. Configuring black body or steel opacity 0 produced renderer opacity 0 versus query opacity 1, so sticker visibility incorrectly admitted an invisible surface as an occluder. The helper also lacked colourway selection. Actual prepared geometry and authored GL material construction reproduced this; no GPU timing was inferred.

The author now maps the exact selected body, wheel, Select, gap, steel, glass and reveal material opacity/transparent values, accepts `isBlack`, and exposes `updateMaterials` with registered assembly invalidation only when values change. The current host constructor supplies `input.isBlack`; broader remount integration remains host review scope. Independent `reviewer-query-opacity.ts/json` passes **116 mesh comparisons** across both colourways, changed-parameter revision invalidation and unchanged-parameter deduplication. The same retained script failed against the original helper; its final output records corrected success.

## Checks and source reasoning

- Independently reran `bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/raster/resize.ts`: stable sampler identity, resize allocation dimensions, matching copy, image closure on success/failure and retired-owner behavior pass. This uses the actual installed Three StorageTexture/WebGPUBackend with a controlled GPU boundary, not physical GPU execution.
- Independently reran `.../renderer-host/query-matrices.ts`: 40 poses, 37,120 scalar comparisons, maximum difference 2.842170943040401e-14; child-local Select rest/travel preserved. Reran after the material correction.
- Independently reran `.../renderer-host/pack-layout.ts`: 54 viewport/FOV/progress/reveal cases, maximum scalar difference 4.547473508864641e-13; motion-only changes preserve the resource key.
- `bun test packages/device/src/sticker-surface-grab.test.ts packages/device/src/sticker-transform-projection.test.ts packages/device/src/sticker-projected-bounds.test.ts packages/device/src/sticker-drop-projection.test.ts`: **12 pass, 139 assertions**.
- `bun run --cwd packages/device typecheck` and `bun run --cwd packages/composite typecheck`: pass at this integration checkpoint.
- Scoped ESLint on all five reviewed sources and `reviewer-query-opacity.ts`: pass. Logs: `/tmp/cpu009-review-{raster,query,pack,projection,device-types,composite-types,lint}.log`.

Installed Three 0.185.1 `StorageTexture.setSize` disposes a changed allocation; `renderers/common/Textures.js` disposal clears referencing bind-group bookkeeping and sampled bindings before reinitialization. The resize helper retains JavaScript sampler identity while creating an exact-sized GPU destination and closes every delivered image. A resize allocation/copy failure requires caller retirement of the renderer; no old-allocation rollback is claimed. Actual hardware resize/glyph/alpha parity remains pending.

Query meshes borrow prepared geometry and own only lightweight query materials and preparation registrations. The flattened chains preserve authored content centering, wheel and Select rest frames; disposal releases registrations/picking/wrap bindings without disposing shared prepared geometry. Local control changes explicitly invalidate registered assembly provenance. Query pose updates are bounded by authored mesh count, not vertex count.

Pack layout follows the installed Fiber perspective viewport formula for the authored camera (zoom 1), then the shared pack recipe. Pack query stock carries exact sampled GPU-paper AABBs and prepared sleeve bounds; print wrappers borrow existing prepared query geometry/damage/texture. Size/material topology changes require a new resource-key owner; current controller recreates that owner, while compatible progress/curl updates reuse it. This helper approval does not assert an end-to-end packet/carry hit test or GPU visual comparison: those remain native integration gates. The existing parity checks cover the recipe/layout and shared stock implementations, not every moving host adoption path.

Shared sticker projection is the extracted existing placement/grab/drop/contour/bounds authority: cancellation, visibility epoch, camera/content pose, canvas rect and prepared surface revision participate in freshness. Current callers supply a stable mounted content root and live scene getter. The reviewer did not approve unrelated edits in those callers.

## Commit packaging boundary

`native-element-image.ts`, `device-query-view.ts`, `sticker-projection.ts`, and `native-pack-layout.ts` have all their relative imports present at HEAD and may be staged as a standalone source subset. `native-pack-query.ts` type-imports still-untracked `native-pack-resources.ts`: **hold it for a coherent combined host commit**, rather than pulling unreviewed producer code into this approval.

Proof packaging is narrower than source packaging: `raster/resize.ts` is standalone with committed dependencies, but `query-matrices.ts` and `reviewer-query-opacity.ts` use untracked `device-assembly-graph.ts`, and `pack-layout.ts` uses untracked `native-pack-resources.ts`. Retain these proof results and stage their scripts with the corresponding independently reviewed host dependency set. Do not imply they run from a helper-only commit.
