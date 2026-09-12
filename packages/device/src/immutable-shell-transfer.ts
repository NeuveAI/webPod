import { Box3, BufferAttribute, BufferGeometry, Sphere, Vector3 } from 'three';
import type { createImmutableShells } from './immutable-shells';
export interface ShellGeometryTransfer {
 readonly attributes: Record<string, { array: Float32Array; itemSize: number; normalized: boolean }>;
 readonly index: Uint16Array | Uint32Array | null;
 readonly bounds: readonly number[]; readonly sphere: readonly number[];
 readonly name: string;
 readonly groups: {start:number;count:number;materialIndex?:number}[];
 readonly drawRange: {start:number;count:number};
}
export type ShellPair = ReturnType<typeof createImmutableShells>;
export type ShellPairTransfer = {front:ShellGeometryTransfer;back:ShellGeometryTransfer};
export function transferShell(geometry: BufferGeometry): ShellGeometryTransfer {
 const attributes: ShellGeometryTransfer['attributes']={};
 for(const [name,attribute] of Object.entries(geometry.attributes)) {
  if(!(attribute.array instanceof Float32Array))throw Error('Unsupported shell attribute');
  attributes[name]={array:attribute.array,itemSize:attribute.itemSize,normalized:attribute.normalized};
 }
 const index=geometry.index?.array??null;
 if(index && !(index instanceof Uint16Array) && !(index instanceof Uint32Array))throw Error('Unsupported shell index');
 if(!geometry.boundingBox||!geometry.boundingSphere)throw Error('Missing shell bounds');
 return {attributes,index,bounds:[...geometry.boundingBox.min.toArray(),...geometry.boundingBox.max.toArray()],sphere:[...geometry.boundingSphere.center.toArray(),geometry.boundingSphere.radius],name:geometry.name,groups:geometry.groups.map(group=>({...group})),drawRange:{...geometry.drawRange}};
}
export function restoreShell(value:ShellGeometryTransfer):BufferGeometry {
 const geometry=new BufferGeometry();geometry.name=value.name;
 for(const [name,attribute]of Object.entries(value.attributes))geometry.setAttribute(name,new BufferAttribute(attribute.array,attribute.itemSize,attribute.normalized));
 if(value.index)geometry.setIndex(new BufferAttribute(value.index,1));
 geometry.boundingBox=new Box3(new Vector3().fromArray(value.bounds),new Vector3().fromArray(value.bounds,3));
 geometry.boundingSphere=new Sphere(new Vector3().fromArray(value.sphere),value.sphere[3]);
 geometry.groups=value.groups.map(group=>({...group}));geometry.setDrawRange(value.drawRange.start,value.drawRange.count);
 return geometry;
}
