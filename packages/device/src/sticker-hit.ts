import { Mesh, MeshPhysicalMaterial, Raycaster } from 'three';
import type { DeviceStickerPlacement } from './sticker-contract';
import { getStickerMaterialDamage, stickerAlphaHit } from './sticker-alpha';
export { prepareStickerAlpha } from './sticker-alpha';

/** Direct surface hits respect printed alpha; transparent corners belong to the shell. */
export function hitStickerPrint(ray: Raycaster, rendered: Mesh, placement: DeviceStickerPlacement): DeviceStickerPlacement | null {
  return intersectStickerPrint(ray, rendered, placement) === null ? null : placement;
}

/** Actual painted UV and distance, shared by selection and frozen wrapped pickup. */
export function intersectStickerPrint(ray: Raycaster, rendered: Mesh, placement: DeviceStickerPlacement) {
  const material = rendered.material;
  if (!(material instanceof MeshPhysicalMaterial) || material.map === null) return null;
  const texture = material.map;
  rendered.updateWorldMatrix(true, false);
  // Borrow geometry/material; the real print intentionally has raycast disabled for R3F.
  const probe = new Mesh(rendered.geometry, material); probe.matrixWorld.copy(rendered.matrixWorld);
  for (const hit of ray.intersectObject(probe, false)) {
    if (hit.uv !== undefined && stickerAlphaHit(texture, placement.stickerId, hit.uv.x, hit.uv.y, placement.wear ?? 0, getStickerMaterialDamage(material, placement.stickerId))) {
      // The temporary raycast probe has no scene parent. Downstream material-frame
      // capture must retain the real mesh, whose local/world transforms agree.
      return { ...hit, object: rendered };
    }
  }
  return null;
}
