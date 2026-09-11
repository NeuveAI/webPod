# Production CPU attribution after projection sample reuse

Source `e940356727aed912b269ae4b5a5702a13e28ee33`. Read-only attribution of lead's stopped6.462274sec `evidence/gpu-worker/pack-flip/production-cache-main.cpuprofile`; no new browser interaction, recording, build or app edit.

Evidence hashes: profile SHA256 `8b5f4f0c17f6ba98aa58b57e6af7c5ee0e7261c27d7ecd29f5e0575b4134c5a3`; loaded `src-DNzIxBUm.js` SHA256 `7a179c815dcf1fa5e9f070a3c4dcd7a01eaca3268bc49cd5a4f051eb18000327`; `index-ZO9oaSeJ.js` SHA256 `30de8b1748a6e060fe045b2c08cc39836b389f28fabc103ec36f52635051636d`. Built function bodies at the CPU profile's zero-based line/column were matched to current source; no source maps used.

## Main finding: repeated panel box measurement inside pose adoption

Profile node779 `get offsetWidth` accounts for125.021ms sampled self time. Its immediate parent is node296 `M`, built `src-DNzIxBUm.js` zero-based4455:149918, exactly `adoptPose` in `packages/composite/src/device-render-host.ts:71–84`. The decisive built/source expression is `elementWidth: panel.offsetWidth, elementHeight: panel.offsetHeight` at source78. It occurs on every accepted projection/checkpoint/settlement; projection writes `panel.style.transform` immediately afterward. No other `offsetWidth` callsite accumulated these samples.

This is synchronous layout-dependent measurement; its125ms cannot be attributed to plain numeric projection math. The CPU profile alone does not expose Layout/RecalculateStyle events or prove which earlier write dirtied layout, so it is evidence of costly synchronous box access, not a complete forced-layout trace.85 samples are not85 invocations.

The host itself assigns explicit panel dimensions in `device-render-host.ts:169` and `fitPanelContentToFrame` (`html-in-canvas.ts:417–425`), based on fixed DEVICE_LAYOUT screen dimensions. A prospective narrow followup can measure the exact panel border box once after setup, then refresh only when its dimensions change (with authoritative ResizeObserver invalidation and teardown); projection would reuse that value for pure pose updates. Do not substitute fractional authored CSS dimensions without checking offsetWidth's rounded border-box semantics, borders/padding, content fitting and resize behavior. No implementation is proposed until lead decides from the post-query profile. The125ms is sufficient to retain this as a real independent hotspot.

## Worker response handler is inclusive, not500ms of messaging alone

Node181 `N2.a.onmessage`, built zero-based4455:151959, maps directly to `device-render-host.ts:113`. It contributes51.388ms self and500.840ms inclusive. Its principal children:

| Child | Inclusive ms | Exact source |
|---|---:|---|
| adoptPose |314.349|device-render-host.ts:71|
| pack.receive |72.019|native-pack-controller.ts receive handler|
| send |29.019|device-render-host.ts:60; includes postMessage16.499ms|
| motion authority listener |25.646|listener notification after accepted response|
| paint acknowledge |3.189|native screen transport acknowledgement|

Inside adoptPose, query.applyPose is64.830ms (`packages/device/src/device-query-view.ts:94`), offsetWidth125.021ms, carry.project60.274ms (`native-carry-controller.ts:55`, request), stickers.project19.564ms (`native-sticker-controller.ts:32`, synchronizeProjection), panel projection math9.373ms, and adoptPose's own sampled work35.287ms. These are nested totals: never add314ms or125ms again to500ms.

The accepted pose synchronizes query matrices, DOM panel projection, sticker projection notification and carry requests. Reliable terminal samples share that route intentionally. Batching cannot simply drop them: command settlement and current interaction geometry must remain correct. The current native carry request already compares a semantic requestKey after updating visibility/input. Whether redundant pre-key preparation warrants another fix should be measured after query offloading.

## Canvas rect reads in sticker controls

The18.048ms highlighted node1022 `getBoundingClientRect` belongs to `sticker-projection.ts:screen` (built zero-based4419:302302), called by `apps/web/src/sticker-collection.tsx:539–540` while mapping placed stickers to accessible edit buttons. Another screen-call node996 contributes2.216ms, contour node3052.147ms, and native pointer ray preparation node1433.177ms. Combined rect-getter self time is25.588ms across these distinct callsites; the18ms is only one path.

StickerCollection subscribes to `stickerProjectionVersionAtom` at line96. Native synchronizeProjection invokes `onProjectionReady` (`native-sticker-controller.ts:36`), which notifies the existing projection notification owner (`production-device-view.ts:27–29`); controls then recompute screen positions. The source `screen` method reads the canvas rect once for a successful projected quad; if that quad returns null, its fallback reads the same rect again (`sticker-projection.ts:148,153`). Multiple placements also repeat the same canvas rect measurement within one collection render. This is concrete duplicate work, although this profile has no exact invocation count or layout-event stack proving each getter forced layout.

A minimal local followup could retain one rect inside a single screen call (reuse for fallback) and share a fresh rect across one explicit projection batch. Do not introduce a geometry-only or long-lived rect cache: scrolling, viewport offsets, CSS movement and resize can change it without a sticker pose change. Existing live pointer/drop paths must keep current bounds. Review planned contour-query work first because its viewport snapshot may already remove part of this duplication; prioritize from the subsequent clean-production profile.

## Priority and limits

The contour-worker design remains the primary active slice. Panel box reads are the strongest separate measured candidate; repeated canvas rect reads are smaller and source-proven duplication. Query.applyPose/carry work is real but not yet sufficiently isolated to authorize a new architectural change. No render-quality reduction, new timing policy, GPU FPS claim or whole-feature completion follows from these sampled CPU numbers.
