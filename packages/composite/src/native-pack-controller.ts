import {createNativePackQuery} from './native-pack-query';
import type {createDeviceQueryView} from '../../device/src/device-query-view';
import type {DeviceStickerScene} from '../../device/src/sticker-contract';
import type {RenderLayout} from '../../device/src/device-render-protocol';
import type {DeviceRenderWorkerRequest,DeviceRenderWorkerResponse} from '../../device/src/device-render-worker-protocol';
import {createLatestRenderChannel} from '../../device/src/render-channels';
import {nativePackRecipe} from './native-pack-layout';
import {nativePackResourceKey,prepareNativePackFrame} from './native-pack-resources';
export function createNativePackController(input:{readonly query:ReturnType<typeof createDeviceQueryView>;readonly onProjection:()=>void;readonly layout:()=>RenderLayout;readonly send:(request:Omit<Extract<DeviceRenderWorkerRequest,{type:'pack-pose'}>,'version'|'epoch'>|Omit<Extract<DeviceRenderWorkerRequest,{type:'pack-frame'}>,'version'|'epoch'>,transfer?:Transferable[])=>void;readonly fail:(error:unknown)=>void}){
 const resourceOwner={};
 type Resource=Awaited<ReturnType<typeof prepareNativePackFrame>>;
 let disposed=false,preparing=false,waiting=false,sequence=0,current:Resource|null=null,candidate:Resource|null=null;
 let latest:DeviceStickerScene|null=null,pending:DeviceStickerScene|null=null,controller:AbortController|null=null,deadline:ReturnType<typeof setTimeout>|null=null;
 let query:ReturnType<typeof createNativePackQuery>|null=null,inFlightPose:{notificationSequence:number;key:string;recipe:NonNullable<ReturnType<typeof nativePackRecipe>>}|null=null;
 const poses=createLatestRenderChannel<{key:string;recipe:NonNullable<ReturnType<typeof nativePackRecipe>>}>((notificationSequence,value)=>{inFlightPose={notificationSequence,...value};input.send({type:'pack-pose',notificationSequence,...value});});
 const pump=async()=>{
  if(disposed||preparing||waiting||!pending)return;
  const scene=pending;pending=null;const recipe=nativePackRecipe(scene,input.layout());if(!recipe)return;
  const key=nativePackResourceKey(recipe,scene);if(current?.frame.key===key)return;
  preparing=true;const job=new AbortController();controller=job;const timeout=setTimeout(()=>job.abort(new Error('Native pack preparation timed out')),45000);
  try{
   const prepared=await prepareNativePackFrame(recipe,scene,job.signal,{owner:resourceOwner,reuseFrom:current?.cache});if(disposed){prepared.release();return;}
   const latestRecipe=latest?nativePackRecipe(latest,input.layout()):null;
   if(!latest||!latestRecipe||nativePackResourceKey(latestRecipe,latest)!==key){prepared.release();return;}
   candidate=prepared;waiting=true;sequence++;
   input.send({type:'pack-frame',sequence,frame:{...prepared.frame,recipe:latestRecipe}},[...prepared.frame.geometry.map(item=>item.port),...prepared.frame.damage.map(item=>item.port),...prepared.frame.artworks.map(art=>art.bitmap.image)]);prepared.transferred();
   deadline=setTimeout(()=>input.fail(new Error('Native pack adoption timed out')),45000);
  }catch(error){if(!disposed)input.fail(error);}finally{clearTimeout(timeout);preparing=false;controller=null;if(!disposed)void pump();}
 };
 const update=(scene:DeviceStickerScene)=>{
  if(disposed)return;latest=scene;const recipe=nativePackRecipe(scene,input.layout());
  if(!recipe){if(current)poses.offer({key:current.frame.key,recipe:{...current.frame.recipe,visible:false}});return;}
  const key=nativePackResourceKey(recipe,scene);poses.offer({key,recipe});
  if(key!==current?.frame.key){pending=scene;void pump();}
 };
 return{update,layoutChanged(){if(latest)update(latest);},receive(message:Extract<DeviceRenderWorkerResponse,{type:'pack-frame-complete'|'pack-pose-consumed'}>){
  if(message.type==='pack-pose-consumed'){const submitted=inFlightPose;if(submitted?.notificationSequence!==message.notificationSequence)return;if(message.accepted&&submitted&&submitted.key===current?.frame.key){query?.update(submitted.recipe);input.onProjection();}poses.acknowledge(message.notificationSequence);return;}
  if(disposed||message.sequence!==sequence||!candidate)return;if(deadline!==null)clearTimeout(deadline);deadline=null;
  const frame=candidate;candidate=null;waiting=false;if(message.accepted){query?.dispose();query=createNativePackQuery(frame);if(message.recipe)query.update(message.recipe);input.query.scene.add(query.root);current?.release();current=frame;for(const print of frame.frame.prints)latest?.onArtworkReady?.(print.id);input.onProjection();}else frame.release();
  if(latest)update(latest);void pump();
 },dispose(){if(disposed)return;disposed=true;query?.dispose();query=null;pending=null;controller?.abort();poses.dispose();if(deadline!==null)clearTimeout(deadline);},rendererRetired(){candidate?.release();candidate=null;current?.release();current=null;}};
}
