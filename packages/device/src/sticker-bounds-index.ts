import type { BufferAttribute, BufferGeometry } from 'three';

/** Immutable local AABBs over original contiguous vertex ranges. Leaves retain
 * original indices: projected extrema always come from the authored vertices. */
export interface StickerBoundsIndex {
  readonly bounds: Float64Array;
  /** Four integers per node: first vertex, count, left child, right child. */
  readonly nodes: Uint32Array;
  readonly seeds: Uint32Array;
}
const prepared = new WeakMap<BufferGeometry, { readonly index: StickerBoundsIndex; readonly attribute: BufferAttribute; readonly version: number }>();
/** Register only after adopting the matching immutable position attribute. An
 * in-place update invalidates the index and keeps the exact defensive path. */
export function setStickerBoundsIndex(geometry: BufferGeometry, index: StickerBoundsIndex): void {
  const attribute = geometry.getAttribute('position');
  if (attribute && 'version' in attribute) prepared.set(geometry, { index, attribute, version: attribute.version });
}
export function getStickerBoundsIndex(geometry: BufferGeometry): StickerBoundsIndex | undefined {
  const value = prepared.get(geometry), attribute = geometry.getAttribute('position');
  return value && value.attribute === attribute && value.version === value.attribute.version ? value.index : undefined;
}
/** Build once in preparation, yielding at each bounded leaf during cooperative
 * recovery. Internal nodes merge child bounds without another full vertex walk. */
export function* createStickerBoundsIndex(positions: ArrayLike<number>): Generator<void, StickerBoundsIndex, void> {
  const nodes: number[] = [], bounds: number[] = [];
  const seeds = new Uint32Array(6), extremes = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  function* build(first: number, count: number): Generator<void, number, void> {
    const node = nodes.length / 4; nodes.push(first, count, 0, 0); bounds.push(Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity);
    if (count <= 32) {
      for (let i = first; i < first + count; i++) for (let axis = 0; axis < 3; axis++) {
        const value = positions[i * 3 + axis] ?? NaN, low = node * 6 + axis, high = low + 3;
        bounds[low] = Math.min(bounds[low] ?? Infinity, value); bounds[high] = Math.max(bounds[high] ?? -Infinity, value);
        if (value < (extremes[axis] ?? Infinity)) { extremes[axis] = value; seeds[axis] = i; }
        if (value > (extremes[axis + 3] ?? -Infinity)) { extremes[axis + 3] = value; seeds[axis + 3] = i; }
      }
      yield;
    } else {
      const half = Math.floor(count / 2), left = yield* build(first, half), right = yield* build(first + half, count - half);
      nodes[node * 4 + 2] = left; nodes[node * 4 + 3] = right;
      for (let axis = 0; axis < 3; axis++) { bounds[node * 6 + axis] = Math.min(bounds[left * 6 + axis] ?? NaN, bounds[right * 6 + axis] ?? NaN); bounds[node * 6 + axis + 3] = Math.max(bounds[left * 6 + axis + 3] ?? NaN, bounds[right * 6 + axis + 3] ?? NaN); }
    }
    return node;
  }
  yield* build(0, Math.floor(positions.length / 3));
  return { nodes: Uint32Array.from(nodes), bounds: Float64Array.from(bounds), seeds };
}
