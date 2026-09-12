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

## Separate live GL get/release capacity failure

After the warmup readiness correction, a fresh GL reload/get/release sequence still produced the generic artwork banner. A separately authorized one-record temporary rejection inspection in `sticker-latest-preparation.ts` captured actual admitted `print-damage-contour`, artworkPW-A01, Error `Sticker computation byte capacity exceeded`. The generic image wording does not mean texture download failed. That diagnostic source was restored byte-exact (`gl-runtime-failure/restored-manifest.json`, original hashc6ed30bf); captured reason and exact temporary patch are retained. Native get/release smoke passed independently.

Source tracing: GL warmup retains three prepared print wrappers per artwork, but the three share damage/contour keys for the same geometry and texture. It is **not** threefold dense duplication. Actual five-art warmup retains28,938,808 transaction bytes; the eight-print packet increases this to72,284,240bytes (~68.94MiB). A retained actual PNG-alpha/preparePrint/packet resource workload confirms this fits and returns all owners to zero. Native invisible warmup has an accepted early query-release path that GL does not use, so their retained baselines differ.

`webpod_get_sticker` is not a simple free-peel pose: it sets landing.97 and a centered width.25 preview placement, while release clears the draft. Updated workload includes the actual carry producer and prepared target damage, retaining current while candidate prepares. Four stable-context frames still pass. This falsifies the claim that ordinary stable carry plus GL warmup/packet necessarily exceeds the cap.

An earlier controlled fixture omitted the rear's required bounding sphere, causing the existing GL cooperative fallback rather than a Worker. That fixture did reproduce capacity failure on the second target-damage frame (83,541,020bytes retained after rejection), because a new target wrapper/damage identity was created for each cooperative frame. Correcting the fixture's prepared bounds produces one actual carry Worker, no worker errors, and a passing sequence. This is a discovered pressure path, **not evidence that the live GL route fell back**. Current retained `gl-owner-workload.ts/json` uses the corrected actual-worker fixture, and states its controlled dimensions/Box rear limits. It does not impersonate the browser's exact current geometry or owner timing.

Before a permanent correction, the smallest further evidence would expose the existing broker rejection's active request kind and bounded entry kind/ref/byte totals, plus any carry context/worker failure reason/generation. Do not infer the cause from the aggregate cap banner, raise96MiB, remove visible contours, or add a producer. No product source changes have been made in this investigation; optics owner files were released to the separate temporary glass-mask author.

### Actual admission ledger and pending-source wrapper seam

The fresh GL get/release rejection was captured in `evidence/gpu-worker/gl-runtime-failure/admission-captured.txt`. At contour job 43, the exact ledger was 103,079,156 bytes against 100,663,296: main backing 43,209,912, canonical worker 39,591,272, and execution allowance 20,277,972. No private copies or carry-failure record occurred. Both temporary diagnostic files were restored byte-exactly; see admission-restored-manifest.json.

The rejected contour had 1,875 position and 1,250 UV floats, matching the parked-source resolution. PW-A01 damage jobs 37, 40 and 42 likewise used that resolution. In the pending-frame branch, PeelingPrint passes an already prepared source mesh geometry to StickerPrint. The default wearGeometry is that wrapper; preparePrint creates a new damage identity from the wrapper while retaining inherited source descriptors. This is a concrete duplication seam, though the ledger alone does not identify every React publication that created those three jobs.

The bounded actual-adapter reproduction `gl-source-wrapper-workload.ts/json` retains five-art GL warmup, eight packet prints and pending-source wrapper generations. Current preparation rejects the first extra wrapper. `gl-source-wrapper-reuse-workload.ts/json` supplies the source's existing descriptors through the already implemented exact reuseDamage option: all four retained wrapper generations fit and final transaction ownership reaches zero. These probes use exact catalogue alpha and authored packet geometry; they do not claim mounted React scheduling or browser parity.

Proposed narrow correction, pending explicit scope: preparePrint should consider inherited source damage descriptors with the existing cooperative exact consumed-input comparator. Preserve all inherited leases and independent contour preparation for the current geometry; no changed cap, approximate key, global cache or early disposal. Verify exact field/GPU/contour results, differing-input rejection, cancellation and current/candidate retention before independent review.

### Scoped implementation frozen for independent review

Only sticker-prepared-damage.ts changed. It considers inherited damage descriptors alongside explicit candidates, bounded to 64 and checked using the existing yielding exact comparator. Every inherited acquisition remains; contour identity/preparation still follows the actual geometry. When the exact damage key already exists in inherited metadata, registration retains that descriptor list instead of appending another duplicate key, preventing wrapper provenance growth without releasing any live lease.

