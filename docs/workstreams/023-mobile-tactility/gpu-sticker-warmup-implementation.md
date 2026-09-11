# Native sticker artwork and program readiness

Status: corrected application source is frozen for independent review. Native cold startup failed its first current-Chrome checkpoint with transaction byte-capacity rejection; no full packet, appearance or performance acceptance is claimed.

## Ownership and live integration

CPU025 authors `packages/composite/src/native-sticker-warmup.ts` and `packages/device/src/sticker-warmup-renderer.ts`. CPU009 independently owns and wires host/protocol/worker/serialized compile queue. The main API is `createNativeStickerWarmup({send,fail})` with `update(scene)`, `ack(sequence,accepted=true)`, `dispose()` and `rendererRetired()`. Worker `prepareStickerWarmup(frame,environment,signal)` returns a detached root plus disposal. No new cache, geometry producer, worker or route is introduced.

The host sends warmup before an already-prepared pack exists, avoiding the native circular dependency on production's `onPrepared` barrier. Every requested artwork has earned/locked/placed material pairs. A single artwork geometry/damage/bitmap resource supplies its three descriptor variants. Source identity includes artwork ID/URL/dimensions/visible bounds and finish program setting; pose, inventory wear and callback object identity do not restart preparation. Callback refreshes are used by the exact current compile ACK. Source changes synchronously clear readiness; old ACKs cannot authorize new source.

One preparation and one latest request are retained. At most ten artwork resources and thirty appearance pairs are admitted, with 64MiB artwork and resource bounds in addition to existing global paper/transaction authority limits. One frame can await ACK. Both preparation and ACK have 60s deadlines; GPU compilation is separately bounded by the actual backend owner. Source supersession normally finishes bounded preparation and discards its result, avoiding abort-induced canonical-producer loss. Disposal/failure aborts preparation. Transferred owners remain charged until matching replacement ACK or renderer retirement; a zero-resource replacement frame disposes the old warm root before a new full source collection is acquired. Empty ACK never claims shader readiness.

The worker uses actual node-material assembly, not proxy shader declarations. It makes the detached root visible and each mesh non-frustum-culled for compilation. Installed Three185 `Renderer.compileAsync` projects the supplied root and obtains lights/scene cache keys from the supplied target scene; CPU009 must supply the current camera, exact initialized studio environment and presented scene. The root is never attached to presentation. Completion means successful compilation through that owner, not merely material construction. This is source-level program coverage, not a full appearance proof. Hidden warmup geometry uses the actual parked-print layout/attributes, not the former four-subdivision hidden peeling pose; tessellation and pose are not shader program features. Visible geometry is unchanged.

## Evidence so far

- `evidence/gpu-worker/sticker-warmup/owners.ts/json`: real geometry/damage workers, private MessagePorts and actual TSL-material assembly, with controlled browser image/raster/bitmap interfaces and manual compile ACK. Twelve bounded cases cover shared three-appearance resources, six actual material meshes, no pre-ACK readiness, stale ACK, duplicate updates, explicit empty replacement, sent custody and final zero worker/owner/byte accounting. It does not simulate native bitmap transfer or GPU compilation.
- `lifecycle.ts/json`: sixteen controller cases at a controlled preparation boundary, including reentrant and obsolete ACKs, callback/source identity, preparation supersession, producer/send failure, explicit rejection, count/byte admission, dispose/retirement, and the actual60s preparation/ACK timers.
- Existing artwork-cache/program-preparation suites:13 tests,164 assertions passed. Scoped source and proof lint passed before catalog correction.
- `catalogue-before.json`: exact PNG alpha from the first ten real metal catalogue artworks with actual workers reproduces startup capacity failure on artwork8. Seven private damage owners are retained; broker diagnostic reports79,882,652 accounted bytes before admission failure. Main has no sent frame yet, so this is preparation admission, not shader/GPU capacity. All owners/bytes return to zero after cleanup. The PNG decoder reconstructs exact RGBA8 filtering and tests alpha computation, not browser colour/raster equivalence.

## Open correction and gates

The generic pack preparer calls `preparePrint`, which computes and retains contour query data. Invisible warmup never queries contours. A bounded correction is being coordinated to omit that unnecessary work while using the same exact damage inputs, keys and producer; no budget increase or visible quality change is proposed. Actual catalog admission must pass before another native checkpoint. Independent source/lifecycle review, actual native full cold startup/all appearance variants, complete packet/carry interaction and matched performance evidence remain required. The lead owns the final native and manual process gates.

## Final corrected author freeze

The earlier open correction is superseded by this section. All application changes are frozen in `evidence/gpu-worker/sticker-warmup/manifest.json` with exact source hashes and retained source snapshots. Independent review remains pending. Eight authored application files:

- `packages/composite/src/native-sticker-warmup.ts`
- `packages/device/src/sticker-warmup-renderer.ts`
- `packages/device/src/sticker-prepared-damage.ts`
- `packages/device/src/sticker-transaction-broker.ts`
- `packages/device/src/sticker-transaction-data.ts`
- `packages/device/src/sticker-transaction-worker.ts`
- `packages/device/src/sticker-material-nodes.ts`
- `packages/device/src/sticker-wear-nodes.ts`

