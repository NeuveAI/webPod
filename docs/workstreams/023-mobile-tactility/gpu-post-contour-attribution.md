# Production main-thread attribution after contour offloading

**The former full contour sweep is absent from this main-thread profile; panel box measurement remains the strongest clearly isolated follow-up.** Read-only analysis of the lead's explicitly stopped/disabled production editor → dismissal/hidden-repeat profile on `be77986ce45eceeb562e9e419cfe4b052a4536b4`. No application, browser, server, or build changes were made for this analysis.

The [profile](evidence/gpu-worker/pack-flip/post-contour-main.cpuprofile) spans **5,746.907 ms**, with 3,808 samples and 5,745.517 ms of summed sample deltas. Each delta was charged to its corresponding sampled node; inclusive time propagates to ancestors. [Sanitized attribution data](evidence/gpu-worker/pack-flip/post-contour-attribution.json) retains selected first-party nodes and hashes. Built positions below are zero-based and were matched by actual function bodies, not minified names alone or assumed source maps.

| Artifact | SHA-256 |
|---|---|
| post-contour-main.cpuprofile | `58897172764c13f1889c8640b46786f1fb13d56d8c0874d73e7689bc22dfe9f3` |
| src-DJ7nZMNT.js | `ed5bb8fb1b7f29a16477be99d34cdd6be84fcf8ffa24da7ffbc518e03601001e` |
| index-CzDfb-RC.js | `78892dc805d87fefc0211d7a44296a6fe277fc0de5b44a6ee5b637550bffe83e` |

## Panel measurement persists

Node 718, `get offsetWidth`, has **132.551 ms sampled self time** across 91 samples. Its sole parent is node 233, `M`, at `src-DJ7nZMNT.js:4455:150039`, whose exact body matches `device-render-host.ts:71–84`, `adoptPose`. The expression at source line 78 reads `panel.offsetWidth` and `panel.offsetHeight` before projecting and conditionally assigning the CSS transform. No separate `offsetHeight` sample appeared; this does not prove the getter was never called.

The previous [post-cache attribution](gpu-production-post-cache-attribution.md) measured **125.021 ms** in the same width-getter path over 6,462.274 ms. The cost persists after contour offloading and is sufficient to prioritize the already scoped [exact panel measurement cache](gpu-panel-measurement-scope.md). These are different recording spans and sampled workloads; neither the absolute difference nor a normalized ratio is a matched speedup/regression result. Samples are not invocation counts.

This is a layout-dependent synchronous getter. The CPU profile does not include Layout/RecalculateStyle events and cannot identify which preceding mutation dirtied layout or separate every internal cost of the getter. It supports removing repeated box measurements from pure pose updates, not an unsupported claim that every call forced a full layout. Preserve exact integer border-box dimensions, real resize/hidden/replacement invalidation, and reliable terminal pose adoption.

## Contour chain removed from these main samples

Recomputing the earlier profile's sample tree gives **411.113 ms inclusive** under the old `contour` nodes 303/304, including `visible` at 389.812 ms and `castSegment` at 383.256 ms (120.985 ms self). These are nested costs, not quantities to add.

The new profile contains no `contour`, `visible`, or `castSegment` frames. Exact current bundle inspection also identifies the retained synchronous prepared kernel `VG` at `4360:81237` and packed collider `CY` at `4419:280614`; neither has sampled frames, nor do the kernel/collider body ranges. Thus the formerly dominant full contour → visibility → packed segment traversal is absent from this captured main-thread tree.

The new captured contour path instead maps to `sticker-projection.ts:98–125`: it selects adopted prepared metadata, captures matrices/rectangle, and calls the query owner. Two sampled instances of that capture have **11.985 ms and 1.194 ms inclusive**, mostly rectangle reads (10.257 ms and 1.194 ms respectively). The owner request beneath the first contributes 1.728 ms. This agrees with the source's dedicated worker sweep boundary. Sampling absence does not establish universal non-execution, and this main profile does not measure worker sweep duration, sample age, or visual alignment. A few ordinary raycast frames remain for other input paths; those are not the former dense contour sweep.

## Remaining nested host work

The worker response handler, node 223 at `4455:152080`, matches the host's `onmessage`. It is **50.575 ms self / 567.169 ms inclusive**, not 567 ms of message delivery alone. Its `adoptPose` child is **54.343 ms self / 370.810 ms inclusive**:

| Child of adoptPose | Inclusive ms |
|---|---:|
| panel offsetWidth |132.551|
| query.applyPose |100.046|
| carry.project/request |53.070|
| stickers.project |20.495|
| panel matrix projection |6.632|

These values are already inside `adoptPose` and the response handler. Do not sum them again with their parents. The handler's separate pack-receive subtree is 91.715 ms inclusive. This capture does not justify removing current query synchronization or dropping reliable terminal samples.

Canvas rectangle reads total **30.732 ms sampled self**: 19.281 ms in `sticker-projection.screen` (accessible placed-sticker positioning) and 11.451 ms in the two contour capture instances. The screen path remains a smaller separate measurement opportunity; it is not the panel-width getter and requires its own movement/scroll semantics. Prioritize the proven panel measurement scope without expanding into another state or rendering architecture.
