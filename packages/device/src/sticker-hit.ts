import { Mesh, MeshPhysicalMaterial, Raycaster, type Texture } from 'three';
import type { DeviceStickerPlacement } from './sticker-contract';
import { STICKER_SURFACE } from './sticker-surface';

const alpha = new WeakMap<Texture, { readonly width: number; readonly height: number; readonly pixels: Uint8Array }>();
/** Prepare only the alpha channel before the first pointer interaction. */
export function prepareStickerAlpha(texture: Texture): void {
  if (alpha.has(texture)) return;
  const source: unknown = texture.source.data;
  if (!(source instanceof HTMLImageElement) || !source.complete || source.naturalWidth === 0) return;
  const canvas = document.createElement('canvas'); canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) return;
  context.drawImage(source, 0, 0);
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixels = new Uint8Array(canvas.width * canvas.height);
  for (let index = 0; index < pixels.length; index++) pixels[index] = rgba[index * 4 + 3] ?? 0;
  alpha.set(texture, { width: canvas.width, height: canvas.height, pixels });
}
/** Direct surface hits respect printed alpha; transparent corners belong to the shell. */
export function hitStickerPrint(ray: Raycaster, rendered: Mesh, placement: DeviceStickerPlacement): DeviceStickerPlacement | null {
  const material = rendered.material;
  if (!(material instanceof MeshPhysicalMaterial) || material.map === null) return null;
  const texture = material.map;
  prepareStickerAlpha(texture);
  const mask = alpha.get(texture);
  if (mask === undefined) return null;
  rendered.updateWorldMatrix(true, false);
  // Borrow geometry/material; the real print intentionally has raycast disabled for R3F.
  const probe = new Mesh(rendered.geometry, material); probe.matrixWorld.copy(rendered.matrixWorld);
  const hit = ray.intersectObject(probe, false)[0];
  if (hit?.uv === undefined) return null;
  const x = Math.max(0, Math.min(mask.width - 1, Math.floor(hit.uv.x * mask.width)));
  const y = Math.max(0, Math.min(mask.height - 1, Math.floor((1 - hit.uv.y) * mask.height)));
  return (mask.pixels[y * mask.width + x] ?? 0) / 255 >= STICKER_SURFACE.alphaThreshold ? placement : null;
}
