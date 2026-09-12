# Independent shared assembly and preparation lease review

Verdict: **APPROVE — bounded source/interface milestone only.** No native renderer activation, whole-goal completion, integrated visual parity or mobile performance approval is implied.

## Scope and independence

Reviewed CPU017 against pinned `ebebb32d0b7f0b30b7e41b81778293d6b7d44405`, the complete gpu-worker-scope.md, gpu-renderer-host-plan.md and host implementation diary. The reviewer did not author these files. CPU011 sticker transaction authoring was paused and is expressly excluded from this verdict; it requires another reviewer.

Read Device.tsx, DeviceAssembly.tsx, device-assembly-recipe.ts, device-assembly-materials.ts, ViewerLitDeviceFrame.tsx, device-light-recipe.ts, immutable-shell-preparation.ts, immutable-shell-worker.ts, device-preparation-data.ts and all five changed existing source-location assertions. The moving native worker entry, graph activation, native image adapter, fonts, protocol and motion implementation are excluded. No browser, trace, application edit or commit was performed.

## Findings and source checks

No Critical or Major finding remains in this bounded slice.

- The recipe preserves baseline child order, mesh names, shell geometry identities, hardware parts, display offsets, wheel gap floor, wheel pivot and label offset/renderOrder. Select retains a declarative rest parent with no declared position on its moving child. Device attaches the same control authority to that child and wheel group. Orientation event callbacks and accelerated visual-shell raycasts remain distinct. Registered collision mutation and rear-wrap bindings survive extraction.
- The GL material table preserves black/white physical parameters, albedo multiplication, aluminum/noise/anisotropy maps, backplate roughness/bump override, explicit studio intensity fallback, label blending/depth/offset, hardware coefficients and LCD ownership. Sharing the two identical gap materials changes resource identity but not authored fields. LCD remains borrowed and excluded from table disposal; unchanged default-material prop identity does not overwrite a compositor-installed material on an unrelated rerender.
- Installed Fiber9.7.0 `events-156d8d12.esm.js:15201` disposes reconciler child objects, not a mesh's prop-owned material/geometry recursively. The extracted table therefore has its explicit effect cleanup, preparation owns geometry/maps, and screen default has its separate owner. No new disposal suppression flag is required. Native renderer callers must likewise dispose their private wrappers before releasing the lease.
- Light recipe preserves key/kick/rim ordering and exact aim/intensity/color/emitter formulas. Lights remain siblings of the rotating model; enclosure centering is unchanged.
- Preparation continues to use one cache and producer. Worker canonical output, main query wrappers and private renderer buffers are distinct. Direct MessagePort copy happens in the canonical producer without recomputing an already cached recipe or detaching mounted main storage. Pending lease cancellation/timeout terminates before reservation release and uses the existing single-producer cooperative recovery if another preparation is active. Worker identity, request and lease identity reject stale messages.
- Renderer admission counts canonical/main/private plus two payloads for pending copying, capped at128MiB and four leases. Unused canonical residency participates in the existing64MiB cleanup. These are renderer admission and unused-cache limits, not a claim that unlimited simultaneously mounted GL owners can fit a universal heap budget. Successful native leases retain their entry until explicit release; loss of the canonical worker preserves existing main/private data but rejects new native acquisition instead of silently rebuilding it.
- The five source-location test adaptations retain the actual physical requirements and follow the extracted factories/recipe. They are not substitutes for the pending full-route appearance gate.

Minor documentation/format items were relayed: stale screenshot-freeze wording in the diary and redundant final blank lines in Device.tsx/ViewerLitDeviceFrame.tsx. Neither changes runtime behavior.

## Independent verification

- Existing control-physics, backplate-finish, physical-continuity, flush-wheel-geometry and screen-aperture suites:25 pass,164411 assertions.
- Existing front-surface and orientation-grab plus screen-mesh boundary suites:19 pass,266 assertions. Total44 pass/164677 assertions; this includes the author's full35-test assembly selection plus nine screen-boundary checks.
- `bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/preparation/lifecycle.ts`:12 checks pass, including shared owners, StrictMode reacquisition, disposal, stale worker, exact fallback and bounded queue.
- `bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/renderer-host/prepared-leases.ts`:seven checks pass using actual Bun module worker and MessagePorts with a deterministic React commit shim. One default canonical/main/render set accounts for69,446,088bytes =3×23,148,696; moving the private payload does not detach main buffers. Pending abort retires the producer, cached native acquisition does not recompute, and final cleanup removes cache/worker.
- Independent device typecheck and scoped ESLint covering all listed source/test/proof files pass. Composite typecheck checked separately below when complete.

Source comparisons and deterministic native-worker tests support this milestone. They do not establish browser draw appearance, frame timing, GPU memory behavior or input alignment. The supervisor reports the current GL front Music view visible with a clear console after the coordinated freeze; that is supervisor evidence, not a reviewer browser test. Full native scene/material/paint/readiness/fallback, rapid-motion queries and6×CPU mobile acceptance remain mandatory CPU009/integration gates.

Independent `bunx --bun tsc --noEmit -p packages/composite/tsconfig.json` also passes.

Final delta check: author corrected only the two trailing blank lines and stale freeze diary wording. `git diff --check` passes. No application behavior changed after the reviewed checkpoint.
