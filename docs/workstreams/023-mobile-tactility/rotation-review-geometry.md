# Independent geometry review

Verdict: APPROVE after the shared wrap-sampler ownership correction.

Scope reviewed: immutable-geometry-index, immutable-shells/transfer/worker/preparation, the Device shell integration and shared sticker-wrap ownership. No geometry implementation authored by this reviewer.

The indexer compares all Float32 attribute words exactly, including signed zero/custom crownCap data, resolves hash collisions by full equality and preserves original triangle sequence. Existing indexed/morph/unsupported attribute layouts remain unchanged. It commits only when resulting storage is smaller. Indexing changes vertex indices by definition; production consumers depend on geometry-consistent face indices/UVs/normals rather than old nonindexed vertex identity. Groups, drawRange and bounds survive the worker transfer. This is lossless indexing, not lossy mesh compression.

Complete front/rear construction and indexing runs in one module worker with at most three pending forms. Same-form requests share one promise/pair; Suspense prevents Device publication before it exists. The constructor/timeout failure path schedules the original unindexed CPU construction on a later task. That fallback can still block for the original construction duration; it does not claim cooperative or GPU construction. Settled unused entries are limited to four and expire; last mounted owner releases the pair. All four rendered/picking shell meshes opt out of Fiber automatic disposal, leaving the cache as owner. Worker instance guards reject queued stale errors. Restored geometry adopts transferred buffers; source worker buffers detach.

Found and fixed: sharing back geometry also shares the WeakMap key used by bindStickerWrapSurface. The previous single-binding cleanup could erase the still-mounted first device's sampler when the second device unmounted, corrupting later carry-worker form snapshots. The final helper tracks live bindings and restores the previous live sampler. Cleanup is idempotent and deletes the weak entry after the final owner. The retained lifecycle proof now covers A→B→cleanupB→A→cleanupA→none.

Independent checks:

- Device typecheck and scoped geometry implementation lint passed.
- Re-ran worker-parity experiment: front169367/rear22166 triangles; exact expanded attributes, groups and bounds; real structuredClone transfer detaches buffers. This experiment executes the pure factory offline, not a measured browser worker latency.
- Re-ran840 same-ray comparisons across front/rear; no mismatches. Face a/b/c naturally refer to compact vertex indices, while point/distance/UV/normal/material/faceIndex semantics are preserved.
- Re-ran lifecycle experiment: shared promise/pair, one worker, idle termination, last-owner disposal, disposed-entry rebuild, stale error isolation and unsupported-worker CPU recovery pass; final shared-wrap ownership check also passes.

Final production source count supplied and checked against the shell-only implementation:21,939,808→7,354,520 attribute/index bytes,14,585,288 saved. This is CPU/source buffer accounting, not measured driver VRAM, network size or phone FPS. No new valid browser rotation trace is available from this lane, and no speedup claim is inferred from offline timing.
