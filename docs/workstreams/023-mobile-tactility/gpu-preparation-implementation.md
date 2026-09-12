# Exact immutable device preparation

WEBPOD-CPU-006, implementation A. Source frozen for independent review. No commit, browser interaction, deployment, Canvas change, sticker interaction change, or quality reduction by this engineer. Lead authorized the existing screen-aperture ownership assertion update. A proposed AxialSelectControl disposal forwarding was removed after independent review; that file is unchanged.

## Execution and ownership

The existing shared immutable preparation boundary now prepares the complete device assembly: two shells, eight control/display inserts, 47 hardware parts, five dense DataTexture fields, and the 1024×2048 backplate roughness base. Device and DeviceHardware adopt prepared objects before the scene commits; no post-warm resource swap. Geometry is passed as mesh props, not Fiber children. New meshes retain default Fiber removal so their declarative materials are disposed normally; cached geometry has its explicit cache owner. Materials remain per device. DataTexture wrappers and geometry buffers belong to the shared cache; first-owner unmount cannot dispose another live device's assembly.

`device-preparation-data.ts` is the canonical renderer-independent boundary. `DevicePreparationRequest` carries request id and numeric form. `DevicePreparationResponse` carries the same id and either PreparedDeviceData or error. PreparedDeviceData contains front/back, insert and named hardware geometry transfers, PreparedTextureData records and backplate base pixels. Geometry uses existing ShellGeometryTransfer attributes/index/groups/order/bounds; texture records preserve byte channels, sampler/color/mipmap/flip/premultiply/anisotropy/alignment metadata. `preparedDeviceBuffers` transfers private producer buffers once; `restorePreparedDevice` only creates Three wrappers. A render-worker host can consume this same data directly. DEVICE_PREPARATION_VERSION joins the full form key and must advance when interpretation/recipe changes.

Browser font raster is intentionally unchanged. Device passes prepared pixels to createBackplateFinishMaps, whose original canvas, text, vector engraving, dimensions and sampler remain intact. Wheel labels also retain their original browser font context. This is not a worker-font parity claim. A later renderer host must transport the finished raster as exact ImageBitmap/texture metadata, or independently prove OffscreenCanvas font parity; it must not invoke the document-backed factories in a worker. Dense numeric fields no longer depend on DOM raster work.

## Scheduling and recovery

One global producer serves at most one active and three queued form recipes. Waiting recipes hold numeric inputs only, not geometry or pixel buffers. Identical reads share one promise/result. An execution deadline starts only after dispatch. Timeout/error/messageerror terminates that producer before exact cooperative recovery; worker identity and monotonic request id reject stale replies. Recovery shares the producer slot, so this subsystem cannot start parallel fallback builds.

Unused completed assemblies are limited by count (four) and 64 MiB, with a 30-second unused timeout; live owners retain the resources they require. Last-owner cleanup defers eviction one turn for StrictMode reacquisition. Discarded precommit Suspense reads have no React owner/cancellation callback: admitted work completes under the bounded queue and expires if never acquired. This limitation is explicit rather than claiming cancellation that React does not provide. Other subsystems' fallback pools remain a broader scheduler follow-on; this implementation does not claim a global page CPU budget.

The old timeout callback running the entire original shell constructor is removed. Dense aperture projection/removal, hardware cuts, crown tessellation, exact indexing, creased normals and texel loops now yield. Rear shell and hardware construction expose stages; translation uses Three's own attribute operations over bounded ranges. The Three 0.185.1 creased-normal algorithm is specialized to the actual non-indexed Float32 input with identical operation/bucket order and retained MIT notice. Sync utility APIs drain the same steps; the worker drains them off main, recovery uses the existing 4 ms cooperative runner.

The 4 ms runner is a soft scheduling budget, not native-operation preemption. Final retained local Bun observation: 277,162 steps, maximum 8.22 ms, three steps above 4 ms, 62 timer heartbeats during recovery. Native Three extrusion, typed-array allocations and bounding operations can still exceed the budget. This is a measured fallback residual and is not a claim of smooth 6× browser recovery. Earlier 107 ms aperture and ~28 ms full translation steps were eliminated through interior yields and exact chunking. Browser/6× and context-loss checks belong to lead acceptance.

## Verification

Retained evidence lives in `evidence/gpu-worker/preparation/`:

