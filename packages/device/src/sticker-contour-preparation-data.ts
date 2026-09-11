import type { BufferGeometry } from 'three';
import type { StickerDamageField } from './sticker-alpha';
/** Float64 local points retain the exact original triangle interpolation math.
 * Both endpoint-only and visibility-sampled paths preserve authored order. */
export interface PreparedStickerContour {
  readonly paths: readonly { readonly points: Float64Array; readonly visiblePoints: Float64Array }[];
  readonly anchors: Float64Array;
}
const wearThreshold = (wear: number) => Math.floor((Number.isFinite(wear) ? Math.max(0, Math.min(1, wear)) : 0) * 255);
function geometryDependencies(geometry: BufferGeometry): readonly unknown[] {
  const dependencies: unknown[] = [];
  for (const attribute of [geometry.getAttribute('position'), geometry.getAttribute('uv'), geometry.index]) {
    dependencies.push(attribute);
    if (attribute) dependencies.push(attribute.array, attribute.count, attribute.itemSize, attribute.normalized,
      'version' in attribute ? attribute.version : attribute.data.version,
      'data' in attribute ? attribute.data : null,
      'offset' in attribute ? attribute.offset : null,
      'data' in attribute ? attribute.data.stride : null);
  }
  return dependencies;
}
const prepared = new WeakMap<BufferGeometry, { readonly field: StickerDamageField; readonly wear: number; readonly rawWear: number; readonly dependencies: readonly unknown[]; readonly value: PreparedStickerContour }>();
/** Prepared local points borrow one exact geometry revision and byte wear threshold. */
export function setPreparedStickerContour(geometry: BufferGeometry, field: StickerDamageField, wear: number, value: PreparedStickerContour): void {
  prepared.set(geometry, { field, wear: wearThreshold(wear), rawWear: wear, dependencies: geometryDependencies(geometry), value });
}
/** Raw wear of this exact prepared print geometry, shared by its front/back materials and contour. */
export function preparedStickerContourWear(geometry: BufferGeometry): number | undefined {
  const value = prepared.get(geometry);
  return value && getPreparedStickerContour(geometry, value.field, value.rawWear) ? value.rawWear : undefined;
}
/** Mutated/public geometry or a different wear threshold uses exact defensive projection. */
export function getPreparedStickerContour(geometry: BufferGeometry, field: StickerDamageField, wear: number) {
  const value = prepared.get(geometry);
  if (value?.field !== field || value.wear !== wearThreshold(wear)) return undefined;
  const dependencies = geometryDependencies(geometry);
  return dependencies.length === value.dependencies.length && dependencies.every((dependency, index) => dependency === value.dependencies[index]) ? value : undefined;
}
