import { BufferAttribute, BufferGeometry } from 'three';
import { createStickerCollision } from './sticker-collision';
import type { PackedCollisionTree } from './packed-collision-tree';
export interface ShellPickingInput {readonly positions:Float32Array;readonly indices:Uint32Array|null}
export interface ShellPickingIndex {readonly root:PackedCollisionTree;readonly indices:Uint32Array;readonly faces:Uint32Array}
/** Exact packed worker index. Leaf ranges refer to original face IDs in stable
 * traversal order; the live Three raycaster retains side/UV/material semantics. */
export function buildShellPickingIndex(input:ShellPickingInput):ShellPickingIndex {
 const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(input.positions,3));if(input.indices)geometry.setIndex(new BufferAttribute(input.indices,1));
 const collider=createStickerCollision([{geometry,source:'shell',kind:'surface'}]);
 try {
  const root=collider.snapshot().root,faces=root.triangles;
  const indices=new Uint32Array(faces.length*3);
  for(let cursor=0;cursor<faces.length;cursor++){const face=faces[cursor]??0;for(let corner=0;corner<3;corner++)indices[cursor*3+corner]=input.indices?.[face*3+corner]??face*3+corner;}
  return {root,indices,faces};
 }finally{collider.dispose();geometry.dispose();}
}
