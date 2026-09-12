# GL invisible warmup retention analysis

Read-only bounded design check for the reproduced wrapped PW-A01 rotation capacity failure. The reported placed source is x .2358403058370761, y .28404935793217645, width .7204816442896202, rotation 0, wear 0. Author's actual-worker reproduction identifies a 96 MiB execution admission failure with roughly 85 MB resident current owners. Removing empty warmup contours alone saves only about 1,500 bytes and is not a solution.

## Existing ownership

PrepareStickerAsset renders three invisible StickerPrint variants over an already-small shader warmup geometry. Each StickerPrint still calls usePreparedStickerDamage and retains its PreparedPrint, including full canonical damage fields and contour/input references. The geometry is intentionally not a visible/query print, so these CPU results are not queried by the warmup.

prepareStickerPrograms already clones and retains material/program owners until signal abort/context loss; it clears the temporary cloned object hierarchy after synchronous compilation. Program residency is therefore a distinct existing owner, not a reason to keep all hidden PreparedPrint CPU query resources. Simply unmounting/releasing hidden resources after compile is less attractive: copied material hooks share uniform owners and can retain a disposed derived texture/its bytes unless that ownership is separated carefully.

## Minimum proposed correction

Use an explicit invisible program-warmup purpose in the existing StickerPrint component, only from PrepareStickerAsset. Keep the same material construction, actual artwork map, roughness/environment, finish setting, earned/locked/placed appearances, front/back sides, geometry attributes and six real mesh/material owners. For this purpose only, bypass prepared damage/contour work and render the existing small warmup geometry directly. Do not alter any visible/query caller or create another producer/cache.

This is supported by sticker-wear.ts: explicit null damage still installs the same shader patch and customProgramCacheKey. Damage-enabled, wear and damage sampler are uniform values; their presence is not a generated GLSL variant. The initial branch depends on the uniform at execution, not preparation. Installed Three185.1 WebGLPrograms builds standard material/geometry/map parameters plus customProgramCacheKey, without examining these custom uniform values. Locked/placed front patches and backing wear patch must still be included exactly. Texture alpha decoding/init remains in the existing parent readiness path.

Keep existing all-surfaces readiness and program polling. A warmup surface callback must identify the actual current raw mesh/material generation, not signal merely because a texture exists. Program success stays after every required material is submitted and ready. Abort, retry, context loss, environment/texture generation changes and disposal keep their current semantics. No early public readiness or invisible draw is introduced.

Likely bounded production files: StickerSurface.tsx and the PrepareStickerAsset caller in StickerPackScene.tsx. This is a proposal for lead scope, not an implemented change.

## Required proof before acceptance

- Exact shader source and installed material/program parameter/cache-key parity for earned/locked/placed front/back, comparing normal prepared and program-only warmup with the same real artwork/environment/geometry attribute shape.
- No warmup transaction reservation or CPU damage/contour owner; texture/artwork readiness still real.
- Existing delayed all-surface readiness, abort/context loss, late completion, retry and retained program lifetime tests.
- Actual canonical worker workload including warmup catalogue, full packet, current wrapped placement and rotated candidate; unchanged fixed cap and final zero. A workload that only removes contours or omits mounted rotation is insufficient.
- Visible preparation, fields, geometry, contour and output bytes remain unchanged; independent review and live GL rotation confirmation required.

No application edits, build, browser operation or new profiling were performed for this analysis.
