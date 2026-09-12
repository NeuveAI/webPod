# Exact scalar contour visibility experiment

Evidence-only prototype; production code, browser and worker protocol unchanged. The bounded Bun result supports a moderate scalar speedup, not a claim that visible contour queries now fit a Chrome frame.

## Result

The retained final run on Bun 1.4.0 evaluates identical 4,000-ray batches after two warm-up batches per kernel, alternating the execution order over six measured batches. Current kernel median **20.79 ms**, scalar median **13.61 ms**: **1.53×**, about **34.5% less time**. Earlier development runs were approximately 1.49–1.52×; these are local repetitions, not independent device evidence. Timing counters are disabled in both measured paths. A consumed hit-distance checksum prevents discarding results.

This is JavaScriptCore/Bun, without Chrome DEV instrumentation or 6× throttling. It measures complete ray batches, not end-to-end contour/update latency, a worker round trip, UI rendering, GPU time or worst-case single-ray time. It does not establish that Vector3.fromArray alone caused the speedup: scalarization removes several method calls and object property accesses together.

## Exactness and fixture provenance

The collider comes from production `createImmutableShells(DEFAULT_DEVICE_FORM)` plus `createHardwareGeometry`, through the current collision builder: 200,913 triangles, 65,535 nodes and 20,267,280 packed bytes. This is a **source-built representative default-device assembly**, not the user's captured current collider or live settings. The prepared contour comes from the production wrapped-surface/contour preparation functions using a deliberately synthetic 64×96 cutout alpha field, wear 0.2, and a wrapped placement. It provides 960 local sampled points; three camera positions and deterministic random segments produce 4080 rays, of which 746 hit.

Node assert.deepEqual verifies the full hit point, unit normal, distance and provenance against current production `castSegment`, including signed zero. All 4080 device rays and 489 adversarial cases pass. Adversarial fixtures cover exact vertices/shared edges, just-outside edges, coplanar and zero/short segments, both directions, endpoints, degenerate triangles, duplicate equal-distance sources, signed zero, nonfinite inputs and scales 1e-5/1/1e8. Counted shared-edge fallback executions are 40/32/52 across those three fixtures, so the fallback branch is exercised. Three complete prepared-contour projection comparisons pass (3 non-null), including paths, split/closed flags, anchors and visibility. Packed borrowed buffers retain their pre-test hashes.

This is meaningful finite evidence, not a proof for every arbitrary mesh, extreme value or camera. More adversarial and actual captured-scene coverage is required before production adoption.

## Implementation boundary

`evidence/gpu-worker/contour-throughput/scalar.ts` is a standalone synchronous scalar transcription of the current BVH traversal and installed Three 0.185.1 Ray/Triangle/Vector3 equations. It preserves normalized finite-segment direction, box entry/inside tests, left-then-right traversal, nearest-hit comparisons, two-sided triangle tests, normal computation order, shared-edge roundoff fallback and endpoint tolerances. No any-hit shortcut, geometry simplification, precision reduction or changed epsilon is used.

One reusable numeric stack and scalar scratch replace the working vectors/triangle/box. Successful returned hits still allocate their own Vector3 point and normal exactly as the caller contract requires. No snapshot cloning or new cache is involved. Current implementation and prototype are synchronous and non-reentrant; cancellation/yielding is deliberately not prototyped here. This experiment does not supply an asynchronous owner or lifetime contract.

## Reproduce and disposition

Run `bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/contour-throughput/check.ts`. Full measurements and work counts are in `result.json`; exact application/dependency/prototype hashes are in `manifest.json`. Scoped ESLint passes for both evidence TypeScript files; no application tests/build were needed because application source is unchanged.

The next immediate product slice remains the independently authored quad UV-index cache, given the post-guard profile. This scalar boundary is a credible follow-up for residual contour cost: first independently review arithmetic parity, then use lead-owned bounded Chrome measurement on an actual displayed collider before choosing worker cadence. A roughly one-third reduction on this fixture is useful but does not resolve the strict current-pose versus asynchronous latency contract. No stale historical contour presentation or GPU precision tradeoff is approved by these results.
