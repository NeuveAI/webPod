import { Mesh, MeshPhysicalMaterial, Raycaster } from 'three';
import type { DeviceStickerPlacement } from './sticker-contract';
import { stickerAlphaHit } from './sticker-alpha';
export { prepareStickerAlpha } from './sticker-alpha';

/** Direct surface hits respect printed alpha; transparent corners belong to the shell. */
export function hitStickerPrint(ray: Raycaster, rendered: Mesh, placement: DeviceStickerPlacement): DeviceStickerPlacement | null {
  const material = rendered.material;
  if (!(material instanceof MeshPhysicalMaterial) || material.map === null) return null;
  const texture = material.map;
  rendered.updateWorldMatrix(true, false);
  // Borrow geometry/material; the real print intentionally has raycast disabled for R3F.
  const probe = new Mesh(rendered.geometry, material); probe.matrixWorld.copy(rendered.matrixWorld);
  const hit = ray.intersectObject(probe, false)[0];
  if (hit?.uv === undefined) return null;
  return stickerAlphaHit(texture, placement.stickerId, hit.uv.x, hit.uv.y, placement.wear ?? 0) ? placement : null;
}
