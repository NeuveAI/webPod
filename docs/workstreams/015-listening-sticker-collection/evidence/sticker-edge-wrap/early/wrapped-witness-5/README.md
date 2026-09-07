# Canvas-relative pointer correction: unchanged gesture evidence

Finalized rebind of wrapped-witness-4 to canvas-ray-matrix-1. Every pickup, partial, release, hidden point, expected center, flick endpoint and attached UV is unchanged. The complete prior admitted trajectory is retained; its Bun timing values are historical, not fresh native measurements.

The actual submitted position/UV/index bytes were rehashed. Model/view/projection matrices, CSS canvas rectangle, seed and pose are exactly equal. Source-manifest differences are restricted to DeviceCanvas.tsx and the new canvas-events implementation/test. The mapper, grab solver and all geometry sources are unchanged. New FrontSide raster attribution and same-pass source shell draw/model correlation are reconstructed from the fresh capture.

Run rebind.ts then finalize.ts with this directory's absolute path. Source geometry reconstruction and exact 8+24 cold-admission trajectory generator remain in wrapped-witness-4; this rebind does no point search. The fresh native run must exercise these identical coordinates.

Limits remain: hidden print is also backfacing; refusal does not isolate BVH occlusion. Offline shell fixture omits other hardware, while native visibility uses the complete production scene. Side partial32px and front20px preserve their respective visible attached samples; final material motion/contact still needs native review.
