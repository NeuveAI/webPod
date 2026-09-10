# Production mobile performance diagnosis — 2026-09-10

The strongest measured input bottleneck is detailed mesh picking, including sticker arbitration before ordinary device event picking. Separately, animated LCD text repeatedly uploads its HTML texture and redraws the entire device. Fix these before broad state, worker, or memory changes.

## Capture and limits

- Production: https://webpod.vercel.app/webpod, build `530fe354-625e-4c47-bca0-b2b24afd24b8`; application asset `src-B2IO_406.js`.
- Chrome DevTools native Performance capture, 6× CPU slowdown, iPhone 16 Pro Max emulation (440×956). Completed mixed pointer/control/scroll recording; approximately 14.85 seconds of CPU samples. This was not a controlled wheel-only benchmark.
- Raw local trace: `/Users/vinicius/Downloads/Trace-20260910T222915.json.gz`. Sanitized summaries: [aggregate](evidence/performance/native-trace-summary.json), [symbols](evidence/performance/native-symbols.json), [input stacks](evidence/performance/native-input-symbols.json).
- An interrupted subsequent recording is excluded. Recording is stopped. No application changes or deployments were made for this diagnosis.
- Event dispatch durations measure handler execution, not complete input-to-presentation latency. CPU sample attribution is approximate; inclusive stacks overlap and must not be added together. CPU throttling does not reproduce a phone GPU, thermal limits, or Safari.
- Excluded the 477 ms maximum task: its stack is dominated by DevTools `CpuProfiler::StartProfiling`. The remaining four tasks above 50 ms total approximately 605 ms; maximum 246 ms.

## 1. High priority: expensive picking delays input admission

| Recorded event | Handler duration | Approximate mesh-raycast samples within handler |
| --- | ---: | ---: |
| Pointer down 1 | 108.2 ms | 96.4 ms |
| Pointer down 2 | 81.9 ms | 76.1 ms |
| Pointer down 3 | 80.5 ms | 67.8 ms |
| Pointer move | 44.1 ms | 37.7 ms |
| Later pointer releases | 41.4 ms each | 35.0–38.0 ms |

The sampled stack is Three `Mesh.raycast` → `_computeIntersections` → triangle intersection. It is not evidence that the custom sticker collision BVH is the dominant cost.

There are two picking routes on initial contact. [StickerCollection](../../../apps/web/src/sticker-collection.tsx#L436) captures pointerdown and asks for a sticker source before the normal Fiber event handler. [StickerPackScene.pick](../../../packages/device/src/StickerPackScene.tsx#L129) starts visibility preparation and raycasts body/back meshes before iterating placed stickers. The first recorded down includes approximately 58 ms under this custom grab route, as well as ordinary Fiber picking. Later events also pay detailed Fiber triangle picking.

Recommended first change: provide inexpensive input geometry or analytical picking for enclosure/control surfaces, keeping presentation geometry separate. Avoid sticker visibility/shell work when no eligible placed sticker can be grabbed. Preserve front/back occlusion, wrapped sticker ownership, transparent ink picking, and the larger touch perimeter. Confirm those behaviors before accepting any shortcut.

## 2. High priority: LCD motion causes recurring full-device rendering

The trace shows `wp-title-marquee` animation and rendering between sparse inputs. Across the capture, sampled `WebGLRenderer.render` time is approximately **901 ms inclusive**; native `texElementImage2D` is approximately **208 ms self time**. These are capture totals, not per-frame costs, and cannot all be attributed exclusively to marquee without an A/B run.

The source explains the recurring work:

1. [panel.css](../../../packages/panel/src/panel.css#L165) applies an infinite overflow animation to selected list labels and Now Playing titles.
2. Browser HTML-in-Canvas paints reach [html-in-canvas.ts](../../../packages/composite/src/html-in-canvas.ts#L189), which refits panel geometry, dirties its texture, and invalidates the scene.
3. Fiber demand rendering then calls the full Three scene renderer; the dirty HTML texture is uploaded using `texElementImage2D`.

This does not require per-frame React updates or MutationObserver callbacks. Fiber coalesces invalidation; this is repeated legitimate demand, not an unbounded frame queue.

Live canvas measurements were 440×888 CSS pixels and **1320×2664 drawing-buffer pixels (3.52 million)** at DPR 3. The LCD raster was **960×720 (0.69 million)**. These dimensions amplify rendering/upload work but do not establish a GPU bottleneck.

Recommended second change: let overflow text crawl after dwell, then rest; pause its motion while selection is changing and when the LCD is not visible. Reuse panel dimensions on paints that do not change geometry. Compare an identical stationary long-title interval with animation enabled/disabled before choosing a mobile raster-quality policy. Merely memoizing React will not stop this paint/upload/render chain.

## 3. Secondary candidates requiring targeted captures

- **List preparation:** [BrowserList and NestedTrackList](../../../packages/panel/src/Panel.tsx#L589) map all rows before ListViewport slices the visible window. Selection changes therefore prepare the whole collection even with bounded DOM. The first release has approximately 54 ms under React, but this trace does not isolate how much belongs to list mapping. Prepare only visible rows and compare the same large collection.
- **Sticker deformation:** [PeelingPrint](../../../packages/device/src/StickerPackScene.tsx#L356) builds temporary geometry and recomputes normals/bounds as interaction changes. Its 96-subdivision grid has 9,409 vertices, with additional conditional collision passes. No verified sticker peel occurred in this recording; profile peel, carry, and landing separately before claiming measured impact.
- **Sticker query preparation:** visibility queries traverse and fingerprint the scene even with a warm collider; changed geometry can trigger synchronous BVH construction. The observed Mesh triangle stack does not prove repeated BVH rebuilding.

## What the evidence does not support

- Steady wheel movement publishes local state; it does not await a server or worker response.
- Haptics are event-driven; the version checker runs once per visible minute. Neither is established as a source of continuous frames.
- Recorded Layout events total approximately 10 ms; MinorGC events approximately 35 ms. Neither dominates this capture. No heap-growth experiment was performed, so there is no demonstrated memory leak.
- Startup camera fitting and asset preparation should not be conflated with steady input work.

## Verification for the fixes

Repeat on the same production build conditions and collection: stationary short label, stationary overflowing label, sustained wheel motion, control taps, enclosure rotation, and sticker peel/carry/landing. Keep scenarios separate and exclude profiler startup. Compare handler duration distributions and input-to-presentation latency, then confirm improvements on a physical phone. Check that stationary non-animated browsing returns to demand-render idle and that overflow text remains readable. Validate control/sticker/edge ownership on both faces. Do not divide throttled timings by six or promise an unmeasured speedup.

Supporting reviews: [client](mobile-client.md), [graphics](mobile-graphics.md), [workers and providers](mobile-workers.md). Earlier static sections in those reports are hypotheses; this consolidated report reflects the completed trace attribution.
