import type { BufferGeometry, Vector3 } from 'three';
import type { DeviceFormParams } from './form';
import { createStickerRearChart } from './sticker-rear-chart';

export interface StickerWrapFace { readonly geometry: BufferGeometry; readonly offset?: readonly [number, number, number] }
export interface StickerWrapPoint { readonly point: Vector3; readonly normal: Vector3 }
/** Front meshes remain accepted for assembly API compatibility, never as adhesive support. */
export function createStickerWrapSurface(form: DeviceFormParams, _faces: readonly StickerWrapFace[]) {
  void _faces;
  return { ...createStickerRearChart(form), form: { ...form } };
}

export type StickerWrapSurface = ReturnType<typeof createStickerRearChart> & { readonly form?: DeviceFormParams };

const wrapSurfaces = new WeakMap<BufferGeometry, { readonly surface: StickerWrapSurface }[]>();
/** Share one actual-shell sampler between equipped prints and the packet's borrowed rear geometry. */
export function bindStickerWrapSurface(rear: BufferGeometry, surface: StickerWrapSurface): () => void {
  const binding = { surface };
  const bindings = wrapSurfaces.get(rear) ?? [];
  bindings.push(binding); wrapSurfaces.set(rear, bindings);
  return () => {
    const index = bindings.indexOf(binding);
    if (index >= 0) bindings.splice(index, 1);
    if (bindings.length === 0 && wrapSurfaces.get(rear) === bindings) wrapSurfaces.delete(rear);
  };
}
export function stickerWrapSurface(rear: BufferGeometry): StickerWrapSurface | undefined { return wrapSurfaces.get(rear)?.at(-1)?.surface; }
