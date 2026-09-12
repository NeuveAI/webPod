import type { Texture } from 'three';
import { preparePackGeometry, acquirePrivatePaperPackGeometry } from '../../device/src/sticker-pack-resources';
import { stickerPackGeometryKey, stickerPackSleeveParts, type StickerPackGeometryInput, type StickerPackNode } from '../../device/src/sticker-pack-recipe';
import { stickerPackLeafSlots } from '../../device/src/sticker-pack-graph';
import { preparePrint } from '../../device/src/sticker-prepared-damage';
import { preparedStickerResources } from '../../device/src/sticker-transaction-client';
import { inspectStickerTransactions, acquirePrivateStickerTransaction } from '../../device/src/sticker-transaction-broker';
import type { DeviceStickerScene } from '../../device/src/sticker-contract';
import { acquireArtwork, snapshotArtwork, type NativeStickerArtwork, type NativeStickerPrint, type NativeStickerResourcePort } from './native-sticker-resources';
export interface NativePackResourcePort {readonly key:string;readonly id:number;readonly port:MessagePort}
export interface NativePackPrint extends Omit<NativeStickerPrint,'geometryResource'> {readonly key:string;readonly geometryKey:string}
export interface NativePackFrame {
 readonly key:string;readonly recipe:StickerPackNode;readonly geometry:readonly NativePackResourcePort[];
 readonly reuse?:{readonly geometry:readonly {key:string;id:number}[];readonly damage:readonly number[];readonly artworks:readonly string[]};
 readonly damage:readonly NativeStickerResourcePort[];readonly artworks:readonly NativeStickerArtwork[];readonly prints:readonly NativePackPrint[];
}
/** Matrix/curl updates do not allocate geometry, copy artwork or compile shader
 * programs. This signature includes only actual resource/material identity. */