The lead explicitly authorized the six-file extension after real catalog admission exposed unnecessary contour work, private canonical pins, excessive renderer payload and duplicate main-buffer accounting. Baselines are retained before each extension. The prepared-damage baseline already contains CPU009's three exported declarations; those are not authored by CPU025. Haptics separately owns the consuming native pack/equipped/carry adapters and worker assemblers, plus host compile/ACK/retirement integration. Those seams require independent review with this source; they are not claimed as authored here.

`preparePrint` defaults to complete contour preparation as before. Only detached warmup passes `prepareContours:false` through the existing pack adapter. The exact damage key, canonical job, field object and GPU texels are unchanged. A matching accepted compile ACK releases unused main query leases; private renderer resources stay charged and resident with their compiled material/pipeline owners. Disposing a material could release its installed Three render-object pipeline/program cache owner (`RenderObjects.createRenderObject`, `Pipelines.delete`), so this implementation does not discard warmed GPU programs to create budget headroom.

The same producer accepts an optional fifth acquisition argument `{purpose:'render-damage'}`. It privately copies only the canonical GPU onset bytes, sticker ID, width and height. Default acquisition still transfers the original complete result. Main query damage/contour data remains unchanged. All three native consumers reconstruct the original RedFormat/NearestFilter/no-mipmap/flipY=false texture. The node material type now accepts the ID/texture subset it actually consumes; no shader expression changed. Private pending copies charge twice their exact transferred storage, settled copies once until explicit renderer release. Successful delivery releases the redundant main/canonical pin; it does not release the private charge. Pre-aborted or invalid private requests close the port before allocating a canonical lease, avoiding an unobserved rejected result.

Broker accounting now counts each retained main backing ArrayBuffer once across inputs and results, including full backing storage for offset views. Worker canonical results and private copies remain independent charges. Original output/work allowances remain: execution adds actual cloned backing storage to that allowance. A same-producer contour reference pins the exact matching canonical field throughout execution, avoiding only that field clone. A mismatching field, producer loss or fallback keeps the clone allowance. Active cancelled native work and its reference stay charged until completion/retirement. New-input admission, selected-job admission and pressure eviction use the same prospective storage calculation. Existing global limits are unchanged. These managed-buffer counters do not bound total browser, GPU or JavaScript object heap.

Final combined `catalogue.ts/json` uses exact PNG alpha for the first ten real artworks, complete authored eight-print packet recipe, and two real completed carry producer frames through the actual native carry adapter. Warmup, full packet and current/candidate carry are retained simultaneously. Settled managed charges: transaction79,201,888 bytes (20 private owners), paper9,061,272 bytes, carry6,660,240 bytes. All frames, private owners, canonical resources and workers return to zero. This is a single combined admission/lifetime unit, not separate first-print successes; it is not a CPU/GPU timing or visual proof. Earlier failed-stage artifacts explain why a first-frame-only claim would have been wrong.

Additional retained checks:

- `owners.ts/json`:14 actual-owner/material assembly checks, including default visible contour versus omitted warmup contour and identical canonical damage field/geometry.
- `private-damage.ts/json`:9 actual-worker cases covering default full result versus exact GPU-only bytes, independent transfer ownership, canonical eviction while private bytes remain retained, pre-abort, abort immediately after actual delivery dispatch and late-response cleanup. The small fixture changes27,648 full payload bytes to4,096 exact GPU bytes.
- `accounting.ts/json`:7 actual-broker cases. Shared offset views charge one8,192-byte backing buffer; independent buffers charge8,192 bytes more. Separate worker results remain charged. A real contour-reference pins its parent through cancellation; cloned-but-equal field input uses the full path; forced producer loss completes through the existing exact fallback and ends at zero.
- `worker-guards.ts/json`:8 worker-helper rejection/disposal cases; bitmap closes are observed. It does not compile a GPU program.
- `lifecycle.ts/json`:16 controller cases including actual60s deadlines, refreshed callbacks, source supersession, rejection and reentrancy. Final rerun covers query-only release after accepted ACK.
- Final affected device/composite/web typechecks and scoped source/proof lint pass. Existing4 suites pass21 tests and17,730 assertions. No new unit tests, browser sessions, trace captures or commits were made by this author.

Actual native cold readiness, complete packet/liner/carry appearance and interaction, backend failure recovery, matched performance and the lead's manual process gate remain open. The author freeze is not independent approval.

Independent CPU025 review found the inherited private-owner slot was admitted only after cold canonical await. Corrected before acquisition/await:100 concurrent same-key calls now reject68 immediately, retain exactly32 bounded pending owners, and end at zero after cancellation. Private byte stages and post-delivery ownership are unchanged. Reviewer reproduction is retained as reviewer-private-admission.ts/json; this correction awaits that reviewer’s independent rerun. Final manifest snapshots were refreshed after the fix.
