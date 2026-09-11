# CPU030 existing-trace editor attribution

The existing export supports a concrete main-thread contour/visibility bottleneck. The356.10ms StickerAppearanceEditor span is real; it is predominantly inclusive exact query work, not356ms of component self-time or solely profiler overhead. No application source, browser state or recording was changed in this analysis.

## Reproducible input and method

Input: `/Users/vinicius/Downloads/Trace-20260912T000938.json.gz`. Metadata identifies11.863954seconds, CPU6×, iPhone16ProMax, recorded2026-09-11T22:09:38.161Z. Script and bounded JSON: `evidence/gpu-worker/pack-flip/analyze-editor-profile.py` and `editor-profile-analysis.json`. Run the script with Python and the existing trace path; it does not record anything.

Main Profile starts on pid62025/tid4853675 with ID0x1. Its922 ProfileChunks are emitted on profiler tid4867514: filtering chunks by main tid incorrectly finds no samples. Match by pid/profile ID. The reconstruction contains88,181samples and2,187nodes. This export includes2,728negative deltas, so the script sorts reconstructed sample timestamps and integrates each stack until the next sample; it excludes the391.98ms unsampled initial gap. Numbers below are weighted sampling estimates, not exact instrumentation totals. Inclusive ancestors overlap and must not be added.

## React span discrepancy resolved

Counting only `TimeStamp` finds18 editor spans, max0.801ms. React records changed-props renders differently:125 paired `blink.user_timing` async begin/end events named U+200B followed by StickerAppearanceEditor. Their sum is5,980.297ms, maximum374.6ms. The exact356.1ms example begins at276492828281µs;333.25ms within that interval has StickerAppearanceEditor on the sampled stack.

Installed `apps/web/node_modules/.vite/deps/react-dom_client.js:2214–2222` explains the split: logComponentRender uses performance.measure for changed props and console.timeStamp otherwise. The long measures identify `returnToPack` / `returnPlaced()` as a referentially unequal function closure. This is real parent fan-out evidence, but does not itself prove that callback instability invalidated the contour memo; its dependencies are contour callback, projectionVersion and selectedId.

## Sampled work

| Function/path | Approximate inclusive time |
| --- | ---: |
| StickerAppearanceEditor |5,646ms |
| production contour adapter |5,639ms |
| projectPreparedContour |5,485ms |
| visibility.visible |5,347ms |
| collider.castSegment |5,284ms |

Editor self-time is only2.7ms. Largest sampled self costs aggregated by function/source are Vector3.fromArray2,012ms, castSegment1,498ms, Ray.intersectBox364ms, Vector3.subVectors329ms, crossVectors244ms and intersectTriangle229ms. These are triangle/BVH traversal operations on the contour visibility path. The script preserves source URLs and transformed line numbers for disambiguation.

The hot stack is editor→useMemo→production contour→sticker-projection contour→projectedStickerContour→projectContourUncached→projectPreparedContour→project→visibility.visible→castSegment. This is the prepared contour branch: there is no sampled dense alpha-contour preparation fallback or chooseHudLayout hotspot. The latter absence is sampling evidence, not a proof of zero calls. Existing visibility.update checks its unchanged assembly key and reuses the collider; the profile does not support a collider-rebuild/cache-construction diagnosis. Expensive fromArray calls occur while reading triangle vertices during ray traversal.

Repeated main tasks around370–389ms contain roughly333–365ms of sampled editor work. Profiler startup and DEV instrumentation are also material: the lead measured1,889ms CpuProfiler::StartProfiling, while sampled run/createTask and GC costs exist. Nested runTask/AsyncTaskRun durations cannot be summed as extra overhead. These costs qualify production extrapolation but do not explain away5.3seconds of sampled visibility traversal.

## Narrow next step and uncertainty

The trace does not expose shownEditorAtom or HUD presence values. It proves an eligible contour query ran repeatedly, but cannot prove each expensive call happened at presence0. The current page lacking HUD controls after recording is not historical visibility evidence. Source audit establishes the avoidable boundary independently: the contour memo executes before the shown/presence guard and can query a retained editor after complete dismissal. Guarding only fully hidden projection while preserving positive-presence exit animation and re-entry remains the smallest supported candidate for controlled verification. Do not remove visible contour accuracy or the exit animation.

If visible HUD still accounts for stalls after that guard, profile the remaining exact query cadence before changing layout or collision algorithms. The trace supports prioritizing contour invocation/visibility cost over chooseHudLayout, new geometry preparation, broad worker rewrites or memory-cap changes. A bounded hidden/visible/re-entry call-count proof and a matched user transition are needed to quantify the guard's benefit; no performance improvement is claimed yet.
