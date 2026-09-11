import {DataTexture, Group, Mesh, NearestFilter, RedFormat, type BufferGeometry, type Object3D, type Texture, type Material} from 'three';
import {MeshPhysicalNodeMaterial,MeshStandardNodeMaterial} from 'three/webgpu';
import {restoreShell} from './immutable-shell-transfer';
import {createStickerPackGraph} from './sticker-pack-graph';
import {stickerPackGeometryKey,stickerPackPaperMaterials,stickerPackSleeveMaterials,stickerPackSleeveParts,type StickerPackNode} from './sticker-pack-recipe';
import {installPaperNodes} from './sticker-paper-nodes';
import {createStickerRoughness} from './sticker-textures';
import {restoreDeviceFontTexture} from './device-font-assets';
import {createStickerNodeMaterials} from './sticker-material-nodes';
import type {StickerPackGeometryData} from './sticker-pack-resource-data';
import type {StickerRenderDamage} from './sticker-transaction-data';
import type {NativePackFrame} from '../../composite/src/native-pack-resources';

interface SharedGpu<T>{readonly value:T;readonly release:()=>void;references:number;retired:boolean}
export interface PackRenderResources {
 readonly geometry:Map<string,{id:number;unit:SharedGpu<Record<string,BufferGeometry>>}>;
 readonly damage:Map<number,SharedGpu<{result:StickerRenderDamage;texture:DataTexture}>>;
 readonly artwork:Map<string,SharedGpu<Texture>>;
 retired:boolean;
}
function gpuResource<T>(value:T,release:()=>void):SharedGpu<T>{return{value,release,references:0,retired:false};}
function retainGpu<T>(unit:SharedGpu<T>,owners:(()=>void)[]):T{if(unit.retired)throw new Error('Native packet resource retired');unit.references++;let done=false;owners.push(()=>{if(done)return;done=true;if(--unit.references===0){unit.retired=true;unit.release();}});return unit.value;}
/** The native worker restores private buffers and uses the same authored stock,
 * fold hierarchy, print shading and full96-segment paper deformation as GL. */
