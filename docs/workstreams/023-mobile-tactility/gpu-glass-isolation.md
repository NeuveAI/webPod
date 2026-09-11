# Temporary actual-scene glass isolation

Prepared only Device.tsx and device-render-worker.ts under the explicitly released scope. Exact originals reside under `/tmp/webpod-glass-isolation-original`; original and instrumented SHA-256 manifests plus the complete temporary diff reside in `evidence/gpu-worker/glass-isolation`.

GL consumes the existing authored recipe, setting visible:false only on its top-level mesh with id glass. Native preserves its exact graph and sets only the identified glass Mesh.visible=false immediately after graph construction. The real LCD geometry/material/texture, associated DOM projection, camera, canvas, lighting and all other objects are unchanged. No API, logging, synthetic quad, readback or browser action is introduced. No permanent source commit or clean build may include this mask.

Independent review precedes the lead's matching settled Silver/light/front captures. After capture, this owner restores both files byte-exactly from the archive and verifies the original hashes. This is static causal isolation, not performance evidence; no permanent brightness or material adjustment is authorized.

## Capture and restoration

Independent reviewer verified the exact mask before capture. Because the first native screenshot alone did not prove its live renderer generation, the lead authorized one native pre-render scalar per initialized owner. The retained actual log establishes Black epoch2 and Silver epoch4 with visible:false, sameObject:true and hasParent:true. The counter ran only after painted/compiled/visible admission, immediately before the real render. No later pose path overwrites mesh visibility.

Lead captured matching GL and verified native Silver/light scenes. Retained files are `gl-silver-light.png`, `native-silver-light-verified.png` and `native-mask-verification.txt`. The native LCD remained gray while GL was white with actual glass hidden. This localizes the discrepancy beyond the glass overlay; it does not justify global brightness compensation or changing blend order. The earlier unverified native screenshot is not the authoritative comparison.

Both application files were restored byte-exactly and their source diff is empty. `restored-manifest.json` matches the original manifest: Device.tsx SHA-256 9344ff6ecfe5ce27c5e2defe69b49cb9538937a304006f9697a9921b60e1c07d; device-render-worker.ts 8f6464f67e9732fe7a18d97458ab2bebfc160d3d108cb0508c4f3b6911bc56ef. Only diagnostic artifacts remain. Any per-material output architecture must separately preserve the original GL tone-map→sRGB→blend ordering and receive an explicit implementation boundary and independent review.
