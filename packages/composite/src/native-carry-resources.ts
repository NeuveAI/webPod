import type {Texture} from 'three';
import type {CarryFrame,createCarryPreparation} from '../../device/src/sticker-carry-preparation';
import type {CarryRenderStamp} from '../../device/src/sticker-carry-render-resources';
import {preparePrint} from '../../device/src/sticker-prepared-damage';
import {preparedStickerResources} from '../../device/src/sticker-transaction-client';
import {acquirePrivateStickerTransaction} from '../../device/src/sticker-transaction-broker';
import type {NativeStickerArtwork,NativeStickerResourcePort} from './native-sticker-resources';
export interface NativeCarryFrameMessage {
 readonly sequence:number;readonly epoch:number;readonly stamp:CarryRenderStamp;readonly geometry:MessagePort;
 readonly id:string;readonly artworkKey:string;readonly artwork:NativeStickerArtwork|null;
 readonly damage:NativeStickerResourcePort;readonly wear:number;readonly finishEnabled:boolean;
}
/** Acquire the exact completed carry output before preparing its print. The
 * existing carry authority pins both borrowed query geometry and private bytes
 * through renderer retirement; no main deformation or geometry clone occurs. */
export async function prepareNativeCarryFrame(input:{readonly frame:CarryFrame;readonly runtime:ReturnType<typeof createCarryPreparation>;readonly texture:Texture;readonly wear:number},signal:AbortSignal){
 const channel=new MessageChannel(),damageChannel=new MessageChannel();
 const owners:(()=>void)[]=[];let disposed=false;
 const release=()=>{if(disposed)return;disposed=true;channel.port1.close();channel.port2.close();damageChannel.port1.close();damageChannel.port2.close();for(const retire of owners.reverse())retire();};
 try{
  const resource=await input.runtime.acquireRendererFrame(input.frame,channel.port1,signal);owners.push(resource.release);
  const print=await preparePrint({texture:input.texture,id:input.frame.input.art.id,geometry:input.frame.geometry,wearGeometry:input.frame.wearGeometry,wear:input.wear},signal);owners.push(print.release);
  const descriptor=preparedStickerResources(print.geometry).find(item=>item.input.kind==='damage');if(!descriptor)throw new Error('Carry damage resource missing');
  const damage=await acquirePrivateStickerTransaction(descriptor.key,descriptor.input,damageChannel.port1,signal,{purpose:'render-damage'});owners.push(damage.release);
  return{stamp:resource.stamp,geometry:channel.port2,damage:{id:damage.resourceId,port:damageChannel.port2},print,release};
 }catch(error){release();throw error;}
}
