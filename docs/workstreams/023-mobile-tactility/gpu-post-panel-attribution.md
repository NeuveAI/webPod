# Production main-thread attribution after panel measurement caching

**The targeted pose-adoption width-getter cost is absent from this profile.** No `offsetWidth` or `offsetHeight` frame appears anywhere in the stopped capture. Exact built-source inspection confirms pose adoption now projects using cached dimensions. This satisfies the narrow sampled-cost gate; it is not a whole-interface latency or fidelity approval.

Source: `dbe65c2a51187a81ef6623f9daf4bffbe47af3b7`. The lead confirmed the actual editor opened by touch at its projected center around (114,319), rear angle 148.84°, before the dismissal/hidden-repeat trajectory. Earlier fixed-coordinate setup misses are excluded and had no profiles started. Profiler was explicitly stopped and disabled. This review performed no browser, application, build, server, or test operations.

The [capture](evidence/gpu-worker/pack-flip/post-panel-main.cpuprofile) spans **5,694.252 ms**, with 3,816 samples and **5,693.392 ms** of paired sample deltas. Deltas are attributed to sampled leaf nodes; inclusive time propagates to their ancestors. [Sanitized selected-node metrics](evidence/gpu-worker/pack-flip/post-panel-attribution.json) retain the exact provenance and built zero-based positions.

| Artifact | SHA-256 |
|---|---|
| post-panel-main.cpuprofile | `35e44bac047d04576162b3977e82449684e16c5a06e3a1f0245d9f152ce7d276` |
| src-B7bliWAb.js | `74ead7cdee0461d873bf48ec9ff00303f37006d3c62737370eebb645ad83ba98` |
| index-DUN-SDO1.js | `e3dc5c0a0fbd7c1982e856d3567cbf7eb8f6ec0a9df374c8f9e66d8b7dc72a79` |

## Exact targeted path

Node 296, `ne`, at `src-B7bliWAb.js:4455:151456`, matches `device-render-host.ts:88–93` (`adoptPose`). Its child node 297, `te`, at `4455:150982`, matches `projectPanel` at source lines 75–86. The decisive built expression reads `v?.read()` and passes `t.width`/`t.height` into panel projection; source line 82 uses `dimensions.width`/`dimensions.height`. No live element dimension getter occurs in that pose path.

In the previous [post-contour profile](gpu-post-contour-attribution.md), this path contained **132.551 ms sampled self time** in `get offsetWidth`. Here that getter has **no sampled frames**, and neither does `offsetHeight`. This agrees with the source change rather than merely a renamed minified function. Sampling absence is not proof that dimension measurement never occurs during initialization or real invalidation outside this window; those reads remain necessary by design.

The cached projection function still costs **46.135 ms self / 54.066 ms inclusive** over the capture. Its body includes matrix extraction, projection, string construction/comparison and conditional CSS assignment. The profile does not isolate which of those dominates self time, and does not justify labelling that remainder as forced layout. The capture contains no Layout/RecalculateStyle event ledger.

## Remaining work, without double counting

The worker-response handler (node 283, `4455:153079`) is **24.012 ms self / 367.909 ms inclusive**. Its pose-adoption child is **3.565 ms self / 209.857 ms inclusive**. Inside that child:

| Child | Inclusive ms |
|---|---:|
| query.applyPose |74.880|
| carry.project/request |54.070|
| cached projectPanel |54.066|
| stickers.project |22.000|

All these values are nested in pose adoption and the response handler. Do not add them again to their parent totals. The handler's separate pack-receive subtree contributes 64.034 ms. A separate send subtree includes 34.498 ms self in `send` and 26.289 ms in its `postMessage` child (60.787 ms inclusive), not two additive totals beyond that inclusive value.

Canvas rectangle reads remain: **48.255 ms sampled self total**. `sticker-projection.screen` at built `4419:312761` contributes 32.489 ms in its getter, for accessible placed-sticker positioning. Three `refreshContour` instances at `4419:308159`, corresponding to the coherent capture at `sticker-projection.ts:109`, contribute 2.361 + 9.123 + 4.282 = **15.766 ms**. These are distinct canvas-rectangle consumers; they are not the removed panel-width path. They still need current viewport/scroll semantics, and this report does not authorize further caching.

The former main contour → visibility → packed segment traversal remains absent: no `contour`, `visible`, `castSegment`, or exact built prepared-kernel/collider (`VG`/`CY`) frames occur. Ordinary main query synchronization and input work remain intentionally present. This main-thread profile provides no worker-sweep timing or contour-result age measurement.

The earlier and current recordings have different setup positions and sample windows. No speedup ratio, statistical regression claim, INP value, or frame-rate conclusion is derived from their totals. The bounded conclusion is that the explicitly targeted repeated panel box-read hotspot disappeared while the previously removed full contour chain stayed off the sampled main path.
