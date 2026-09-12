# Mobile workers, provider and server seam

Read-only V1 committee diagnosis. Target: production mobile 440×956, native DevTools 6× CPU trace supplied by supervisor. No implementation, build, deployment or browser instrumentation performed. Runtime-review checklist and fundamentals read; engine-specific retention claims are not used as proof of this trace's bottleneck.

## Evidence and main conclusion

The recorded pointer stalls implicate synchronous mesh raycasting ahead of wheel admission, not server latency or worker serialization. Three pointerdown dispatches lasted 108.196, 81.939 and 80.525ms in the throttled trace. Approximate inclusive mesh-raycast samples inside those windows were 96.416, 76.091 and 67.762ms. A 44.112ms pointermove contained about 37.660ms of mesh raycasting. Later pointerup dispatches of 41.438/41.382ms contained about 37.959/35.021ms of raycasting. The first pointerup also contains about 54.118ms beneath React-minified index symbols and 36.029ms raycast; this is a separate client lane for peer mapping.

Only two pointermove events exist in this recording. Do not claim it represents an extended, high-frequency wheel sweep. Idle fraction is not a responsiveness metric. Five raw RunTask events exceed 50ms, but the largest 477.33ms task contains 462.608ms CpuProfiler::StartProfiling and must be excluded from application-stall attribution. The remaining four total about 604.83ms. CPU sampled times are approximate under 6× throttling and interval overlap/jitter can differ from dispatch durations by under a millisecond; no conversion to real-phone timings is justified.

Sanitized evidence: `evidence/performance/native-trace-summary.json`, `native-symbols.json`, `native-input-symbols.json`. Symbols retain only asset basenames and one-based line/column, never raw network URLs or trace arguments. Overall native `texElementImage2D` self samples are about 208ms, but texture upload/render ancestors are absent from the selected input-dispatch windows; RAF/render work is a separate lane.

## Ranked paths

### HIGH: sticker capture performs shell triangle raycasts before ordinary front-wheel input

`apps/web/src/sticker-collection.tsx:436` installs document capture pointerdown. For canvas targets it calls `pickStickerSource` at line440. `apps/web/src/sticker-grab.ts:23` invokes the geometry grab whenever present, including front view. `packages/device/src/StickerPackScene.tsx:129` starts visibility work before checking equipped prints, and lines136–141 raycast both body and steel-back meshes to determine whether a perimeter should yield to shell rotation. Only afterwards do lines149–154 iterate actual placed stickers.

This makes a wheel contact pay sticker arbitration plus the subsequent R3F raycast. First pointerdown has approximately58.228ms below `index-DlDF9dMF.js` grab40:33442 / fb12:213327 / n40:16670 and `src-B2IO_406.js` grab4201:322587 / a4201:321572. The same window also includes the ordinary event-manager raycast chain. Exact minified-to-source mapping is pending committee cross-check, but the named grab stack plus source ordering is strong attribution evidence.

Suggested bounded experiment: reject the no-placed-stickers case before visibility/shell raycasts; preserve wrapped-sticker visibility and perimeter priority where placements exist. More broadly, separate cheap enclosure input picking from presentation mesh triangle density. Verify wheel, Select, glass, wrapped sticker and edge ownership before accepting a fix. Do not delete the visibility rule merely for speed.

### MEDIUM: cached collision queries still inspect the full scene; cold queries synchronously rebuild

`packages/device/src/sticker-visibility.ts:25` updates descendant world matrices, traverses all visible non-sticker meshes, composes matrices and joins geometry/material/transform identity strings on every inspect. `update` at line70 repeats this on each query, even when the BVH stays valid. On key mismatch it aborts pending worker preparation and runs `createStickerCollision(faces)` synchronously at line75. `packages/device/src/sticker-collision.ts:61` copies triangle coordinates, then lines95–110 recursively sort/slice triangle IDs into a BVH.

Warm construction exists (`StickerPackScene.tsx:76`, `sticker-visibility.ts:51`) and pose-only motion does not change the authored-local fingerprint. Thus repeated BVH rebuild on every rotation is **not established**. The trace's dominant triangle stack is Mesh.raycast, not proven BVH construction. Keep this as a cold-input/identity-change hypothesis, not the confirmed main bottleneck. Future trace should distinguish inspect from build and compare already-prepared input.

