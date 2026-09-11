import {Group,Mesh,MeshPhysicalMaterial,type Texture} from 'three';
import {createCarryPreparation,type CarryFrame} from '../../device/src/sticker-carry-preparation';
import type {createStickerVisibility} from '../../device/src/sticker-visibility';
import type {createDeviceQueryView} from '../../device/src/device-query-view';
import type {DeviceStickerScene} from '../../device/src/sticker-contract';
import type {RenderLayout} from '../../device/src/device-render-protocol';
import {setStickerMaterialDamage} from '../../device/src/sticker-alpha';
import {nativeCarryInput} from './native-carry-input';
import {prepareNativeCarryFrame,type NativeCarryFrameMessage} from './native-carry-resources';
import {acquireArtwork,snapshotArtwork} from './native-sticker-resources';
export interface NativeCarryState {readonly epoch:number;readonly assemblyRevision:number;readonly active:boolean;readonly id:string|null;readonly source:'equipped'|'pack';readonly handoff:'equipped'|'pack'|'none'}
export function createNativeCarryController(input:{readonly canvas:HTMLCanvasElement;readonly layout:()=>RenderLayout;readonly query:ReturnType<typeof createDeviceQueryView>;readonly visibility:ReturnType<typeof createStickerVisibility>;readonly sendState:(state:NativeCarryState)=>void;readonly sendFrame:(message:NativeCarryFrameMessage,transfer:Transferable[])=>void;readonly onProjection:()=>void;readonly fail:(error:unknown)=>void}){
 type Candidate=Awaited<ReturnType<typeof prepareNativeCarryFrame>>;
 const runtime=createCarryPreparation({renderer:true}),unmount=runtime.mount(),artworks=new Map<string,{texture:Texture;release:()=>void;sent:boolean}>();
 let disposed=false,latest:DeviceStickerScene|null=null,epoch=0,owner='',active=false,id:string|null=null,source:'equipped'|'pack'='pack',requestKey='',sequence=0,artworkBytes=0;
 let candidateEpoch=0,lastAssemblyRevision=-1,lastOffered:CarryFrame|null=null;
 let pending:CarryFrame|null=null,current:Candidate|null=null,candidate:Candidate|null=null,working=false,waiting=false,controller:AbortController|null=null,deadline:ReturnType<typeof setTimeout>|null=null;
 let packetOpen=false,primeEligible=false,primedRevision=-1;
 const hidden=()=>{if(document.hidden)primeEligible=false;};
 document.addEventListener('visibilitychange',hidden);
 let queryRoot:Group|null=null,queryMaterial:MeshPhysicalMaterial|null=null,borrowed:Mesh|null=null;
 const clearQuery=()=>{queryRoot?.removeFromParent();queryRoot?.clear();queryRoot=null;queryMaterial?.dispose();queryMaterial=null;borrowed=null;};
 const borrowSource=()=>{
  if(!active||current||!id)return;
  const sourceRoot=input.query.scene.getObjectByName(source==='equipped'?'device-equipped-stickers':'sticker-pack-wrapper'),mesh=sourceRoot?.getObjectByName(`sticker-${id}`);
  if(!(mesh instanceof Mesh))return;mesh.updateWorldMatrix(true,false);
  if(!borrowed){clearQuery();queryRoot=new Group();queryRoot.name='device-carried-sticker';borrowed=new Mesh(mesh.geometry,mesh.material);borrowed.name=mesh.name;borrowed.matrixAutoUpdate=false;borrowed.raycast=()=>{};queryRoot.add(borrowed);input.query.scene.add(queryRoot);}
  borrowed.matrix.copy(mesh.matrixWorld);borrowed.matrixWorldNeedsUpdate=true;borrowed.updateWorldMatrix(true,false);
 };
 const adoptQuery=(value:Candidate)=>{
  clearQuery();queryRoot=new Group();queryRoot.name='device-carried-sticker';queryMaterial=new MeshPhysicalMaterial({map:value.print.texture,transparent:true,depthWrite:false});setStickerMaterialDamage(queryMaterial,value.print.damage);
  const mesh=new Mesh(value.print.geometry,queryMaterial);mesh.name=`sticker-${id}`;mesh.raycast=()=>{};queryRoot.add(mesh);input.query.scene.add(queryRoot);queryRoot.updateWorldMatrix(true,true);input.onProjection();
 };
 const pump=async()=>{
  if(disposed||working||waiting||!pending||!latest||!active)return;
  const frame=pending;pending=null;working=true;const expected=epoch,scene=latest,job=new AbortController();controller=job;
  const timer=setTimeout(()=>job.abort(new Error('Native carry print preparation timed out')),45000);
  let prepared:Candidate|null=null,untransferred:ImageBitmap|null=null;
  try{
   let artwork=artworks.get(frame.input.art.url);
   if(!artwork){if(artworks.size>=32)throw new Error('Native carry artwork capacity exceeded');const lease=await acquireArtwork(frame.input.art,job.signal);artwork={...lease,sent:false};artworks.set(frame.input.art.url,artwork);}
   const value=await prepareNativeCarryFrame({frame,runtime,texture:artwork.texture,wear:frame.input.pack.placement?.wear??frame.input.pack.sourcePlacement?.wear??scene.appearances?.find(item=>item.stickerId===frame.input.art.id)?.wear??0},job.signal);prepared=value;
   if(disposed||expected!==epoch||!active||value.stamp.assemblyRevision!==input.visibility.revision)return;
   let bitmap=null;
   if(!artwork.sent){bitmap=await snapshotArtwork(artwork.texture,job.signal,64*1024*1024-artworkBytes);untransferred=bitmap.image;}
   job.signal.throwIfAborted();if(disposed||expected!==epoch||!active||value.stamp.assemblyRevision!==input.visibility.revision)return;
   candidate=value;candidateEpoch=expected;waiting=true;sequence++;
   const message:NativeCarryFrameMessage={sequence,epoch:expected,stamp:value.stamp,geometry:value.geometry,id:frame.input.art.id,artworkKey:frame.input.art.url,artwork:bitmap?{id:frame.input.art.url,bitmap}:null,damage:value.damage,wear:value.print.wear,finishEnabled:scene.finishEnabled!==false};
   const bitmapBytes=bitmap?bitmap.image.width*bitmap.image.height*4:0;
   try{input.sendFrame(message,[value.geometry,value.damage.port,...(bitmap?[bitmap.image]:[])]);artwork.sent=true;artworkBytes+=bitmapBytes;untransferred=null;prepared=null;}
   catch(error){candidate=null;waiting=false;throw error;}
   deadline=setTimeout(()=>input.fail(new Error('Native carry adoption timed out')),45000);
  }catch(error){if(!disposed&&expected===epoch&&frame.renderStamp?.assemblyRevision===input.visibility.revision)input.fail(error);}finally{untransferred?.close();prepared?.release();clearTimeout(timer);controller=null;working=false;if(!disposed)void pump();}
 };
 const request=()=>{
  if(disposed||!latest)return;
  const pack=latest.pack,open=!!pack&&pack.progress>0&&(pack.presence??1)>0&&pack.workspaceVisible!==false;
  if(open&&!packetOpen&&!document.hidden){primeEligible=true;primedRevision=-1;}
  packetOpen=open;if(!open)primeEligible=false;
  if(primeEligible&&!document.hidden){
   input.visibility.update(input.query.content);
   if(input.visibility.ready&&primedRevision!==input.visibility.revision){primedRevision=input.visibility.revision;runtime.primeContext(input.query.rear.geometry,input.visibility);}
  }
  const value=nativeCarryInput(latest,input.layout(),input.query);
  if(!value){if(active){active=false;requestKey='';pending=null;epoch++;owner='';input.sendState({epoch,assemblyRevision:input.visibility.revision,active:false,id,source,handoff:id&&latest.placements.some(item=>item.stickerId===id)?'equipped':id&&latest.pack?.sheet?.slots.some(item=>item.stickerId===id)?'pack':'none'});}return;}
  const nextOwner=JSON.stringify([value.pack.computationEpoch,value.art.id,value.pack.sourcePlacement??null]);
  if(!active||nextOwner!==owner){active=true;owner=nextOwner;epoch++;id=value.art.id;source=value.pack.sourcePlacement?'equipped':'pack';input.sendState({epoch,assemblyRevision:input.visibility.revision,active:true,id,source,handoff:'none'});borrowSource();}
  input.visibility.update(input.query.content);if(!input.visibility.ready)return;
  if(lastAssemblyRevision!==input.visibility.revision){lastAssemblyRevision=input.visibility.revision;input.sendState({epoch,assemblyRevision:lastAssemblyRevision,active:true,id,source,handoff:'none'});}
  const key=JSON.stringify([value,input.visibility.revision]);if(key===requestKey)return;requestKey=key;runtime.request(value,input.query.rear.geometry,input.visibility);borrowSource();
 };
 const unsubscribe=runtime.subscribe(()=>{const snapshot=runtime.getSnapshot();if(snapshot.error){input.fail(new Error(snapshot.error));return;}if(snapshot.frame&&snapshot.frame!==lastOffered&&active&&snapshot.frame.input.pack.computationEpoch===latest?.pack?.computationEpoch&&snapshot.frame.input.art.id===id){lastOffered=snapshot.frame;pending=snapshot.frame;void pump();}});
 const unsubscribeVisibility=input.visibility.subscribe(request);
 return{update(scene:DeviceStickerScene){latest=scene;request();},project:request,
  acknowledge(received:number,accepted:boolean){if(disposed||received!==sequence||!candidate)return;if(deadline!==null)clearTimeout(deadline);deadline=null;waiting=false;const value=candidate;candidate=null;if(accepted&&active&&candidateEpoch===epoch&&value.stamp.assemblyRevision===input.visibility.revision){adoptQuery(value);current?.release();current=value;runtime.commit();if(id)latest?.onArtworkReady?.(id);latest?.onSurfaceReady?.();}else{value.release();runtime.commit();}void pump();},
  cleared(receivedEpoch:number){if(disposed||receivedEpoch!==epoch)return;clearQuery();current?.release();current=null;runtime.commit();input.onProjection();},
  dispose(){if(disposed)return;disposed=true;active=false;pending=null;controller?.abort();if(deadline!==null)clearTimeout(deadline);unsubscribe();unsubscribeVisibility();document.removeEventListener('visibilitychange',hidden);unmount();clearQuery();},
  rendererRetired(){candidate?.release();candidate=null;current?.release();current=null;for(const artwork of artworks.values())artwork.release();artworks.clear();},
 };
}
