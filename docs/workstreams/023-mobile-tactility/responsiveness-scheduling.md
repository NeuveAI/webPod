# Responsiveness scheduling diary

Ready for peer review. Read responsiveness-scope.md in full before implementation. Owned panel + composite HTML raster scheduling, with supervisor-authorized narrow provider/library publication extension. No commits or deploy. Preserved prior mobile, haptic, update and other lanes' work.

## Changes and rationale

Browser/main/nested lists now slice the authoritative visible window before mapping row-content objects/React chevrons. The queue does likewise with absolute indices. ListViewport accepts optional rowsStart/full totalRows, so existing callers retain whole-list semantics and prepared-window callers preserve selected DOM IDs, count and scroll-rail geometry. Work preparing these view models scales with visible capacity rather than the full library/queue. No row rendering, text, styling, marquee timing or state-owned windowing contract changed. This is a structural reduction, not a measured frame-time claim.

HtmlInCanvasPixelSource now shares one scheduled RAF across mutation, content resize and DPR observer bursts. First attachment still fits and requests paint synchronously, then retains the existing single startup followup (now coalesced with observers). A fit reads width/height once; ResizeObserver/DPR no longer fit before requesting a second fit. Received canvas paint directly binds the first material, marks texture dirty and invalidates the screen in that same callback; it does not wait for the scheduled request flush or remeasure dimensions. Observer-origin updates can wait until the next pre-paint RAF; direct controls/media commands are never queued there. Texture invalidation on request was removed: actual delivered paint owns the changed pixels, avoiding a pre-paint stale upload/render. CSS animation appearance and delivered-frame cadence are unchanged.

Pending observer work is represented by one dirty flag/frame handle. Hidden visibility cancels the pending handle and retains dirty state; foreground schedules once; detach cancels the handle and removes visibility listener, observers and original transform/pixel-ratio listeners. No idle RAF loop was added. Existing generation guards protect detached attachments. Geometry size changes still drive a fresh fit via ResizeObserver/mutations/DPR. The bounded experiment verifies this, including width272→340 yielding raster width400.

## Playback audit and authorized extension

Read current Apple provider/manager command and progress paths. queueCatalogIds is used at queue/preparation/command edges, not per playback progress tick. manager.ts already indexes occurrence counts and explicitly handles progress in O(1). Memoizing mutable SDK queue arrays without a reliable mutation version would risk stale occurrence/authorization behavior, so no queue cache or media-command deferral was introduced. Composite direct transport invocation and provider SDK activation order remain unchanged. Panel progress/playback subscription behavior was left intact; deduplicating outward events could break nonvisual semantic observers without a stronger measured contract.

Found one guaranteed duplicate publication: Apple relationship onPage publishes a copied cumulative snapshot, then completion returns another array identity containing the same final entities; library albumsForArtist accepted that completion again and notified subscribers. The provider now returns the exact last published immutable snapshot when onPage is present; library skips identical already-accepted snapshots after checking current lifetime/abort. Intermediate pages, callback order, cancellation and all data remain unchanged. This does not eliminate necessary cumulative progressive snapshots or assume every provider emits append-only prefixes. Supervisor explicitly authorized these two files as playback-publication scope.

## Sources and checks

Grounded behavior in existing local sources and installed Three0.185.1 HTMLTexture.js/WebGLTextures.js/InteractionManager.js; the native paint callback and texElementImage2D upload lifecycle informed the separation of requested and delivered pixels. Jotai/react contracts and existing panel/store window semantics remain canonical. Skills global-patterns, modern-web-guidance and Jotai/router guidance were already read in this session; no new dependency/API introduced.

- panel, composite, providers, music-management package typechecks: pass.
- Scoped eslint across five changed source files and retained experiment: pass.
- Existing panel/composite/provider-Apple/music-management suites:380 pass,0 fail,1684 assertions across29 files; evidence/scheduling/tests.txt.
- Retained bounded production-source experiment: evidence/scheduling/lcd-batching.ts and lcd-batching.json. Three mock-renderer + DOM observer test proves synchronous attach, observer burst1 frame/1 request/2 dimension reads, delivered paint0 dimension reads/immediate invalidation, resize correctness, hidden resumption and detach cancellation. This is an experiment, not a new unit-test suite or GPU benchmark.
- Production build and combined integration/browser validation are coordinated by supervisor to avoid concurrent writes to shared dist.

## Limitations and future history

No measured latency improvement is claimed. Browser LCD visual/input verification and real phone assessment remain distinct from source/mock timing. Continuous marquee paint, native HTMLTexture upload, DOM/SDK access and rendering remain on the main thread; this lane does not reduce visual quality or remove marquee behavior. Suggested future commit: `Bound list preparation and coalesce LCD repaint work`, with optional separate `Avoid duplicate final relationship publication`.

## Collision recovery extension

Supervisor reassigned sticker-collision-preparation.ts plus new sticker-collision-cooperative.ts to this engineer after independent review identified permanent sticker feature loss when Worker fails. This authorship is outside my independent paper/visibility review: picking engineer must review this collision correction.

Normal path still constructs the same worker. Startup/runtime/message-transfer/15-second timeout failure terminates it, then schedules exact main-thread cooperative snapshot construction after a timer turn. Abort rejects without fallback. The helper follows current collision coordinate transforms, metadata and stable median BVH partitions, using bounded generator passes and stable merge-sort stages instead of an uninterruptible native sort. yieldSteps provides the shared 4ms scheduling budget; yield opportunities occur every128 work units. All rendering arrays remain borrowed/read-only; only newly allocated snapshot arrays are returned. Visibility still verifies assembly revision before installation, so changed source assemblies cannot accept mixed/superseded work.

Retained experiment evidence/scheduling/collision-fallback.ts+json compares entire snapshots (coordinates, provenance, metadata, node tree and count) against createStickerCollision on2,240 triangles/895 nodes, verifies empty input, initial/mid-build AbortSignal and Worker constructor failure recovery. Build allowed3 timer turns in the recorded run; no phone speed claim. Existing collision+visibility suites pass (see collision-tests.txt). Scoped source/experiment lint passes. Device tsc currently reports only worker's in-progress unused carry imports; integrated rerun pending.

Limitations: typed-array allocation and final collider restoration still run on the main thread; cooperation bounds iterative copying/partition work, not GC or allocation. No lower-resolution geometry or contact approximation was added. This is failure-only recovery; normal worker responsiveness remains the preferred path.

Final static follow-up: independent device and web typechecks now pass after integration, and scoped collision sources/experiment lint passes. Picking engineer independently approved collision recovery. Supervisor reports combined14-package typecheck, scoped lint and production build pass; those combined checks are supervisor evidence, not re-run claims by this author.