### MEDIUM: sticker peel remains main-thread geometry work despite worker preparation

`packages/device/src/StickerPackScene.tsx:356` runs synchronous layout-effect geometry rebuilding for peel/drag/landing/orientation changes. Lines360,369,389 create temporary peel/free-carry geometry; line384 constrains exterior contacts; lines472–473 recompute normals/bounds and dispose temporaries. This work is not moved to the collision worker. It is a concrete allocation/computation candidate for actual sticker dragging, but the supplied recording has no verified sticker peel, so no measured peel claim is made.

Warm asset work also includes synchronous alpha extraction/texture upload at `StickerPackScene.tsx:518`, and cloned hierarchy/material compilation in `sticker-program-preparation.ts:76–95`. Completion polling is async; the initial compile call is synchronous. This is startup/asset-change work, not per-wheel detent. Existing cleanup aborts old compilation and disposes owned material references; no leak claim.

### LOW / contextual: worker boundary clone and inventory publication

`apps/web/src/sticker-local.ts:46` structured-clones plain requests; `sticker-worker.ts:40` returns plain inventory snapshots. Import sanitization maps at most2500 tracks on the main thread (`sticker-runtime.ts:96–98`). SQLite initialization, migration, repository queries and OPFS operations are inside the worker (`sticker-worker.ts:10–36`). They can delay sticker completion but do not synchronously block a wheel detent. Worker replies publish whole inventories (`sticker-runtime.ts:31`, `packages/state/src/stickers.ts:31–35`), so periodic reply-induced UI fanout can coincide with input, requiring trace correlation rather than assumed causation.

Collision preparation intentionally copies render attributes on the main thread (`sticker-collision-preparation.ts:12–20`) then transfers those copied buffers at line38; worker output transfers typed coordinate/provenance arrays. This avoids structured-cloning those large buffers twice. There is still main-thread copy cost at preparation and object-tree restoration on receipt, but no evidence it recurs every wheel move.

## Falsifying server/network as steady wheel critical path

`packages/composite/src/click-wheel-runtime.ts:164–173` processes arc movement through local `store.set(detentActionAtom)` only. Coasting at lines107–123 similarly schedules local store work. It awaits neither fetch nor worker. Explicit play/pause/next/previous do route to provider transport (`apps/web/src/production-device-view.tsx:151`); opening a playlist/album can request relationships (`packages/music-management/src/library.ts:95–96`). Those interactions must not be conflated with steady list-wheel movement.

Library background pagination appends a page and synchronously notifies source subscribers (`library.ts:128–135`), but completion drains collections serially and yields between pages. Main-thread ingestion can overlap a gesture while loading; an already-loaded list still has no mandatory network dependency per detent.

Apple progress checks default to250ms (`packages/providers/src/apple/apple-provider.ts:376–393`). The listener reads local SDK playback state, not an application HTTP request. Listening credit is throttled to10s and at most3 pending observations (`sticker-runtime.ts:259–278`); only missing enrichment can call the metadata endpoint (`sticker-runtime.ts:287–296`). Imports are one-at-a-time and every15 visible minutes, not each wheel tick (`sticker-runtime.ts:104–139`). These cadences falsify a theory that server metadata requests are inherently blocking every wheel event.

## Lifecycle checklist calibration

- Local worker pending map capped32, each request has60s deadline, disposal terminates worker/rejects requests/clears timers (`sticker-local.ts:24–46`). No unbounded per-input pending growth found.
- Collision worker terminates on success/error/abort/deadline (`sticker-collision-preparation.ts:27–39`); visibility owns one collider plus one pending preparation and uses WeakMap object identities. No scene-lifetime growth claim.
- Provider runtime removes subscriptions/timers, terminates local worker and clears query cache on stop (`sticker-runtime.ts:137–154`). Listening queue bounded3; imports deduplicated. No server daemon/fiber issue on the traced wheel lane.
- Library caches retain session data intentionally; knownTracks capped256 (`library.ts:76–84`). Full library arrays are collection-sized, not per-pointer accumulation. No generic memory rewrite justified by this trace.

Next action should target measured duplicate/high-density raycasting and re-record the same native interaction. Keep worker offloading and provider changes secondary unless their stacks appear in a dedicated sticker or loading trace.
