import { BufferAttribute, type BufferGeometry, type InterleavedBufferAttribute } from 'three';

const plainAttribute = (attribute: BufferAttribute | InterleavedBufferAttribute): attribute is BufferAttribute => 'isBufferAttribute' in attribute && attribute.isBufferAttribute === true;

/** Finalize owned, not-yet-published triangle geometry. Only bit-identical complete
 * Float32 attribute records share vertices. Normals, UV seams, signed zero and
 * custom data remain exact; triangle order/groups/bounds and geometry identity
 * remain unchanged. Already indexed and unsupported attributes stay untouched.
 * Run after all vertex edits, never on a mounted or deforming geometry. */
export function indexImmutableGeometry<T extends BufferGeometry>(geometry: T): T {
  const position = geometry.getAttribute('position');
  if (geometry.index || !position || position.count % 3 || Object.keys(geometry.morphAttributes).length) return geometry;
  const entries = Object.entries(geometry.attributes);
  const attributes: { name: string; attribute: BufferAttribute; words: Uint32Array }[] = [];
  for (const [name, attribute] of entries) {
    if (!plainAttribute(attribute) || 'isInstancedBufferAttribute' in attribute || !(attribute.array instanceof Float32Array) || attribute.count !== position.count) return geometry;
    attributes.push({ name, attribute, words: new Uint32Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.length) });
  }
  const count = position.count, heads = new Map<number, number>();
  const next = new Uint32Array(count), canonical = new Uint32Array(count), remap = new Uint32Array(count);
  let unique = 0;
  const equal = (a: number, b: number): boolean => {
    for (const { attribute, words } of attributes) {
      const size = attribute.itemSize;
      for (let k = 0; k < size; k++) if (words[a * size + k] !== words[b * size + k]) return false;
    }
    return true;
  };
  for (let vertex = 0; vertex < count; vertex++) {
    let hash = 2166136261;
    for (const { attribute, words } of attributes) {
      for (let k = 0; k < attribute.itemSize; k++) hash = Math.imul(hash ^ (words[vertex * attribute.itemSize + k] ?? 0), 16777619) >>> 0;
    }
    let found = heads.get(hash) ?? 0;
    while (found && !equal(vertex, canonical[found - 1] ?? 0)) found = next[found - 1] ?? 0;
    if (!found) {
      canonical[unique] = vertex; next[unique] = heads.get(hash) ?? 0;
      found = ++unique; heads.set(hash, found);
    }
    remap[vertex] = found - 1;
  }
  const stride = attributes.reduce((sum, { attribute }) => sum + attribute.itemSize * 4, 0);
  const indexBytes = unique > 65535 ? 4 : 2;
  if (unique * stride + count * indexBytes >= count * stride) return geometry;
  // Commit only after all replacement attributes are ready. No live GPU buffers
  // exist at this construction boundary; discarded source arrays become garbage.
  const compact = attributes.map(({ name, attribute, words }) => {
    const array = new Float32Array(unique * attribute.itemSize), target = new Uint32Array(array.buffer);
    for (let vertex = 0; vertex < unique; vertex++) {
      const source = canonical[vertex] ?? 0;
      for (let k = 0; k < attribute.itemSize; k++) target[vertex * attribute.itemSize + k] = words[source * attribute.itemSize + k] ?? 0;
    }
    const replacement = new BufferAttribute(array, attribute.itemSize, attribute.normalized);
    replacement.name = attribute.name; replacement.setUsage(attribute.usage); replacement.gpuType = attribute.gpuType;
    replacement.onUpload(attribute.onUploadCallback);
    return { name, attribute: replacement };
  });
  const index = new BufferAttribute(unique > 65535 ? remap : Uint16Array.from(remap), 1);
  for (const { name, attribute } of compact) geometry.setAttribute(name, attribute);
  geometry.setIndex(index);
  return geometry;
}
