import type { BufferGeometry, Vector3 } from 'three';
import type { DeviceFormParams } from './form';
import { createStickerRearChart } from './sticker-rear-chart';

export interface StickerWrapFace { readonly geometry: BufferGeometry; readonly offset?: readonly [number, number, number] }
export interface StickerWrapPoint { readonly point: Vector3; readonly normal: Vector3 }
/** Front meshes remain accepted for assembly API compatibility, never as adhesive support. */
export function createStickerWrapSurface(form: DeviceFormParams, _faces: readonly StickerWrapFace[]) {
  void _faces;
  return createStickerRearChart(form);
}

export type StickerWrapSurface = ReturnType<typeof createStickerWrapSurface>;

const wrapSurfaces = new WeakMap<BufferGeometry, { readonly surface: StickerWrapSurface }>();
/** Share one actual-shell sampler between equipped prints and the packet's borrowed rear geometry. */
export function bindStickerWrapSurface(rear: BufferGeometry, surface: StickerWrapSurface): () => void {
  const binding = { surface };
  wrapSurfaces.set(rear, binding);
  return () => { if (wrapSurfaces.get(rear) === binding) wrapSurfaces.delete(rear); };
}
export function stickerWrapSurface(rear: BufferGeometry): StickerWrapSurface | undefined { return wrapSurfaces.get(rear)?.surface; }
