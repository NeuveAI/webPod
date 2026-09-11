# Independent native assembly helper review

Verdict: **APPROVE the four frozen helper sources below as a bounded source milestone.** No confirmed Critical or Major finding remains in this subset. This does not approve moving broker/private-payload accounting, main adapters, host, worker orchestration, carry integration or full native activation. Complete font/sticker/packet appearance, loss/fallback and 6× interaction gates remain pending with the lead. No browser action, application edit or commit was performed by the reviewer; no manual/process waiver is inferred.

## Exact manifest

Author archive: `/tmp/webpod-render-assembly-freeze/manifest.json`. All four current source hashes match the frozen copies.

| File | SHA-256 |
|---|---|
| `packages/device/src/device-assembly-graph.ts` | `c2e79333ec2d3c08f6dec5ce63a9ddfb22e4e647dcbb8926058f3387a5ca24ac` |
| `packages/device/src/device-font-assets.ts` | `fc630e6989e4f7cf3572998d38203be99a11d2f11fb129bae047521e06814e0f` |
| `packages/device/src/sticker-render-frame.ts` | `fdc1ecad2ac074d46d858217df52adbe4a702e5a4039012d4d43e0c52cad3dc2` |
| `packages/device/src/sticker-pack-render-frame.ts` | `3f4f65665f847c29958da959759564ea0bf0807f6551581a9e8de57a1636fc74` |

## Source findings and ownership

The chassis graph consumes the committed `createDeviceAssemblyRecipe` and `deviceAssemblyGeometries`, preserving recipe child order, positions, names, visibility, render order and shared geometry/material identity. Group descriptors have no additional transform/visibility fields to lose. Its disposal clears only graph references; the admitted lease and material factory remain the sole resource owners. The earlier independent query-matrix experiment compares this exact graph with the query view across 40 poses /37,120 scalars. That experiment is a structural check, not a GPU image comparison.

Font capture invokes the original browser label/backplate raster factories and supplies prepared base pixels. It snapshots sequentially, baking original flip/premultiplication into each ImageBitmap and restoring the used color-space/wrap/filter/mipmap/anisotropy metadata. Its try/finally releases source CanvasTextures; a failed/aborted bitmap capture closes earlier successful images. Installed Three 0.185.1 texture upload and ImageBitmap handling were inspected; restored textures do not request a second vertical flip. Actual font raster pixels and native upload are still a browser acceptance obligation. The retained controlled-boundary proof deliberately does not claim glyph pixel equality.

Equipped assembly receives exact renderer-private surface and render-damage resources via ports, checks version/resource identity and surface/damage kinds, and validates damage sticker identity. It restores geometry once, creates the existing front/back node materials with original appearance/wear/finish inputs, names/order/visibility and exact nearest-filter RedFormat damage texels, then returns an unattached candidate. Material compilation/adoption is owned by the excluded worker caller. No synchronous alpha reconstruction is introduced here.

Packet assembly uses the committed full pack graph/recipe, exact prepared stock/fold/print geometry and material recipes, GPU paper curl nodes and front/back print materials. Paper disables frustum culling as required for shader deformation. Sleeve material arrays preserve geometry group ordering. Progress-only updates change the authored object transforms, visibility and curl; immutable resource/material identity changes must create a new frame through the resource key. The current native producer follows that boundary, but its accounting and full caller lifecycle are separately reviewed.

Both frame assemblers bound admitted resource counts, install finite delivery timers, reject abort/decode/identity errors and dispose all acquired resources on failure. Successful frame disposal is idempotent. Ports and ImageBitmaps belong to these returned frame owners; shared environment texture is borrowed and is not disposed. Resource byte admission remains the canonical producer/broker's responsibility; this review does not certify that changing producer delta. Correct readiness requires the full worker to compile the candidate and reject stale epochs before attaching it.

Nonblocking exception-path limitation: font raster factories run before the capture try/finally. If the second factory itself throws, an earlier unuploaded CanvasTexture receives no explicit dispose event. The wrapper/canvas has not been uploaded or retained by a renderer/cache and becomes unreachable, so no sustained GPU/resource leak was established. Extending explicit ownership to factory construction would improve cleanup symmetry; this is not represented as covered by the native-bitmap failure proof. No source change during the browser freeze is requested.

## Independent verification

- `bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/assembly/reviewer-lifecycle.ts`: actual MessagePorts and real stock constructors/restoration assemble 7 packet meshes with 6 distinct geometries and 6 materials. Dynamic transform update, exactly-once disposal, packet/equipped cancellation and wrong equipped delivery identity rejection pass. This is a CPU assembly/lifecycle experiment, not GPU compilation.
- `.../assembly/reviewer-fonts.ts`: actual capture/restore helper with controlled raster/bitmap boundaries proves successful three-image capture, later capture failure, cancellation after native completion, already-aborted owner, metadata restoration and expected flip/premultiply options. Six native-boundary calls,12 source texture disposals and5 image closures match ownership. JSON explicitly labels pixel parity unmeasured.
- Independently reran `.../pack/materials.ts` and `.../pack/recipe.ts`:54 pinned archived material cases and108 archived layout cases /1,296 matrices pass. These shared recipe proofs supplement, rather than replace, the native assembler lifecycle check.
- `bun test packages/device/src/sticker-paper.test.ts packages/device/src/sticker-sleeve.test.ts packages/device/src/material-map-ownership.test.ts packages/device/src/backplate-finish.test.ts packages/device/src/textures.test.ts packages/device/src/sticker-program-preparation.test.ts`: **23 pass,0 fail,211,094 assertions**.
- Device and composite `bun run --cwd <package> typecheck`: pass. Scoped ESLint on all four source files and both new reviewer evidence scripts: pass. Logs `/tmp/cpu009-assembly-{device-types,composite-types,lint,tests,materials,recipe}.log`.

## Packaging and remaining gates

`device-assembly-graph.ts` and `device-font-assets.ts` have every relative import committed at HEAD and may form a standalone reviewed source subset. Their acceptance also makes the prior query-matrix/material proof dependency stageable with the graph.

`sticker-render-frame.ts` and `sticker-pack-render-frame.ts` type-import untracked `native-sticker-resources.ts` / `native-pack-resources.ts` and depend on the still-changing render-damage type/material adaptation. Hold those two sources and the assembler lifecycle proof for a coherent combined, independently reviewed resource/host commit; do not stage unreviewed dependencies merely to make this subset compile. The font proof is standalone with the font helper.

Full equipped/pack visual parity, bitmap/native texture pixels, actual GPU compile environment, stale frame replacement/retirement and fallback are excluded integration gates and remain mandatory before native preference. The review approves source correctness within the stated recipe and owner contracts, not the whole renderer.
