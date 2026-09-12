import { Vector3 } from 'three';
import type { StickerCollisionFace, StickerCollisionSnapshot } from './sticker-collision';
import { yieldSteps } from './sticker-computation-steps';


/** Exact fallback for the worker BVH: identical coordinates, stable median
 * partitions and provenance. Every linear pass and sort merge yields in bounded
 * batches; no native whole-array sort hides an uninterruptible build stage.
 * Borrowed input must retain its assembly revision until the caller accepts the
 * result (visibility checks that revision again before installing the snapshot).
 */
export function* collisionSteps(faces: readonly StickerCollisionFace[]): Generator<void, StickerCollisionSnapshot, void> {
  let triangleCount = 0, work = 0;
  for (const face of faces) {
    const count = face.geometry.index?.count ?? face.geometry.getAttribute('position').count;
    if (count % 3 !== 0) throw new Error('Sticker collider requires triangle geometry');
    triangleCount += count / 3;
  }
  const coordinates = new Float64Array(triangleCount * 9), provenance = new Uint32Array(triangleCount);
  const centers = new Float64Array(triangleCount * 3), bounds = new Float64Array(triangleCount * 6);
  const ids: number[] = [], merged: number[] = [];
  const metadata = faces.map(face => ({ source: face.source, kind: face.kind, adhesiveSupport: face.adhesiveSupport === true }));
  const vertex = new Vector3();
  let id = 0;
  for (const [owner, face] of faces.entries()) {
    const position = face.geometry.getAttribute('position'), index = face.geometry.index;
    const count = index?.count ?? position.count;
    for (let i = 0; i < count; i += 3, id++) {
      for (let k = 0; k < 3; k++) {
        const j = index ? index.getX(i + k) : i + k;
        vertex.set(position.getX(j), position.getY(j), position.getZ(j));
        if (face.transform) vertex.applyMatrix4(face.transform);
        if (![vertex.x, vertex.y, vertex.z].every(Number.isFinite)) throw new Error('Nonfinite sticker collision geometry');
        const offset = id * 9 + k * 3;
        coordinates[offset] = vertex.x; coordinates[offset + 1] = vertex.y; coordinates[offset + 2] = vertex.z;
      }
      provenance[id] = owner; ids.push(id);
      for (let axis = 0; axis < 3; axis++) {
        const a = coordinates[id * 9 + axis] ?? 0, b = coordinates[id * 9 + 3 + axis] ?? 0, c = coordinates[id * 9 + 6 + axis] ?? 0;
        centers[id * 3 + axis] = a + b + c;
        bounds[id * 6 + axis] = Math.min(a, b, c); bounds[id * 6 + axis + 3] = Math.max(a, b, c);
      }
      if (++work % 128 === 0) yield;
    }
  }
  let nodeCount = 0;
  const nodeBounds:number[]=[],links:number[]=[],leafTriangles:number[]=[];
  function* build(start: number, end: number): Generator<void, number, void> {
    const node=nodeCount++;
    links.push(0,0,0,0);
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = start; i < end; i++) {
      const offset = (ids[i] ?? 0) * 6;
      for (let axis = 0; axis < 3; axis++) {
        box[axis] = Math.min(box[axis] ?? Infinity, bounds[offset + axis] ?? 0);
        box[axis + 3] = Math.max(box[axis + 3] ?? -Infinity, bounds[offset + axis + 3] ?? 0);
      }
      if (++work % 128 === 0) yield;
    }
    for(let axis=0;axis<6;axis++)nodeBounds[node*6+axis]=box[axis]??0;
    if (end - start <= 8) {links[node*4+2]=leafTriangles.length;links[node*4+3]=end-start;for(let cursor=start;cursor<end;cursor++)leafTriangles.push(ids[cursor]??0);return node;}
    const x = (box[3] ?? 0) - (box[0] ?? 0), y = (box[4] ?? 0) - (box[1] ?? 0), z = (box[5] ?? 0) - (box[2] ?? 0);
    const axis = x >= y && x >= z ? 0 : y >= z ? 1 : 2;
    // Stable bottom-up merge sort matches the synchronous numeric comparator,
    // including equal centers retaining their preexisting subtree order.
    for (let width = 1; width < end - start; width *= 2) {
      for (let first = start; first < end; first += width * 2) {
        const middle = Math.min(first + width, end), last = Math.min(first + width * 2, end);
        let left = first, right = middle;
        for (let cursor = first; cursor < last; cursor++) {
          const a = ids[left] ?? 0, b = ids[right] ?? 0;
          const comparison = (centers[a * 3 + axis] ?? 0) - (centers[b * 3 + axis] ?? 0);
          merged[cursor] = right >= last || (left < middle && (comparison <= 0 || Number.isNaN(comparison))) ? (ids[left++] ?? 0) : (ids[right++] ?? 0);
          if (++work % 128 === 0) yield;
        }
      }
      for (let cursor = start; cursor < end; cursor++) { ids[cursor] = merged[cursor] ?? 0; if (++work % 128 === 0) yield; }
    }
    const half = start + ((end - start) >> 1);
    const left = yield* build(start, half), right = yield* build(half, end);
    links[node*4]=left+1;links[node*4+1]=right+1;return node;
  }
  yield* build(0, triangleCount);
  const root={bounds:Float64Array.from(nodeBounds),links:Uint32Array.from(links),triangles:Uint32Array.from(leafTriangles)};
  return { coordinates, provenance, metadata, root, nodeCount };
}

/** Failure-only main-thread recovery, scheduled after the initiating input task.
 * Cancellation rejects and releases generator-owned temporary build arrays.
 */
export async function prepareCollisionCooperatively(faces: readonly StickerCollisionFace[], signal: AbortSignal): Promise<StickerCollisionSnapshot> {
  return yieldSteps(collisionSteps(faces), signal);
}
