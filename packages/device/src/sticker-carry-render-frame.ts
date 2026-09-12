import {DataTexture,Group,Mesh,NearestFilter,RedFormat,type Texture} from 'three';
import {restorePaperGeometry} from './sticker-paper-transfer';
import {sameCarryRenderStamp,type CarryRenderPayload} from './sticker-carry-render-resources';
import {restoreDeviceFontTexture} from './device-font-assets';
import {createStickerNodeMaterials} from './sticker-material-nodes';
import {createStickerRoughness} from './sticker-textures';
import type {StickerRenderDamage} from './sticker-transaction-data';
import type {NativeCarryFrameMessage} from '../../composite/src/native-carry-resources';

export function closeNativeCarryFrame(message:NativeCarryFrameMessage):void {
 message.geometry.close();message.damage.port.close();message.artwork?.bitmap.image.close();
}
/** Renderer-local uploaded artwork ownership. This receives private bitmap
 * leases from the existing main cache; it never decodes or prepares artwork. */
export function createCarryArtworkOwner(){
 const entries=new Map<string,{texture:Texture;image:ImageBitmap}>();let bytes=0;
 return{adopt(message:NativeCarryFrameMessage):Texture{
  const cached=entries.get(message.artworkKey);
  if(message.artwork){
   if(cached){message.artwork.bitmap.image.close();throw new Error('Duplicate carry artwork delivery');}
   const image=message.artwork.bitmap.image,size=image.width*image.height*4;
   if(entries.size>=32||bytes+size>64*1024*1024){image.close();throw new Error('Carry artwork capacity exceeded');}
   let texture:Texture;try{texture=restoreDeviceFontTexture(message.artwork.bitmap);}catch(error){image.close();throw error;}
   entries.set(message.artworkKey,{texture,image});bytes+=size;return texture;
  }
  if(!cached)throw new Error('Carry artwork was not delivered');return cached.texture;
 },dispose(){for(const item of entries.values()){item.texture.dispose();item.image.close();}entries.clear();bytes=0;}};
}
export async function prepareCarryRenderFrame(message:NativeCarryFrameMessage,map:Texture,environment:Texture|null,signal:AbortSignal){
 const root=new Group();root.name='device-carried-sticker';const cleanups:(()=>void)[]=[],pending:(()=>void)[]=[];let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;for(const stop of pending.splice(0))stop();root.removeFromParent();root.clear();for(const stop of cleanups.reverse())stop();message.geometry.close();message.damage.port.close();};
 const receive=<T>(port:MessagePort,validate:(data:T)=>boolean)=>new Promise<T>((resolve,reject)=>{
  let settled=false;const finish=(data?:T,error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);port.onmessage=null;port.onmessageerror=null;if(error)reject(error);else if(data!==undefined)resolve(data);};
  const abort=()=>finish(undefined,new DOMException('Carry renderer retired','AbortError'));
  const timer=setTimeout(()=>finish(undefined,new Error('Carry private resource delivery timed out')),15000);pending.push(abort);signal.addEventListener('abort',abort,{once:true});
  port.onmessage=({data}:MessageEvent<T>)=>{if(!validate(data)){finish(undefined,new Error('Carry private resource identity mismatch'));return;}finish(data);};
  port.onmessageerror=()=>finish(undefined,new Error('Carry private resource could not decode'));port.start();if(signal.aborted)abort();
 });
 try{
  const [carry,resource]=await Promise.all([
   receive<CarryRenderPayload>(message.geometry,data=>data.version===1&&sameCarryRenderStamp(data.stamp,message.stamp)),
   receive<{version:number;id:number;result:StickerRenderDamage}>(message.damage.port,data=>data.version===1&&data.id===message.damage.id),
  ]);pending.length=0;signal.throwIfAborted();
  const damage=resource.result;if(damage.kind!=='render-damage'||damage.stickerId!==message.id)throw new Error('Carry damage identity mismatch');
  // The renderer artwork owner already adopted the transfer before checking
  // gesture admission, so a rejected frame cannot strand a later shared map.
  const geometry=restorePaperGeometry(carry.geometry);cleanups.push(()=>geometry.dispose());
  const roughness=createStickerRoughness();cleanups.push(()=>roughness.dispose());
  const texture=new DataTexture(damage.gpu,damage.width,damage.height,RedFormat);texture.minFilter=NearestFilter;texture.magFilter=NearestFilter;texture.flipY=false;texture.generateMipmaps=false;texture.needsUpdate=true;cleanups.push(()=>texture.dispose());
  const materials=createStickerNodeMaterials({id:message.id,map,roughness,environment,finishEnabled:message.finishEnabled,appearance:'earned',wear:message.wear,damage:{id:message.id,texture}});cleanups.push(()=>materials.dispose());
  const front=new Mesh(geometry,materials.front),back=new Mesh(geometry,materials.back);front.name=`sticker-${message.id}`;back.name=`sticker-backing-${message.id}`;front.renderOrder=4;back.renderOrder=4;front.raycast=()=>{};back.raycast=()=>{};root.add(front,back);
  return{root,dispose,stamp:message.stamp};
 }catch(error){dispose();throw error;}
}
