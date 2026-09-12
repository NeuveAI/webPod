# GL wrapped sticker preview: bounded warmup retention fix

## Scope and observed failure

The clean dbe65c2 GL human editor admitted pointer input and changed the rotation draft, but retained its previous contour and reported an artwork failure. The exact saved PW-A01 placement is x=0.2358403058370761, y=0.28404935793217645, width=0.7204816442896202, rotationDeg=0, wear=0 on the back. Its first 10.4074328147916 degree candidate failed the transaction broker's unchanged 96 MiB execution admission. Bounded diagnostics captured `Sticker computation byte capacity exceeded` in print preparation (approximately 85 MB already retained, 31 entries, one 94,272-byte private contour).

The worker/mounted reproduction uses exact catalogue PNG alpha, five-art hidden warmup, actual packet geometry, current mounted print and a retained private current contour. A centered width .25 control passes; the actual wide/wrapped placement fails. This is a preparation capacity failure, not a missed React/projection notification.

## Rejected alternative and implementation

Omitting hidden warmup contours alone is insufficient: their low-resolution grids produce empty contours, saving only 1.5 KB and five entries. That experiment still fails. GL warmup instead retains approximately 28.94 MB of canonical damage preparation fields that only invisible shader warmup owns. Native material-only warmup already releases CPU query fields.

Only `packages/device/src/StickerSurface.tsx` and the `PrepareStickerAsset` caller in `packages/device/src/StickerPackScene.tsx` change. An explicit `program-warmup` purpose retains the same raw low-resolution geometry, artwork/roughness/environment maps, material factory, six earned/locked/placed front/back shader variants, compilation callbacks and compiled program ownership. It supplies null to the existing preparation hook, so no damage or contour preparation is requested. Its geometry/material readiness callback fires after actual mesh commit. The normal purpose remains the default and preserves all visible/equipped/carry preparation.

The only caller is inside the permanently invisible `prepared-sticker-*` hierarchy. Projection/picking resolves named meshes specifically under `device-equipped-stickers` or `device-carried-sticker`, never this hierarchy. Warmup mode itself also forces its group invisible. No cap increase, visible geometry reduction, shader change, artwork change, deferred first interaction or graphics-quality change.

## Verification and evidence

Evidence directory: `evidence/gpu-worker/gl-runtime-failure/`.

- `gl-human-rotation-overlap.ts/json`: exact wide-placement failure with prior CPU warmup ownership; captured allowlisted diagnostic identifies the capacity rejection.
- `gl-human-rotation-without-warmup-contours.ts/json`: insufficient contour-only omission control.
- `gl-human-rotation-program-only-warmup.ts/json`: actual changed rotations 0, 10.407, 20.815, 31.222 degrees, retained current query, restored placement and epoch/unmount handling. Passes; final transaction/paper/private ownership zero. Largest retained *sampled stage*, not execution peak, 71,502,664 bytes.
- `gl-warmup-program-parity.ts/json`: extracts the unchanged production material factory, compares actual installed Three WebGLPrograms parameters/cache keys and fully patched GLSL before/after prepared damage uniforms. All six variants are exactly equal; uniform values do not create program variants.
- `gl-warmup-mounted.ts/json`: mounted actual StickerPrint, three readiness callbacks and six raw meshes, preparation disabled in warmup, normal visible default still supplies artwork for preparation, zero transaction ownership. R3F environment/artwork mocked; this is not a browser GPU compile claim.
- Existing program preparation suite: 9 tests / 139 assertions pass, covering retained clone programs, exact callbacks, disposal, compile failure, timeout, abort and context loss.
- Device, composite and web types pass; scoped production/proof lint passes.

Production browser checks and independent review remain separate gates. No runtime performance improvement is claimed from these CPU-only proofs. Temporary diagnostics are lead-owned and restored separately; they are not part of this fix.
