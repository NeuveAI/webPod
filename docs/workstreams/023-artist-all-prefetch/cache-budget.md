# Metadata retention budget

The relationship LFU is an in-memory cache of JavaScript metadata objects, arrays, promises and continuation state. It is not Cache Storage, IndexedDB, media download storage, or a reservation of browser heap.

The chosen default is 64 MiB of estimated reusable relationship metadata per music source, divided into 48 MiB for tracks and 16 MiB for album lists. Each cache also has a 512-entry guard and five-minute idle TTL. This is a configurable engineering default, not a browser standard or a measured universal optimum. Library source configuration is owned by the main implementer.

Browser origin storage quota describes disk-managed storage; navigator.storage.estimate does not report a safe JavaScript heap allocation. Official browser guidance recommends profiling actual memory use on supported devices. A 1 GiB RAM default would require evidence from that profiling; no such evidence exists for this metadata cache.

- [MDN browser storage quota and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [MDN storage estimate](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate)
- [Chrome DevTools memory problems](https://developer.chrome.com/docs/devtools/memory-problems)

Implementation:

- BoundedAsyncCache optionally enforces maxBytes alongside entries. Existing artwork/intent callers without byte options preserve count-based behavior. Accounting is explicitly updated by the owning relationship state, guarded by value identity so stale completions cannot charge replacement entries.
- RelationshipState counts new page metadata at ingestion. Its structural estimate includes UTF-16 string lengths, keys, nested artwork/arrays, object/property/array-pointer allowances, continuation/key text and fixed bookkeeping allowance. The estimate is conservative by design but is not an exact engine heap measurement. Shared references across items or relationships can be counted more than once; cycles within one item are visited once.
- Identity-deduplicated artist album entries subtract the replaced item's estimate. Snapshot/failed/complete/render reads never serialize or traverse metadata. No per-render JSON encoding occurs.
- Low-priority speculation is evicted before foreground retention. Frequency and recency select victims within the same priority. Growing pinned speculation cannot evict foreground data to satisfy a budget.
- Active pagination pins its entry before awaiting initialization. Active accepted work may temporarily exceed the retention budget; it is not aborted to meet a byte limit. The final idempotent release restores the bound, dropping a single oversized result while still returning its completed array to the accepted caller. If pinned bytes alone exceed the budget, unrelated reusable values are preserved until release.
- loadResult returns request-local items/completion before release. A consumer must use this result when completion matters: cache presence after await cannot prove completeness because an oversized completed result may already be evicted. This fixes the review-discovered All flattening integration hazard without a separate retained registry.
- Expiry, eviction, replacement, clear and rejected-request retry remove charged bytes. Partial page failure retains the already charged prefix and its failure posture. Cancellation/clear cannot recharge a removed entry through an old state reference.

This budget excludes root library arrays, currently rendered screen rows, playback queues, adapter metadata identity maps, decoded artwork, audio, GPU allocations and other application ownership. Thus it limits reusable relationship retention, not total page memory. Continuous current-page loading and root-library ownership remain the main implementer's lane; no unbounded duplicate root cache is introduced here.

Files owned by this lane: packages/music-management/src/bounded-async-cache.ts, relationships.ts, cache-budget.test.ts. No new dependencies or persistent database.