- `parity.ts` / `parity.json`: compares the permanently pinned pre-CPU-006 commit 1e11d02b4b0a74f3e03a34d9c19aaf931fb77ec2 in an isolated temporary source tree against final output. All 57 geometry attribute/index/group/bounds records match (the eight insert recipes are independently extracted from the pinned original Device memo bodies); all five numeric maps and sampler fields match; original backplate numeric loop matches. Original DOM glyph raster is retained, not emulated. Cooperative output matches. Prepared transfer payload is 23,148,696 bytes, without reducing geometry/resolution. Timing is local unthrottled Bun only.
- `fiber-disposal.ts` / `fiber-disposal.json`: executes the installed Fiber removeChild/disposeOnIdle functions verbatim with real Three geometry/materials. Both declarative materials dispose on their own unmount, shared geometry survives both, and final explicit cache disposal releases geometry. Independent review caught that new mesh dispose={null} would propagate to material children; all newly introduced flags were removed.
- `lifecycle.ts` / `lifecycle.json`: actual cache/hook with deterministic commit callbacks and Worker transport, real recovery/disposal timers. Twelve checks cover shared promise/producer, complete two-device identity, first/final unmount, StrictMode reuse, retired worker rejection, worker failure termination, exact recovery and bounded multi-form admission.

Commands:

```sh
bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/preparation/parity.ts
bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/preparation/lifecycle.ts
bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/preparation/fiber-disposal.ts
bun test packages/device/src/{curved-shell,product-shell,hardware-geometry,screen-aperture,textures}.test.ts
bunx tsc --noEmit -p packages/device/tsconfig.json
bunx --bun eslint packages/device/src/{Device.tsx,DeviceHardware.tsx,AxialSelectControl.tsx,device-preparation-data.ts,device-insert-geometry.ts,geometry-preparation-steps.ts,creased-normal-steps.ts,immutable-shell-preparation.ts,immutable-shell-worker.ts,immutable-shells.ts,immutable-geometry-index.ts,curved-shell.ts,hardware-apertures.ts,hardware-geometry.ts,product-shell.ts,textures.ts,backplate-finish.ts,screen-aperture.ts,screen-aperture.test.ts} docs/workstreams/023-mobile-tactility/evidence/gpu-worker/preparation/*.ts
```

Existing affected tests: 31 pass, 155,038 assertions. Scoped source/evidence lint passes. Final device typecheck passes after the concurrent renderer service type fix. Lead owns full repository type/lint/build and existing-Chrome cold entry, handling, context-loss and 6× checks. No new unit tests were introduced; the existing source assertion follows the relocated factory and retains its geometry/reveal checks.

Preparation is substantive progress, not completion of the architecture goal. Renderer/screen transport, packed collision and transactional sticker work remain separate dispatched or proposed lanes.

Live readiness remains unresolved: the supervisor reports an authenticated background-only scene after reload, without warm metadata. A separate real Bun module-worker smoke returned the full current protocol successfully (~398 ms locally); this does not explain or clear the browser gate. No browser acceptance is claimed.

Supervisor foreground-browser follow-up: the temporary cache diagnostic reported no active worker/deadline/queue and one ready assembly with one owner, 23,148,696 bytes, no error. The native Music panel was visible after bringing the existing Chrome tab to front. Entry age is not preparation duration and does not establish the cause or duration of the earlier background-only state. Temporary diagnostic export and metadata were removed; lead retains cold/live acceptance ownership.

Reproducibility check before commit: `parity.ts` now archives the complete device source tree from the explicit baseline SHA, rather than copying current helpers or resolving HEAD. The original insert bodies also come from that SHA; their reference imports are explicit, independent of the new factory. The pinned-baseline rerun passes all 57 geometry records, textures/samplers, backplate pixels and cooperative parity; scoped evidence lint passes. Its local step observation (8.22 ms maximum) replaces earlier run timing in the retained JSON. Application source stayed frozen; temporary diagnostics remain absent.

Combined-suite follow-up: adapted the existing physical-continuity source assertion from `cutHardwareApertures(shell)` to the actual `yield* cutHardwareAperturesSteps(shell)` call. It still requires solid aperture cutting, extrusion, named hardware and no view-dependent lighting proxy; the other sixteen assertions remain unchanged. `bun test packages/device/src/physical-continuity.test.ts`: 1 pass, 17 assertions. Scoped lint passes. No application changes or new tests.
