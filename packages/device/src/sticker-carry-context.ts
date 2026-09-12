import type { BufferGeometry } from 'three';
import type { DeviceFormParams } from './form';
import type { StickerCollisionSnapshot } from './sticker-collision';
import type { CarryWorkerMessage } from './sticker-carry-worker';

/** Fixed private assembly allowance, independent of completed carry-frame leases.
 * Replacement retires the installed producer before reserving another context.
 * Borrowed public geometry/collision bytes are never charged as private copies.
 */
export const MAX_CARRY_CONTEXT_BYTES = 64 * 1024 * 1024;
const COPY_ELEMENTS = 2048;

/** Capture immutable references and scalar allocation sizes only. This function
 * does not allocate/copy dense buffers and is safe on a cold request. The caller
 * must retain the source generation and abort copying before releasing it.
 */
export function carryContextSource(rear: BufferGeometry, collision: StickerCollisionSnapshot, form: DeviceFormParams | null) {
  const position = rear.getAttribute('position'), normal = rear.getAttribute('normal'), uv = rear.getAttribute('uv');
  if (!position || !normal || !('isBufferAttribute' in position) || !('isBufferAttribute' in normal) || (uv && !('isBufferAttribute' in uv))) throw Error('Carry context requires plain immutable attributes');
  const sphere = rear.boundingSphere;
  if (!sphere) throw Error('Carry context requires prepared bounds');
  const index = rear.index;
  // Account the exact output typed storage plus conservative scalar metadata.
  const bytes = (position.array.length + normal.array.length + (uv?.array.length ?? 0) + (index?.array.length ?? 0)) * 4
    + collision.coordinates.byteLength + collision.provenance.byteLength + collision.root.bounds.byteLength
    + collision.root.links.byteLength + collision.root.triangles.byteLength
    + 4096 + collision.metadata.reduce((sum, item) => sum + 64 + item.source.length * 2, 0);
  if (!Number.isSafeInteger(bytes) || bytes > MAX_CARRY_CONTEXT_BYTES) throw Error('Carry context byte capacity exceeded');
  return { bytes, position: position.array, normal: normal.array, uv: uv?.array ?? null, index: index?.array ?? null,
    sphere: { x: sphere.center.x, y: sphere.center.y, z: sphere.center.z, radius: sphere.radius }, collision, form };
}

function* copy<T extends Float32Array | Float64Array | Uint32Array>(source: ArrayLike<number>, target: T): Generator<void, T, void> {
  for (let offset = 0; offset < source.length; offset += COPY_ELEMENTS) {
    const end = Math.min(source.length, offset + COPY_ELEMENTS);
    for (let i = offset; i < end; i++) {
      const value = source[i];
      if (value === undefined) throw Error('Carry context source was retired');
      target[i] = value;
    }
    yield;
  }
  return target;
}

/** Only the existing carry owner runs this generator through yieldSteps, which
 * yields a task before the first next(). Each copy checkpoint touches at most
 * 2048 elements. Exactly one private allocation is made per output array; every
 * buffer is subsequently transferred, never cloned again by postMessage.
 */
export function* copyCarryContextSteps(source: ReturnType<typeof carryContextSource>) {
  const rear = {
    position: yield* copy(source.position, new Float32Array(source.position.length)),
    normal: yield* copy(source.normal, new Float32Array(source.normal.length)),
    uv: source.uv ? yield* copy(source.uv, new Float32Array(source.uv.length)) : null,
    index: source.index ? yield* copy(source.index, new Uint32Array(source.index.length)) : null,
    sphere: source.sphere,
  };
  const original = source.collision;
  const coordinates = yield* copy(original.coordinates, new Float64Array(original.coordinates.length));
  const provenance = yield* copy(original.provenance, new Uint32Array(original.provenance.length));
  const bounds = yield* copy(original.root.bounds, new Float64Array(original.root.bounds.length));
  const links = yield* copy(original.root.links, new Uint32Array(original.root.links.length));
  const triangles = yield* copy(original.root.triangles, new Uint32Array(original.root.triangles.length));
  const metadata: StickerCollisionSnapshot['metadata'] = [];
  for (let i = 0; i < original.metadata.length; i++) {
    const item = original.metadata[i]; if (!item) throw Error('Carry context metadata was retired');
    metadata.push({ ...item });
    if (i % 64 === 63) yield;
  }
  const message = { context: { rear, form: source.form, collision: { coordinates, provenance, root: { bounds, links, triangles }, metadata, nodeCount: original.nodeCount } } } satisfies CarryWorkerMessage;
  const transfer = [rear.position.buffer, rear.normal.buffer, ...(rear.uv ? [rear.uv.buffer] : []), ...(rear.index ? [rear.index.buffer] : []),
    coordinates.buffer, provenance.buffer, bounds.buffer, links.buffer, triangles.buffer];
  return { message, transfer, bytes: source.bytes };
}