export async function prepareStickerPackRenderFrame(frame:NativePackFrame,environment:Texture|null,signal:AbortSignal,previous?:PackRenderResources){
 const resources:PackRenderResources={geometry:new Map(),damage:new Map(),artwork:new Map(),retired:false};
 const owners:(()=>void)[]=[],pending:(()=>void)[]=[];let disposed=false,root:Object3D|null=null;
 const dispose=()=>{if(disposed)return;disposed=true;resources.retired=true;for(const cancel of pending.splice(0))cancel();root?.removeFromParent();root?.clear();for(const retire of owners.splice(0).reverse())retire();resources.geometry.clear();resources.damage.clear();resources.artwork.clear();};
 const pendingImages=new Set(frame.artworks.map(art=>art.bitmap.image));owners.push(()=>{for(const image of pendingImages)image.close();pendingImages.clear();});
 for(const resource of [...frame.geometry,...frame.damage])owners.push(()=>resource.port.close());
 const receive=<T>(port:MessagePort,id:number,field:'value'|'result')=>new Promise<T>((resolve,reject)=>{
  let done=false;
  const finish=(error?:Error,value?:T)=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);port.onmessage=null;port.onmessageerror=null;if(error)reject(error);else if(value!==undefined)resolve(value);else reject(new Error('Missing pack resource'));};
  const abort=()=>finish(new DOMException('Pack generation retired','AbortError'));
  const timer=setTimeout(()=>finish(new Error('Native pack resource delivery timed out')),15000);
  pending.push(abort);signal.addEventListener('abort',abort,{once:true});
  port.onmessage=({data}:MessageEvent<{version:number;id:number;value?:T;result?:T}>)=>data.version===1&&data.id===id?finish(undefined,data[field]):finish(new Error('Pack resource identity mismatch'));
  port.onmessageerror=()=>finish(new Error('Pack resource decode failed'));port.start();if(signal.aborted)abort();
 });
 try{
  if(frame.geometry.length+(frame.reuse?.geometry.length??0)>32||frame.damage.length+(frame.reuse?.damage.length??0)>32||frame.artworks.length+(frame.reuse?.artworks.length??0)>32||frame.prints.length>32)throw new Error('Native pack resource capacity exceeded');
  const geometries=new Map<string,Record<string,BufferGeometry>>(),damage=new Map<number,{result:StickerRenderDamage;texture:DataTexture}>(),textures=new Map<string,Texture>();
  if(frame.reuse){
   if((frame.reuse.geometry.length||frame.reuse.damage.length||frame.reuse.artworks.length)&&(!previous||previous.retired))throw new Error('Native packet reuse has no live renderer owner');
   for(const item of frame.reuse.geometry){const value=previous?.geometry.get(item.key);if(!value||value.id!==item.id)throw new Error('Native packet geometry reuse identity mismatch');resources.geometry.set(item.key,value);geometries.set(item.key,retainGpu(value.unit,owners));}
   for(const id of frame.reuse.damage){const unit=previous?.damage.get(id);if(!unit)throw new Error('Native packet damage reuse identity mismatch');resources.damage.set(id,unit);damage.set(id,retainGpu(unit,owners));}
   for(const id of frame.reuse.artworks){const unit=previous?.artwork.get(id);if(!unit)throw new Error('Native packet artwork reuse identity mismatch');resources.artwork.set(id,unit);textures.set(id,retainGpu(unit,owners));}
  }
  await Promise.all([
   ...frame.geometry.map(async item=>{
    const value=await receive<StickerPackGeometryData>(item.port,item.id,'value');if(disposed)throw new Error('Packet candidate retired');if(geometries.has(item.key))throw new Error('Duplicate pack geometry');
    const parts:Record<string,BufferGeometry>={};const unit=gpuResource(parts,()=>{for(const geometry of Object.values(parts))geometry.dispose();});retainGpu(unit,owners);resources.geometry.set(item.key,{id:item.id,unit});geometries.set(item.key,parts);for(const [key,wire]of Object.entries(value.parts))parts[key]=restoreShell(wire);
   }),
   ...frame.damage.map(async item=>{
    const result=await receive<StickerRenderDamage>(item.port,item.id,'result');if(disposed)throw new Error('Packet candidate retired');if(result.kind!=='render-damage'||damage.has(item.id))throw new Error('Invalid pack damage');
    const texture=new DataTexture(result.gpu,result.width,result.height,RedFormat);texture.minFilter=NearestFilter;texture.magFilter=NearestFilter;texture.flipY=false;texture.generateMipmaps=false;texture.needsUpdate=true;
    const unit=gpuResource({result,texture},()=>texture.dispose());resources.damage.set(item.id,unit);damage.set(item.id,retainGpu(unit,owners));
   }),
  ]);pending.length=0;signal.throwIfAborted();
  for(const art of frame.artworks){if(textures.has(art.id))throw new Error('Duplicate pack artwork');const texture=restoreDeviceFontTexture(art.bitmap),unit=gpuResource(texture,()=>{texture.dispose();art.bitmap.image.close();});pendingImages.delete(art.bitmap.image);resources.artwork.set(art.id,unit);textures.set(art.id,retainGpu(unit,owners));}
  const roughness=createStickerRoughness();owners.push(()=>roughness.dispose());
  const objects=new Map<string,Object3D>(),curls=new Map<string,ReturnType<typeof installPaperNodes>[]>();
  const ownedMaterial=<T extends Material>(material:T):T=>{owners.push(()=>material.dispose());return material;};
  const required=(key:string,part='geometry')=>{const result=geometries.get(key)?.[part];if(!result)throw new Error(`Missing native pack geometry ${part}`);return result;};
  root=createStickerPackGraph(frame.recipe,node=>{
   const group=new Group();objects.set(node.id,group);
   if(node.kind==='paper'){
    const input={...node.size,liner:node.liner},key=stickerPackGeometryKey({kind:'gpu-paper',...input}),recipe=stickerPackPaperMaterials(node.size,node.ink,node.liner);
    const materials={front:ownedMaterial(new MeshPhysicalNodeMaterial({...recipe.front,roughnessMap:roughness,bumpMap:roughness,envMap:environment})),back:ownedMaterial(new MeshStandardNodeMaterial(recipe.back)),edge:ownedMaterial(new MeshStandardNodeMaterial(recipe.edge))};
    const controls=[];for(const part of ['back','edge','front']as const){const control=installPaperNodes(materials[part],input,part==='edge');control.setCurl(node.curl);controls.push(control);const mesh=new Mesh(required(key,part),materials[part]);mesh.frustumCulled=false;mesh.raycast=()=>{};group.add(mesh);}curls.set(node.id,controls);
   }else if(node.kind==='sleeve'){
    const recipe=stickerPackSleeveMaterials(node.size.pixel,node.ink),exterior=ownedMaterial(new MeshPhysicalNodeMaterial({...recipe.exterior,roughnessMap:roughness,bumpMap:roughness,envMap:environment}));
    const pocket=[exterior,ownedMaterial(new MeshStandardNodeMaterial(recipe.cut)),ownedMaterial(new MeshStandardNodeMaterial(recipe.interior))];
    for(const part of stickerPackSleeveParts(node.size)){const mesh=new Mesh(required(stickerPackGeometryKey(part.geometry)),part.material==='pocket'?pocket:exterior);mesh.position.fromArray(part.position);mesh.rotation.set(...part.rotation);mesh.raycast=()=>{};group.add(mesh);}
   }else{
    const print=frame.prints.find(item=>item.key===node.id);if(!print)throw new Error('Missing native pack print');const result=damage.get(print.damageResource),map=textures.get(print.artwork);if(!result||result.result.stickerId!==print.id||!map)throw new Error('Incomplete native pack print');
    const field=result.texture;
    const materials=createStickerNodeMaterials({id:print.id,map,roughness,environment,finishEnabled:print.finishEnabled,appearance:print.appearance,wear:print.wear,damage:{id:print.id,texture:field}});owners.push(()=>materials.dispose());
    group.name=`sticker-print-${print.id}`;for(const [name,material]of [['sticker',materials.front],['sticker-backing',materials.back]]as const){const mesh=new Mesh(required(print.geometryKey),material);mesh.name=`${name}-${print.id}`;mesh.renderOrder=print.renderOrder;mesh.raycast=()=>{};group.add(mesh);}
   }return group;
  });
  const index=(node:StickerPackNode,object:Object3D)=>{objects.set(node.id,object);if(node.kind==='group')for(const [i,child]of node.children.entries()){const objectChild=object.children[i];if(!objectChild)throw new Error('Pack graph mismatch');index(child,objectChild);}};index(frame.recipe,root);
  return {root,resources,dispose,update(recipe:StickerPackNode){const visit=(node:StickerPackNode)=>{const object=objects.get(node.id);if(!object)throw new Error('Pack pose resource mismatch');object.position.set(...(node.position??[0,0,0]));object.rotation.set(...(node.rotation??[0,0,0]));object.visible=node.visible??true;if(node.kind==='paper')for(const control of curls.get(node.id)??[])control.setCurl(node.curl);if(node.kind==='group')for(const child of node.children)visit(child);};visit(recipe);}};
 }catch(error){dispose();throw error;}
}
