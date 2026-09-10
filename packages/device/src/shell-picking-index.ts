import { BufferAttribute, BufferGeometry } from 'three';
import { createStickerCollision, type StickerCollisionSnapshot } from './sticker-collision';

export interface ShellPickingInput { readonly positions: Float32Array; readonly indices: Uint32Array | null }
export interface ShellPickingNode { readonly bounds: readonly number[]; readonly start: number; readonly count: number; readonly left?: ShellPickingNode; readonly right?: ShellPickingNode }
export interface ShellPickingIndex { readonly root: ShellPickingNode; readonly indices: Uint32Array; readonly faces: Uint32Array }

/** Worker-only spatial index. Triangles keep their original vertex and face IDs;
 * only candidate order changes, never the physical mesh or its attributes. */
export function buildShellPickingIndex(input: ShellPickingInput): ShellPickingIndex {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(input.positions, 3));
  if (input.indices) geometry.setIndex(new BufferAttribute(input.indices, 1));
  const collider = createStickerCollision([{ geometry, source: 'shell', kind: 'surface' }]);
  try {
    const snapshot = collider.snapshot();
    const count = (input.indices?.length ?? input.positions.length / 3) / 3;
    const indices = new Uint32Array(count * 3), faces = new Uint32Array(count);
    let cursor = 0;
    const pack = (node: StickerCollisionSnapshot['root']): ShellPickingNode => {
      const start = cursor * 3;
      if (node.triangles) for (const face of node.triangles) {
        faces[cursor] = face;
        for (let corner = 0; corner < 3; corner++) indices[cursor * 3 + corner] = input.indices?.[face * 3 + corner] ?? face * 3 + corner;
        cursor++;
      }
      const left = node.left ? pack(node.left) : undefined, right = node.right ? pack(node.right) : undefined;
      return { bounds: node.bounds, start, count: node.triangles ? node.triangles.length * 3 : 0, left, right };
    };
    return { root: pack(snapshot.root), indices, faces };
  } finally { collider.dispose(); geometry.dispose(); }
}
