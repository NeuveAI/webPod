# Native layout and raster density publication

CPU023 source is frozen for independent review. Full current-Chrome resize, native capture/texture adoption and fallback fidelity remain host gates. No browser operations or commits were performed.

Read full gpu-worker-scope dispatch I and renderer-host plan. Applied modern-web-guidance (interactive-content-in-3d-scenes), grounded numerical policy in the existing CanvasPixelDensity/pixel-density and html-in-canvas density/frame resolvers. Host explicitly released WorkerDeviceCanvas.tsx and confirmed the canonical logical destination is320×240; intrinsic Panel272×204 fitting remains its separate existing owner. No new density cap or user setting.

## Ownership and implementation

Only packages/composite/src/WorkerDeviceCanvas.tsx and new native-canvas-measurement.ts change. Input archive is evidence/gpu-worker/native-layout/WorkerDeviceCanvas.before.txt, SHA256 d7c9e453677ddd423d5813dbe11feaf95f88f02f6ab0a18b93c89d4e5d93b5c4. Existing owner/latest-props forwarding of stickerScene is preserved; no renderer, Scene, protocol, Panel portal or media changes.

One measurement owner lives for the canvas generation. One ResizeObserver uses physical content-box support where available; a rearmed resolution media query handles DPR-only changes, with window/visualViewport resize and visibility resumption. At most one scheduled frame coalesces notifications. ResizeObserver payloads avoid another layout read. Physical-box evidence is retained across duplicate browser resize notifications while CSS dimensions and native DPR remain identical; genuine changed inputs discard it. Hidden documents cancel the pending frame and defer work; zero/nonfinite dimensions retain the last valid host layout. Disposal disconnects observer, removes all listeners, cancels queued work and guards late callbacks. Replacement starts a fresh owner.

The existing resolveCanvasPixelRatio numerical policy and explicit numeric DPR override are unchanged. Raster sizing uses resolvePanelRasterFrame with original screen dimensions/scale and resolvePanelRasterDensity(max(nativeDPR, resolvedCanvasDPR)). Scalar equality includes CSS, backing, density and raster dimensions before camera fitting/matrix allocation or layout revision advancement. The owner is independent of pose/React prop notifications. Equal repeated measurements do not advance layout. Camera fitting and final physical backing floor semantics remain unchanged.

The agreed updateLayout(layout, {width,height}) publishes coherent camera/layout and raster dimensions. Host owns monotonic raster generation, capture stamps, native texture resizing/adoption and visibility/submission. This source does not claim physical display acknowledgment or browser visual acceptance.

## Verification

- `bun test packages/device/src/pixel-density.test.ts packages/composite/src/html-in-canvas.test.ts`:13 pass,0 fail,49 assertions; /tmp/cpu023-tests.log.
- `bun docs/workstreams/023-mobile-tactility/evidence/gpu-worker/native-layout/lifecycle.ts`:16 retained checks, actual measurement owner with a real Happy DOM canvas and deterministic browser scheduling/observation. Covers repeated bursts, no redundant read for observer payload, CSS resize, DPR-only changes, fractional physical pixels, hidden/zero/resume, cancellation, stale callbacks, idempotence, replacement and explicit density. Output lifecycle.json. This is source/lifecycle proof, not browser rendering evidence.
- `bun run --cwd packages/composite typecheck`, equivalent packages/device and apps/web commands: all pass; /tmp/cpu023-{composite,device,web}-types.log.
- `bunx --bun eslint packages/composite/src/WorkerDeviceCanvas.tsx packages/composite/src/native-canvas-measurement.ts docs/workstreams/023-mobile-tactility/evidence/gpu-worker/native-layout/lifecycle.ts`: pass.

Independent source review required before commit. Existing-route real raster dimensions and quality remain lead-owned mandatory acceptance.

## Independent review correction and refreeze

Reviewer reproduced fractional physical density1.5 being downgraded to native DPR1 by a duplicate window resize after its ResizeObserver payload was consumed. Fixed the measurement owner to retain physical evidence while CSS width/height and native DPR match the observation, invalidating it only when those inputs change. The retained owner proof now includes this duplicate viewport/window case (16 checks), and scoped lint/composite types pass. Independent rerun is required. Superseding source freeze: `/tmp/webpod-cpu023-reviewed-fix-20260911/`, with both files and manifest hashes; the earlier freeze is historical.

The same-frame observer→viewport case is also covered: physical metadata is retained immediately on the observer callback, then validated against current CSS/native DPR at flush. A duplicate invalidation cannot erase a newer authoritative sample before adoption. Final helper SHA256 `363fd1d3a45344c6978b3dac3ec5d81748804f4f8dd2ef812166ff35168122eb`; the superseding freeze manifest was refreshed.
