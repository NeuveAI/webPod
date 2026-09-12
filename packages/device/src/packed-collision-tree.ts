/** Immutable BVH wire/query representation. Root is node zero. Each node has six
 * Float64 bounds and four Uint32 links: left+1, right+1, leaf start, leaf count.
 * Zero children are absent. Leaf order preserves original stable BVH traversal
 * and therefore exact equal-distance contact tie behavior. */
export interface PackedCollisionTree {
 readonly bounds:Float64Array;
 readonly links:Uint32Array;
 readonly triangles:Uint32Array;
}
/** Private transfer buffers only. Borrowed mounted/query snapshots must be cloned
 * by structured clone or copied explicitly; never transfer their backing storage. */
export function packedTreeBuffers(tree:PackedCollisionTree):ArrayBuffer[] {
 return [tree.bounds.buffer,tree.links.buffer,tree.triangles.buffer].map(buffer=>{
  if(!(buffer instanceof ArrayBuffer))throw Error('Expected private collision buffer');return buffer;
 });
}