export function nativePackResourceKey(recipe:StickerPackNode,scene:DeviceStickerScene):string {
 return JSON.stringify(stickerPackLeafSlots(recipe).map(({node})=>node.kind==='print'
  ? [node.id,node.geometryKey,node.appearance,node.wear,scene.assets.find(art=>art.id===node.artId)?.url,scene.finishEnabled!==false]
  : [node.id,node.kind,node.size,node.ink,node.kind==='paper'?node.liner:null]));
}
interface Shared<T>{readonly value:T;readonly release:()=>void;references:number;retired:boolean}
function shared<T>(value:T,release:()=>void):Shared<T>{return{value,release,references:0,retired:false};}
function retain<T>(value:Shared<T>,owners:(()=>void)[]):T{if(value.retired)throw new Error('Retired native pack resource');value.references++;let released=false;owners.push(()=>{if(released)return;released=true;if(--value.references===0){value.retired=true;value.release();}});return value.value;}
type QueryGeometry=Awaited<ReturnType<typeof preparePackGeometry>>;
type QueryPrint=Awaited<ReturnType<typeof preparePrint>>;
interface RenderPort {readonly id:number;readonly port:MessagePort;transferred:boolean}
interface ArtworkOwner {readonly id:string;readonly bitmap:NativeStickerArtwork['bitmap'];readonly bytes:number;transferred:boolean}
export interface NativePackResourceCache {
 readonly owner:object;readonly layout:readonly number[]|null;retired:boolean;
 readonly geometry:Map<string,{query:Shared<QueryGeometry>;render:Shared<RenderPort>}>;
 readonly prints:Map<string,Shared<QueryPrint>>;
 readonly damage:Map<string,Shared<RenderPort>>;
 readonly artwork:Map<string,{query:Shared<{texture:Texture;release:()=>void}>;render:Shared<ArtworkOwner>}>;
}
let artworkSequence=0;
export async function prepareNativePackFrame(recipe:StickerPackNode,scene:DeviceStickerScene,signal:AbortSignal,options?:{readonly prepareContours?:boolean;readonly materialOnly?:boolean;readonly owner?:object;readonly reuseFrom?:NativePackResourceCache}) {
 const owner=options?.owner??{},previous=options?.reuseFrom;
 if(options?.materialOnly&&(options.prepareContours!==false||previous))throw new Error('Material-only capture cannot retain visible queries');
 if(previous&&(previous.owner!==owner||previous.retired))throw new Error('Native pack reuse crossed renderer ownership');
 const paper=stickerPackLeafSlots(recipe).find(({node})=>node.kind==='paper')?.node;
 const layout=paper?.kind==='paper'?[paper.size.width,paper.size.height,paper.size.pixel]:null;
 const cache:NativePackResourceCache={owner,layout,retired:false,geometry:new Map(),prints:new Map(),damage:new Map(),artwork:new Map()};
 const geometry:NativePackResourcePort[]=[],damage:NativeStickerResourcePort[]=[],artworks:NativeStickerArtwork[]=[],prints:NativePackPrint[]=[];
 const reuse:{geometry:{key:string;id:number}[];damage:number[];artworks:string[]}={geometry:[],damage:[],artworks:[]};
 const owners:(()=>void)[]=[],queryOwners:(()=>void)[]=[],prepared=new Map<string,QueryGeometry>(),queryPrints=new Map<string,QueryPrint>();
 const transferOwners=new Set<RenderPort|ArtworkOwner>();
 let disposed=false,bytes=0,printIndex=0,queryPeakBytes=0,queryCaptureBytes=0;
 const measureQueries=()=>{const buffers=new Set<ArrayBufferLike>();for(const resource of prepared.values())for(const geometry of Object.values(resource.parts)){for(const attribute of Object.values(geometry.attributes))buffers.add(attribute.array.buffer);if(geometry.index)buffers.add(geometry.index.array.buffer);}for(const print of queryPrints.values()){const field=print.damage.field;for(const array of [field.alpha,field.onset,field.boundaryCandidates,field.distance])if(array)buffers.add(array.buffer);const data=print.damage.texture.image.data;if(!ArrayBuffer.isView(data))throw new Error('Invalid warmup damage storage');buffers.add(data.buffer);}return [...buffers].reduce((sum,buffer)=>sum+buffer.byteLength,0);};
 const releaseQueries=()=>{for(const retire of queryOwners.splice(0).reverse())retire();prepared.clear();queryPrints.clear();cache.prints.clear();cache.geometry.clear();cache.artwork.clear();};
 const release=()=>{if(disposed)return;disposed=true;cache.retired=true;releaseQueries();for(const retire of owners.splice(0).reverse())retire();cache.geometry.clear();cache.damage.clear();cache.artwork.clear();transferOwners.clear();};
 const obtainGeometry=async(input:StickerPackGeometryInput)=>{
  const key=stickerPackGeometryKey(input),existing=prepared.get(key);if(existing)return existing;
  let unit=previous?.geometry.get(key);
  if(unit&&(unit.query.retired||unit.render.retired))unit=undefined;
  if(!unit){
   const main=await preparePackGeometry(input,signal),channel=new MessageChannel();
   try{const lease=await acquirePrivatePaperPackGeometry(input,channel.port1,signal);unit={query:shared(main,main.release),render:shared({id:lease.resourceId,port:channel.port2,transferred:false},()=>{channel.port2.close();lease.release();})};}
   catch(error){main.release();channel.port1.close();channel.port2.close();throw error;}
  }
  cache.geometry.set(key,unit);const main=retain(unit.query,queryOwners),wire=retain(unit.render,owners);transferOwners.add(wire);prepared.set(key,main);
  if(wire.transferred)reuse.geometry.push({key,id:wire.id});else geometry.push({key,id:wire.id,port:wire.port});
  return main;
 };
 try{
  const slots=stickerPackLeafSlots(recipe);if(options?.materialOnly&&slots.some(({node})=>node.kind!=='print'))throw new Error('Material-only capture requires print leaves');if(slots.length>32)throw new Error('Native pack leaf capacity exceeded');
  for(const {node,visible}of slots){signal.throwIfAborted();
   if(node.kind==='paper'){await obtainGeometry({kind:'gpu-paper',...node.size,liner:node.liner});continue;}
   if(node.kind==='sleeve'){for(const part of stickerPackSleeveParts(node.size))await obtainGeometry(part.geometry);continue;}
   const art=scene.assets.find(item=>item.id===node.artId);if(!art)throw new Error('Native pack artwork missing');
   const artKey=JSON.stringify(art);let artUnit=cache.artwork.get(artKey);
   if(!artUnit){
    artUnit=previous?.artwork.get(artKey);if(artUnit&&(artUnit.query.retired||artUnit.render.retired))artUnit=undefined;
    if(!artUnit){const acquired=await acquireArtwork(art,signal);try{const bitmap=await snapshotArtwork(acquired.texture,signal,64*1024*1024-bytes);const wire:ArtworkOwner={id:`pack-art-${++artworkSequence}`,bitmap,bytes:bitmap.image.width*bitmap.image.height*4,transferred:false};artUnit={query:shared(acquired,acquired.release),render:shared(wire,()=>{if(!wire.transferred)bitmap.image.close();})};}catch(error){acquired.release();throw error;}}
    cache.artwork.set(artKey,artUnit);retain(artUnit.query,queryOwners);const wire=retain(artUnit.render,owners);transferOwners.add(wire);bytes+=wire.bytes;if(bytes>64*1024*1024)throw new Error('Native pack artwork capacity exceeded');
    if(wire.transferred)reuse.artworks.push(wire.id);else artworks.push({id:wire.id,bitmap:wire.bitmap});
   }
   const texture=artUnit.query.value.texture,mesh=await obtainGeometry(node.geometry),surface=mesh.parts['geometry'];if(!surface)throw new Error('Native parked-print geometry missing');
   printIndex++;const wear=node.appearance==='earned'?node.wear:0,printKey=JSON.stringify([artKey,node.geometryKey,wear,options?.prepareContours!==false]);
   let printUnit=cache.prints.get(printKey);
   if(!printUnit){printUnit=previous?.prints.get(printKey);if(printUnit?.retired)printUnit=undefined;if(!printUnit){const print=await preparePrint({texture,id:art.id,geometry:surface,wearGeometry:surface,wear},signal,{prepareContour:options?.prepareContours!==false,reuseDamage:[...new Map([...cache.prints.values(),...(previous?.prints.values()??[])].filter(value=>!value.retired).flatMap(value=>preparedStickerResources(value.value.geometry)).filter(value=>value.input.kind==='damage').map(value=>[value.key,value])).values()]});printUnit=shared(print,print.release);}cache.prints.set(printKey,printUnit);retain(printUnit,queryOwners);}
   const print=printUnit.value;queryPrints.set(node.id,print);
   const descriptor=preparedStickerResources(print.geometry).find(item=>item.input.kind==='damage');if(!descriptor)throw new Error('Native parked-print damage missing');
   let damageUnit=cache.damage.get(descriptor.key);
   if(!damageUnit){
    damageUnit=previous?.damage.get(descriptor.key);if(damageUnit?.retired)damageUnit=undefined;
    if(!damageUnit){const channel=new MessageChannel();try{const lease=await acquirePrivateStickerTransaction(descriptor.key,descriptor.input,channel.port1,signal,{purpose:'render-damage'});damageUnit=shared({id:lease.resourceId,port:channel.port2,transferred:false},()=>{channel.port2.close();lease.release();});}catch(error){channel.port1.close();channel.port2.close();throw error;}}
    cache.damage.set(descriptor.key,damageUnit);const wire=retain(damageUnit,owners);transferOwners.add(wire);if(wire.transferred)reuse.damage.push(wire.id);else damage.push({id:wire.id,port:wire.port});
   }
   prints.push({key:node.id,id:art.id,geometryKey:mesh.key,damageResource:damageUnit.value.id,artwork:artUnit.render.value.id,wear:print.wear,visible,renderOrder:node.renderOrder,appearance:node.appearance,finishEnabled:scene.finishEnabled!==false});
   if(options?.materialOnly){const queryBytes=measureQueries();queryPeakBytes=Math.max(queryPeakBytes,queryBytes);queryCaptureBytes+=queryBytes;releaseQueries();}
  }
  signal.throwIfAborted();const frame:NativePackFrame={key:nativePackResourceKey(recipe,scene),recipe,geometry,damage,artworks,prints,reuse};
  return{frame,cache,release,releaseQueries,prepared,queryPrints,queryPeakBytes,queryCaptureBytes,transferred(){for(const wire of transferOwners)wire.transferred=true;}};
 }catch(error){const usage=inspectStickerTransactions();release();if(error instanceof Error&&error.message.includes('capacity')){
  // Layout is exact width/height/pixel; canonical recipe and catalogue recover
  // print width/bow without embedding artwork objects. Slot array index is ID.
  const slots=stickerPackLeafSlots(recipe).flatMap(({node})=>node.kind==='print'?[[node.artId,node.appearance==='earned'?0:node.appearance==='locked'?1:2,node.wear]]:[]);
  throw new Error(`pack capacity ${JSON.stringify({p:printIndex,old:previous?.layout??null,next:layout,ids:scene.prepareIds??[],placed:scene.placements.map(value=>[value.stickerId,value.wear??0]),s:slots,b:[usage.entries,usage.privateOwners,usage.privateBytes,usage.accountedBytes]})}`,{cause:error});
 }throw error;}
}
