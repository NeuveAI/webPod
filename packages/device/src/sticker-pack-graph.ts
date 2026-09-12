import { Group, Matrix4, type Object3D } from 'three';
import type { StickerPackNode } from './sticker-pack-recipe';
export type StickerPackLeaf = Exclude<StickerPackNode, {readonly kind:'group'}>;
/** Build only hierarchy from the shared recipe. Rendering owners supply already
 * leased leaf resources/materials and dispose those separately from this graph. */
export function createStickerPackGraph(recipe: StickerPackNode, leaf: (node: StickerPackLeaf) => Object3D): Object3D {
 const object=recipe.kind==='group'?new Group():leaf(recipe);
 if(recipe.name!==undefined)object.name=recipe.name;
 if(recipe.position)object.position.fromArray(recipe.position);
 if(recipe.rotation)object.rotation.set(...recipe.rotation,'XYZ');
 object.visible=recipe.visible??true;object.updateMatrix();
 if(recipe.kind==='group')for(const node of recipe.children)object.add(createStickerPackGraph(node,leaf));
 return object;
}
/** Exact leaf local/world matrices for query/resource adoption. The supplied root
 * matrix is the external scene parent; recipe transformations are applied once. */
export function stickerPackLeafSlots(recipe: StickerPackNode, parent = new Matrix4()): readonly {readonly node:StickerPackLeaf;readonly local:readonly number[];readonly world:readonly number[];readonly visible:boolean}[] {
 const values:{node:StickerPackLeaf;local:readonly number[];world:readonly number[];visible:boolean}[]=[];
 const visit=(node:StickerPackNode,world:Matrix4,visible:boolean)=>{
  const object=new Group();if(node.position)object.position.fromArray(node.position);if(node.rotation)object.rotation.set(...node.rotation,'XYZ');object.updateMatrix();
  const next=new Matrix4().multiplyMatrices(world,object.matrix),shown=visible&&(node.visible??true);
  if(node.kind==='group')for(const child of node.children)visit(child,next,shown);else values.push({node,local:object.matrix.toArray(),world:next.toArray(),visible:shown});
 };visit(recipe,parent,true);return values;
}
