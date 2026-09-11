import type {Object3D} from 'three';
interface AssemblyRevision {revision:number;owners:number;dispose:()=>void;}
const assemblies=new WeakMap<Object3D,AssemblyRevision>();
/** Explicit authority for product-owned local assembly mutations. Root/world
 * pose is intentionally excluded. Registered owners must signal local geometry,
 * material visibility/opacity and transform changes before the next query.
 * Child topology is observed automatically; registration teardown removes every
 * listener. Unregistered scenes retain visibility's defensive inspection path. */
export function registerStickerAssembly(root:Object3D):()=>void {
 const existing=assemblies.get(root);if(existing){existing.owners++;return releaseOnce(root,existing);}
 const watched=new Set<Object3D>();
 const state:AssemblyRevision={revision:0,owners:1,dispose:()=>{for(const object of watched){object.removeEventListener('childadded',added);object.removeEventListener('childremoved',removed);}watched.clear();}};
 const observe=(object:Object3D)=>{if(object.name==='device-equipped-stickers'||object.name.startsWith('sticker-'))return;watched.add(object);object.addEventListener('childadded',added);object.addEventListener('childremoved',removed);for(const child of object.children)observe(child);};
 const unobserve=(object:Object3D)=>{if(!watched.delete(object))return;object.removeEventListener('childadded',added);object.removeEventListener('childremoved',removed);for(const child of object.children)unobserve(child);};
 const added=({child}:{child:Object3D})=>{observe(child);state.revision++;};
 const removed=({child}:{child:Object3D})=>{unobserve(child);state.revision++;};
 assemblies.set(root,state);observe(root);return releaseOnce(root,state);
}
function releaseOnce(root:Object3D,state:AssemblyRevision){let released=false;return()=>{if(released)return;released=true;release(root,state);};}
function release(root:Object3D,state:AssemblyRevision){if(--state.owners===0){state.dispose();if(assemblies.get(root)===state)assemblies.delete(root);}}
/** Call synchronously after local mutation, before publishing input/physics state. */
export function markStickerAssemblyChanged(object:Object3D):void {
 for(let node:Object3D|null=object;node;node=node.parent){const state=assemblies.get(node);if(state){state.revision++;return;}}
}
/** Read-only authority identity and revision; never serialized into worker data. */
export function stickerAssemblyRevision(root:Object3D):Readonly<Pick<AssemblyRevision,'revision'>>|undefined{return assemblies.get(root);}
