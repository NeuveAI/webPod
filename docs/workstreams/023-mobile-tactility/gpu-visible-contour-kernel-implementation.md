# Visible contour Phase A: exact kernel and protocol

Source frozen for independent review. Scope is Phase A of `gpu-visible-contour-dispatch.md`; no worker/UI activation, browser operations, builds or commits. Existing scalar prototype remains evidence-only.

## Exact API

- `captureStickerQuadSamples(geometry: BufferGeometry): Float64Array | null` in sticker-transform-projection captures nine xyz triples in corner/edge/center order. The e940 localSampleIndices implementation is unchanged. Validated prepared geometry reuses UV indices; public geometry rescans. Positions are always read live. The returned 216-byte array is caller-owned, never a borrowed mounted buffer.
- `projectStickerQuadSamples(samples: Float64Array, projection: StickerContourProjection): StickerProjectedQuad | null` performs the same world/camera projection, clipping, area and canvas admission. It rejects arrays other than exactly 27 scalars.
- `projectPreparedStickerContour(value: PreparedStickerContour, projection: StickerContourProjection, center: StickerScreenPoint, visible?: StickerContourVisibility): StickerProjectedContour | null` is the unchanged prepared path math extracted from its scene wrapper. Caller supplies center from the same admitted quad. It borrows Float64 arrays and a synchronous visibility callback; it does not read DOM, mesh, material or live camera objects.
- `StickerContourProjection` consists of canonical RenderMatrix world/cameraInverse/cameraProjection tuples and canvas rectangle. Existing synchronous callers delegate these functions after updating mesh/camera transforms.

`sticker-contour-query-data.ts` defines typed, data-only install/query/result/credit/release/dispose messages. It imports existing PreparedStickerContour, StickerCollisionSnapshot, RenderPose stamps and StickerProjectedContour instead of duplicating their schemas. Separate generation-scoped collider/print IDs identify leases. A query carries editor lineage, exact pose/revisions, coherent matrices and submitted time; a result echoes its stamp plus start/end time. Result publication is explicitly not input authority. Private print install receives the existing transaction delivery port/resourceId. Runtime validation, queue management and ownership implementation belong to Phase C; types alone do not enforce those limits. Result shape uses the canonical StickerProjectedContour type, so Phase C must account/limit its point/path cardinality before allocation and transport.

## Preserved invariants

No collision traversal, numerical epsilon, visibility test, contour simplification, path ordering, holes, anchor visibility or clipping changes. Matrix tuples are copied without changing precision or multiplication order. Existing prepared and defensive projection paths remain available; no new fallback is introduced. Existing UV cache behavior and live position reads remain. New local sample allocation is fixed-size; no dense per-pose copy is introduced.

## Verification

- `bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/visible-contour/kernel/check.ts`: passes 224 exact contour cases (144 non-null, 80 null), 248 quad comparisons and 669,608 identical visibility callback samples/order. Uses exact PW-A01/PW-A02 PNG alpha, production wrapped geometry/contour preparation, wear 0/0.4, widths 0.2/0.65, seven orientations, full/partial/split/hidden visibility, invalid canvas and near/behind/far camera cases. Structured-clone replay through the plain-data kernel equals the archived baseline. Live unversioned position deformation still changes captured positions. This is source-built prepared geometry, not a live browser capture.
- `bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/projection-cache/check.ts`: passes all 36 comparisons, 188,180 initial UV scalar reads, zero UV reads over twenty warm poses, nine live position samples per pose.
- Device and web typechecks pass.
- Scoped ESLint passes for all three application files and kernel proof; diff check passes.

Archived pre-extraction source is retained in kernel/baseline-contour.txt and baseline-transform.txt. The proof loads those modules against canonical current preparation metadata, with the archived quad implementation, and compares complete output plus callback order. No timing or worker-lifecycle claim is made in this phase.

## Frozen source

- `packages/device/src/sticker-contour.ts`: `7a4527c5e74011600b16f48fd226d382071ecc314bbbdae4a7549d6bc6e3e75f`
- `packages/device/src/sticker-transform-projection.ts`: `4af102ee362c9634916198828fca0fb44fbd495d091a8bfe25322ddd1e30845b`
- `packages/device/src/sticker-contour-query-data.ts`: `3392c8b7b85b46de5c1c0227960f3239cd6b96f916e9ddf3a787ba4a0befde85`

Exact machine-readable manifest: evidence/gpu-worker/visible-contour/kernel/manifest.json. Independent review and Phases B/C remain separate gates. End-to-end contour sample age and removal of main full sweeps require the later production validation; this extraction alone does not complete the feature.