The archived pre-change function in gl-prepared-damage-before.ts preserves its body, with import paths relocated to the same installed/source modules. gl-source-wrapper-before-workload.ts reproduces rejection; the corrected default admits four retained wrapper generations. The 10-case exact proof uses full 96-segment geometry and verifies nonempty contour byte equality, exact damage field/GPU output, different normal/UV/art inputs rejecting key reuse, immediate cancellation with unchanged accounting, retained borrowed bytes after source release, independent changed-position geometry, and final zero.

Validation: 17 existing alpha/contour/program tests with 17,705 assertions pass; source and proof lint pass. Device types passed before the parallel output implementation began producing four Node.rgb/a typing errors; subsequent composite/web checks contain only those peer errors. Final package checks will be repeated after that disjoint seam is corrected. Source hash and exact patch are in source-reuse-manifest.json and source-reuse.patch. No build, browser work, or commit performed. Actual fresh GL tool and physical gesture acceptance remains with lead.

Final frozen-source validation: after Mobile corrected the disjoint output typing seam, device, composite and web typechecks all pass. Source hash remains b2b27ba4.

### Cold parallel admission: exact empty-grid work allowance

The later initial PW-A04 failure is distinct from the source-wrapper duplication. The cold ledger rejected contour35 before any input at 103,996,312 bytes (37,950,564 main +34,339,424 canonical +31,706,324 execution), with contour36 pending. All temporary origin/broker instrumentation was restored before this correction.

Pinned prepareStickerContourSteps exits immediately unless positions and UV arrays match the canonical 97×97 vertex grid. Actual rejected packet input was 25×25, so it allocates no contour paths at any wear. This is not a wear-zero optimization: full-grid wear0 produces nonempty contours. The broker now omits only boundaryCandidates.length×512 work allowance for that exact existing early-return predicate. All input, clone, canonical/private charges, valid-grid allowance and the 96MiB cap remain unchanged.

Before/after proof retains five-art GL warmup and launches all eight packet prepares concurrently: old rejection is retained in gl-cold-parallel-before.json; corrected gl-cold-parallel-workload admits all23 total owners and releases to zero. gl-contour-admission-exact verifies19 cases, including full-grid wear0/.4/1/NaN nonempty output with unchanged estimate, each mismatched attribute shape's exact empty output, current ownership across actual-worker cancellation, full-grid over-cap rejection and finalzero. The source-wrapper four-generation, exact10-case output/lifecycle and actual-worker carry transition proofs also pass.

One source file only: sticker-transaction-broker.ts. Eight existing alpha/contour tests (17,568 assertions), device/composite/web typechecks and scoped lint pass. Frozen hash/patch in contour-admission-manifest.json and contour-admission.patch. No browser/build/commit performed; fresh live cold GL and physical interaction acceptance stays pending with lead.

### Postdrop full-grid current/candidate damage

The postdrop ledger retained full-grid PW-A01 damage42/contour44 and candidate damage45/contour46; the latter required 104,401,828 bytes against the unchanged cap. All four diagnostics were restored, including the corrected broker. Array lengths alone do not establish whether live42 was landed carry or a prior equipped generation. The source separately proves static global pack epochs can restore the same surface into a new wrapper while the prior print remains mounted; no exclusive live attribution is claimed.

Before editing, gl-restored-surface-workload reproduced the cap on the second restored surface after five-art warmup and eight packet prints. It asserts different wrapper identities but identical canonical position/normal/UV arrays. Supplying the current print's descriptors through existing exact reuse admits four retained generations and reaches zero. The scoped one-file fix makes usePreparedStickerDamage pass its own current print descriptors to the existing comparator; no cross-owner cache, static epoch rewrite or altered cancellation policy.

The actual mounted React/Jotai hook proof gl-current-reuse-mounted renders four restored surface generations, verifies the prior current print remains while a yielded candidate prepares, checks field identity across exact candidates, supersedes epoch5 with6, and unmounts pending7. No failure callbacks occur; all final ownership is zero. Exact input/output/negative cases still pass, including normal/UV/art changes rejecting reuse. Seventeen existing tests with17,705assertions, three package typechecks and source/proof lint pass. Source frozen761130f0; manifest/patch current-reuse-manifest.json/current-reuse.patch. Live settled placement/return remains lead-owned acceptance.

Actual current Chrome validation of761130f0: fresh GL reload completed entry with backendwebgl and no alert. Trusted physical packet/liner and PW-A01drag (131.68,433.27→220,150) reached settled ready, heldnull, placed1, pendingSaves0. Existing Edit and Return restored settled ready/placed0. Registered WebMCP get/release also returned ready and unplaced earned sticker. No temporary application diagnostics or performance trace were active. This closes the reproduced cold/settled-transition functional failure for this observed sequence; it is not induced automatic GPU-loss coverage or a timing benchmark. Filtered responses retained undergl-runtime-failure/webpod-gl-current-reuse-*.json.
