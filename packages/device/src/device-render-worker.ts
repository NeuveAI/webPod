import {createNativeCarryAdoption} from './native-carry-adoption';
import {prepareCarryRenderFrame,createCarryArtworkOwner,closeNativeCarryFrame} from './sticker-carry-render-frame';
import type {NativeCarryFrameMessage} from '../../composite/src/native-carry-resources';
import {prepareStickerWarmup} from './sticker-warmup-renderer';
import {prepareStickerPackRenderFrame} from './sticker-pack-render-frame';
import type {NativePackFrame} from '../../composite/src/native-pack-resources';
import type {StickerPackNode} from './sticker-pack-recipe';
import { closeStickerFrameMessage, prepareStickerRenderFrame, type NativeEquippedFrameMessage } from './sticker-render-frame';
import { AgXToneMapping, Group, Mesh, PerspectiveCamera, RectAreaLight, Scene } from 'three';
import { WebGPURenderer, RectAreaLightNode } from 'three/webgpu';
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js';
import { createRenderBackendOwner, createBackendStudioMaps } from './render-backend-services';
import { createNativeScreenTexture } from './native-element-image';
import { createDeviceAssemblyRecipe } from './device-assembly-recipe';
import { createDeviceAssemblyMaterials } from './device-assembly-materials';
import { createDeviceAssemblyGraph } from './device-assembly-graph';
import { createDeviceLightRecipe } from './device-light-recipe';
import { restoreDeviceFontTexture, disposeDeviceFontAssets } from './device-font-assets';
import { restorePreparedDevice, disposePreparedDevice, type PreparedDeviceRenderLease } from './device-preparation-data';
import { completeDeviceEnvelope } from './device-envelope';
import { DEVICE_LAYOUT } from './layout';
import { createLcdNodeMaterial } from '../../composite/src/lcd-material-nodes';
import { createLatestRenderChannel } from './render-channels';
import { createDeviceMotionDriver } from './device-motion-driver';
import type { RenderPose, RenderProjection } from './device-render-protocol';
import type { DeviceRenderWorkerRequest, DeviceRenderWorkerResponse } from './device-render-worker-protocol';

let epoch = 0, retired = false;
let accept: ((message: DeviceRenderWorkerRequest) => void) | null = null;
let release: (() => void) | null = null;
const send = (message: DeviceRenderWorkerResponse) => self.postMessage(message);
function closeIncoming(message:DeviceRenderWorkerRequest):void {
 if(message.type==='paint')message.image.close();
 else if(message.type==='equipped-frame')closeStickerFrameMessage(message.frame);
 else if(message.type==='carry-frame')closeNativeCarryFrame(message.frame);
 else if(message.type==='pack-frame'||message.type==='warmup-frame'){for(const resource of [...message.frame.geometry,...message.frame.damage])resource.port.close();for(const artwork of message.frame.artworks)artwork.bitmap.image.close();}
}
function fail(error: unknown) {
  if (retired) return;
  retired = true; release?.(); accept = null;
  send({ type: 'failed', version: 1, epoch, stage: 'render', message: error instanceof Error ? error.message : String(error) });
}

async function initialize(input: Extract<DeviceRenderWorkerRequest, { type: 'initialize' }>) {
  epoch = input.epoch;
  const abort = new AbortController(), cleanups: (() => void)[] = [];
  release = () => { abort.abort(); for (const cleanup of cleanups.splice(0).reverse()) cleanup(); };
  cleanups.push(() => input.resources.close(), () => disposeDeviceFontAssets(input.fonts));
  const renderer = new WebGPURenderer({ canvas: input.canvas, antialias: true, alpha: true });
  const previousDeviceLost=renderer.onDeviceLost;
  renderer.onDeviceLost=info=>{previousDeviceLost.call(renderer,info);fail(new Error('Native GPU device lost'));};
  renderer.toneMapping = AgXToneMapping; renderer.toneMappingExposure = 1;
  const backend = createRenderBackendOwner({ kind: 'webgpu', renderer }); cleanups.push(() => backend.dispose());
  const prepared = new Promise<PreparedDeviceRenderLease>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Prepared renderer resources timed out')), 15000);
    cleanups.push(() => clearTimeout(timer));
    input.resources.onmessage = (event: MessageEvent<PreparedDeviceRenderLease>) => { clearTimeout(timer); resolve(event.data); };
    input.resources.onmessageerror = () => reject(new Error('Prepared renderer resources could not decode'));
    input.resources.start();
  });
  // Resource and initialization errors are observed immediately, even when the
  // other branch stalls. Backend owner guards late initialization disposal.
  const [lease] = await Promise.all([prepared, backend.initialize(abort.signal)]);
  if (retired || abort.signal.aborted) return;
  const data = restorePreparedDevice(lease.result); cleanups.push(() => disposePreparedDevice(data));
  const scene = new Scene(), camera = new PerspectiveCamera();
  let resourceRevision = input.resourceRevision, sceneRevision = input.sceneRevision;
  let latestStickerEpoch = 0, stickerSequence = 0, preparingSticker=false;
  const carryArtworks=createCarryArtworkOwner();cleanups.push(()=>carryArtworks.dispose());
  let carry:Awaited<ReturnType<typeof prepareCarryRenderFrame>>|null=null;
  const carryAdoption=createNativeCarryAdoption();cleanups.push(()=>{carry?.dispose();carryAdoption.dispose();});
  const clearCarry=()=>{carry?.dispose();carry=null;send({type:'carry-cleared',version:1,epoch,carryEpoch:carryAdoption.read().epoch});};
  const completeCarryHandoff=(owner:'equipped'|'pack')=>{if(carryAdoption.handoff(owner))clearCarry();};
  let warmup:Awaited<ReturnType<typeof prepareStickerWarmup>>|null=null;
  cleanups.push(()=>warmup?.dispose());
  let pendingPackPoseAck:number|null=null;
  let pack:Awaited<ReturnType<typeof prepareStickerPackRenderFrame>>|null=null,packKey='',latestPackKey='',latestPackRecipe:StickerPackNode|null=null;
  cleanups.push(()=>pack?.dispose());
  let sceneUpdate:Promise<void>=Promise.resolve();
  let queuedSceneUpdates=0;
  const queuedResources=new Set<()=>void>();cleanups.push(()=>{for(const close of [...queuedResources])close();});
  const enqueueSceneUpdate=(work:()=>Promise<void>,message:DeviceRenderWorkerRequest)=>{
   if(queuedSceneUpdates>=4){closeIncoming(message);throw new Error('Native scene transaction capacity exceeded');}
   let owned=true;const close=()=>{if(!owned)return;owned=false;queuedResources.delete(close);closeIncoming(message);};queuedResources.add(close);queuedSceneUpdates++;
   sceneUpdate=sceneUpdate.then(async()=>{if(retired){close();return;}owned=false;queuedResources.delete(close);await work();}).catch(fail).finally(()=>{queuedSceneUpdates--;});
  };
  let equipped: Awaited<ReturnType<typeof prepareStickerRenderFrame>> | null = null;
  cleanups.push(() => equipped?.dispose());
  let raster=input.raster;
  let layout = input.layout, pose = input.pose, visible = true, painted = false, compiled = false, ready = false, visibilityRevision = input.raster.visibilityRevision;
  const applyLayout = () => {
    renderer.setPixelRatio(layout.pixelRatio); renderer.setSize(layout.cssWidth, layout.cssHeight, false);
    camera.matrixAutoUpdate = false; camera.matrix.fromArray(layout.cameraWorld); camera.matrixWorld.fromArray(layout.cameraWorld); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    camera.projectionMatrix.fromArray(layout.cameraProjection); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  };
  applyLayout();
  // Three's WebGPU backend configures its associated canvas lazily in
  // getContext(). Native ElementImage capture must see that actual context
  // before main receives initialized and requests the first panel paint.
  renderer.getContext();
  RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init());
  const lights = createDeviceLightRecipe(input.lightRig).map(recipe => {
    const light = new RectAreaLight(recipe.color, recipe.intensity, recipe.width, recipe.height);
    light.name = recipe.name; light.position.fromArray(recipe.position); light.rotation.set(...recipe.rotation); scene.add(light); return light;
  });
  const key = lights[0]; if (!key) throw new Error('Authored light rig is empty');
  const studio = createBackendStudioMaps({ kind: 'webgpu', renderer }, input.studio.sigma); cleanups.push(() => studio.dispose());
  scene.environment = studio.texture; scene.environmentIntensity = input.studio.intensity;
  const fonts = { label: restoreDeviceFontTexture(input.fonts.label), rearRoughness: restoreDeviceFontTexture(input.fonts.rearRoughness), rearBump: restoreDeviceFontTexture(input.fonts.rearBump) };
  cleanups.push(() => { for (const texture of Object.values(fonts)) texture.dispose(); });
  const screen = createNativeScreenTexture(renderer, input.raster.width, input.raster.height); cleanups.push(() => screen.dispose());
  const lcd = createLcdNodeMaterial(screen.texture, 'unorm-srgb'); cleanups.push(() => lcd.dispose());
  const materials = createDeviceAssemblyMaterials({ backend: { kind: 'webgpu', cards: { key, aligned: lights.slice(0, 2) } }, isBlack: input.isBlack,
    params: input.materials, screen: lcd, maps: { prepared: data.textures, rearEnvironment: studio.texture, studio: studio.texture,
      screenStudio: studio.screenTexture, studioIntensity: input.studio.intensity, label: fonts.label,
      backplate: { roughnessMap: fonts.rearRoughness, bumpMap: fonts.rearBump } } }); cleanups.push(() => materials.dispose());
  const graph = createDeviceAssemblyGraph(createDeviceAssemblyRecipe(input.form, data.hardware), data, materials.materials); cleanups.push(() => graph.dispose());
  const model = new Group(), content = graph.root;
  model.name = 'device-model'; content.name = 'device-model-content';
  const envelope = completeDeviceEnvelope(input.form); content.position.set(-envelope.center[0], -envelope.center[1], -envelope.center[2]);
  model.add(content); scene.add(model); graph.objects.set(model.name, model); graph.objects.set(content.name, content);
  const screenMesh = graph.objects.get('screen'); if (!(screenMesh instanceof Mesh)) throw new Error('Authored LCD mesh is absent');
  const projection = createLatestRenderChannel<Omit<RenderProjection, 'notificationSequence'>>((notificationSequence, value) => send({ type: 'projection', version: 1, epoch, projection: { ...value, notificationSequence } }));
  cleanups.push(() => projection.dispose());
  const publish = (next: RenderPose) => {
    pose = next;
    for (const node of pose.nodes) {
      const target = graph.objects.get(node.id); if (!target) throw new Error(`Unknown render node ${node.id}`);
      target.matrixAutoUpdate = false; target.matrix.fromArray(node.matrix);
    }
    if (!visible || !painted || !compiled || retired) return;
    scene.updateMatrixWorld(true); renderer.render(scene, camera);
    if (!backend.isInitialized()) throw new Error('Renderer became unavailable');
    if(pendingPackPoseAck!==null){send({type:'pack-pose-consumed',version:1,epoch,notificationSequence:pendingPackPoseAck,accepted:true});pendingPackPoseAck=null;}
    projection.offer({ epoch, sceneRevision, resourceRevision,
      layoutRevision: layout.revision, pose, screenWorld: screenMesh.matrixWorld.toArray(), screenWidth: DEVICE_LAYOUT.screen.width,
      screenHeight: DEVICE_LAYOUT.screen.height, cameraWorld: camera.matrixWorld.toArray(), cameraProjection: camera.projectionMatrix.toArray() });
    if (!ready) { ready = true; send({ type: 'ready', version: 1, epoch, pose }); }
  };
  const motion = createDeviceMotionDriver(pose, { rendererEpoch: epoch, orientationNodeId: model.name,
    now: () => performance.timeOrigin + performance.now(), requestFrame: callback => globalThis.requestAnimationFrame(time => callback(performance.timeOrigin + time)),
    cancelFrame: handle => globalThis.cancelAnimationFrame(handle), publish: next => { try { publish(next); } catch (error) { fail(error); } }, settled: send }); cleanups.push(() => motion.dispose());
  const acceptsPose = (next: RenderPose) => next.sceneRevision === sceneRevision && next.resourceRevision === resourceRevision &&
    next.layoutRevision === layout.revision &&
    next.nodes.length <= graph.objects.size && next.nodes.every(node => graph.objects.has(node.id) && node.matrix.length === 16 && node.matrix.every(Number.isFinite));
  const adoptEquipped = async (frame: NativeEquippedFrameMessage) => {
    const sequence = frame.sequence;
    if(preparingSticker || sequence<=stickerSequence || frame.computationEpoch!==latestStickerEpoch){closeStickerFrameMessage(frame);send({type:'equipped-frame-rejected',version:1,epoch,sequence});return;}
    preparingSticker=true;stickerSequence=sequence;
    let candidate: Awaited<ReturnType<typeof prepareStickerRenderFrame>> | null = null;
    try {
      candidate = await prepareStickerRenderFrame(frame, studio.texture, abort.signal);
      if (retired || sequence !== stickerSequence || frame.computationEpoch !== latestStickerEpoch) {
        candidate.dispose(); send({type:'equipped-frame-rejected',version:1,epoch,sequence}); return;
      }
      // The displayed scene stays renderable while the detached candidate
      // compiles. Three restores render globals before its yielding build loop.
      await backend.compile(candidate.root,camera,scene,abort.signal);
      if (retired || sequence !== stickerSequence || frame.computationEpoch !== latestStickerEpoch) {
        candidate.dispose(); publish(pose); send({type:'equipped-frame-rejected',version:1,epoch,sequence}); return;
      }
      const preparedCandidate=candidate;
      const finish=(adopt:boolean)=>{
       if(!adopt||retired||frame.computationEpoch!==latestStickerEpoch){preparedCandidate.dispose();send({type:'equipped-frame-rejected',version:1,epoch,sequence});return;}
       const previous=equipped;previous?.root.removeFromParent();equipped=preparedCandidate;content.add(preparedCandidate.root);previous?.dispose();
       resourceRevision++;sceneRevision++;pose={...pose,resourceRevision,sceneRevision};
       send({type:'equipped-frame-adopted',version:1,epoch,sequence,pose});completeCarryHandoff('equipped');motion.adoptPose(pose);
      };
      carryAdoption.replace('equipped',finish);
    } catch (error) { candidate?.dispose(); fail(error); } finally {preparingSticker=false;}
  };
  const adoptPack=async(frame:NativePackFrame,sequence:number)=>{
    let candidate:Awaited<ReturnType<typeof prepareStickerPackRenderFrame>>|null=null;
    try{
      candidate=await prepareStickerPackRenderFrame(frame,studio.texture,abort.signal,pack?.resources);
      if(retired||frame.key!==latestPackKey){candidate.dispose();send({type:'pack-frame-complete',version:1,epoch,sequence,key:frame.key,accepted:false,recipe:null});return;}
      await backend.compile(candidate.root,camera,scene,abort.signal);
      if(retired||frame.key!==latestPackKey){candidate.dispose();publish(pose);send({type:'pack-frame-complete',version:1,epoch,sequence,key:frame.key,accepted:false,recipe:null});return;}
      if(latestPackRecipe)candidate.update(latestPackRecipe);
      if(pendingPackPoseAck!==null){send({type:'pack-pose-consumed',version:1,epoch,notificationSequence:pendingPackPoseAck,accepted:false});pendingPackPoseAck=null;}
      const preparedCandidate=candidate;
      const finish=(adopt:boolean)=>{
       if(!adopt||retired||frame.key!==latestPackKey){preparedCandidate.dispose();send({type:'pack-frame-complete',version:1,epoch,sequence,key:frame.key,accepted:false,recipe:null});return;}
       if(latestPackRecipe)preparedCandidate.update(latestPackRecipe);
       pack?.dispose();pack=preparedCandidate;packKey=frame.key;scene.add(preparedCandidate.root);
       send({type:'pack-frame-complete',version:1,epoch,sequence,key:frame.key,accepted:true,recipe:latestPackRecipe??frame.recipe});completeCarryHandoff('pack');publish(pose);
      };
      carryAdoption.replace('pack',finish);
    }catch(error){candidate?.dispose();fail(error);}
  };
  const adoptWarmup=async(frame:NativePackFrame,sequence:number)=>{
    let candidate:Awaited<ReturnType<typeof prepareStickerWarmup>>|null=null;
    try{candidate=await prepareStickerWarmup(frame,studio.texture,abort.signal);
      if(frame.prints.length){await backend.compile(candidate.root,camera,scene,abort.signal);}
      if(retired){candidate.dispose();return;}
      warmup?.dispose();warmup=candidate;publish(pose);send({type:'warmup-complete',version:1,epoch,sequence,accepted:true});
    }catch(error){candidate?.dispose();fail(error);}
  };
  const adoptCarry=async(frame:NativeCarryFrameMessage)=>{
   let map;try{map=carryArtworks.adopt(frame);}catch(error){frame.geometry.close();frame.damage.port.close();throw error;}
   if(!carryAdoption.compatible(frame.epoch,frame.stamp.assemblyRevision)){frame.geometry.close();frame.damage.port.close();send({type:'carry-frame-complete',version:1,epoch,sequence:frame.sequence,accepted:false});return;}
   let candidate:Awaited<ReturnType<typeof prepareCarryRenderFrame>>|null=null;
   try{
    candidate=await prepareCarryRenderFrame(frame,map,studio.texture,abort.signal);
    if(retired||!carryAdoption.compatible(frame.epoch,frame.stamp.assemblyRevision)){candidate.dispose();send({type:'carry-frame-complete',version:1,epoch,sequence:frame.sequence,accepted:false});return;}
    await backend.compile(candidate.root,camera,scene,abort.signal);
    if(retired||!carryAdoption.compatible(frame.epoch,frame.stamp.assemblyRevision)){candidate.dispose();publish(pose);send({type:'carry-frame-complete',version:1,epoch,sequence:frame.sequence,accepted:false});return;}
    const old=carry;carry=candidate;scene.add(candidate.root);old?.dispose();
    send({type:'carry-frame-complete',version:1,epoch,sequence:frame.sequence,accepted:true});
    compiled=false;carryAdoption.adopt(frame.epoch,frame.stamp.assemblyRevision);compiled=true;
    if(pack&&packKey===latestPackKey&&latestPackRecipe)pack.update(latestPackRecipe);
    publish(pose);
   }catch(error){candidate?.dispose();fail(error);}
  };
  accept = message => {
    if (message.epoch !== epoch || message.version !== 1 || retired) {closeIncoming(message);return;}
    if(message.type==='carry-state'){
      if(!carryAdoption.update(message.state))return;
      if(!message.state.active&&(!carry||message.state.handoff==='none')){clearCarry();publish(pose);}
    }else if(message.type==='carry-frame'){enqueueSceneUpdate(()=>adoptCarry(message.frame),message);}
    else if (message.type === 'sticker-epoch') { latestStickerEpoch = Math.max(latestStickerEpoch,message.computationEpoch); }
    else if (message.type === 'equipped-frame') { enqueueSceneUpdate(()=>adoptEquipped(message.frame),message); }
    else if(message.type==='warmup-frame'){enqueueSceneUpdate(()=>adoptWarmup(message.frame,message.sequence),message);}
    else if(message.type==='pack-frame'){latestPackKey=message.frame.key;latestPackRecipe=message.frame.recipe;enqueueSceneUpdate(()=>adoptPack(message.frame,message.sequence),message);}
    else if(message.type==='pack-pose'){latestPackKey=message.key;latestPackRecipe=message.recipe;if(pack&&packKey===message.key&&!carryAdoption.waiting()){pendingPackPoseAck=message.notificationSequence;pack.update(message.recipe);completeCarryHandoff('pack');publish(pose);}else send({type:'pack-pose-consumed',version:1,epoch,notificationSequence:message.notificationSequence,accepted:false});}
    else if (message.type === 'paint') {
      const stamp = message.stamp;
      if (!visible || stamp.epoch !== epoch || stamp.layoutRevision !== layout.revision || stamp.visibilityRevision !== visibilityRevision || stamp.rasterRevision !== raster.rasterRevision || stamp.width!==raster.width || stamp.height!==raster.height) {
        message.image.close(); send({ type: 'paint-consumed', version: 1, epoch, stamp }); return;
      }
      try { screen.upload(message.image,{width:raster.width,height:raster.height}); painted = true; }
      finally { send({ type: 'paint-consumed', version: 1, epoch, stamp: message.stamp }); }
      publish(pose);
    } else if (message.type === 'projection-ack') projection.acknowledge(message.notificationSequence);
    else if (message.type === 'pose-update') {
      const accepted = acceptsPose(message.pose) && motion.adoptPose(message.pose);
      send({ type: 'pose-consumed', version: 1, epoch, notificationSequence: message.notificationSequence, accepted });
    }
    else if (message.type === 'pose') { if (acceptsPose(message.pose)) motion.adoptPose(message.pose); }
    else if (message.type === 'command') {
      const accepted = acceptsPose(message.command.pose) && motion.command(message.command);
      send(accepted ? { type: 'command-accepted', version: 1, epoch, commandSequence: message.command.commandSequence, motionEpoch: message.command.motionEpoch }
        : { type: 'command-rejected', version: 1, epoch, commandSequence: message.command.commandSequence, motionEpoch: message.command.motionEpoch, reason: 'Stale motion command' });
    } else if (message.type === 'visibility') {
      visible = message.visible; visibilityRevision = message.revision; projection.pause(!visible);
      if(acceptsPose(message.command.pose))motion.command(message.command);
      pose=motion.read();motion.pause(!visible);
      if (!visible) send({ type: 'motion-checkpoint', version: 1, epoch, checkpoint: motion.checkpoint() });
      else publish(pose);
    }
    else if(message.type==='layout-raster'){layout=message.layout;raster=message.raster;pose={...pose,layoutRevision:layout.revision};applyLayout();motion.adoptPose(pose);}
    else if (message.type === 'layout') { layout = message.layout; pose = { ...pose, layoutRevision: layout.revision }; applyLayout(); motion.adoptPose(pose); }
    else if (message.type === 'dispose') { visible=false;projection.pause(true);if(acceptsPose(message.command.pose))motion.command(message.command);retired = true; release?.(); send({ type: 'disposed', version: 1, epoch }); }
  };
  send({ type: 'initialized', version: 1, epoch });
  await backend.compile(scene, camera, scene, abort.signal); compiled = true; publish(pose);
}

self.onmessage = ({ data }: MessageEvent<DeviceRenderWorkerRequest>) => {
  try {
    if (data.type === 'initialize') { if (epoch !== 0) throw new Error('Renderer worker initialized twice'); void initialize(data).catch(fail); }
    else if (data.type === 'dispose' && !accept) { retired = true; release?.(); send({ type: 'disposed', version: 1, epoch }); }
    else if (accept) accept(data);
    else closeIncoming(data);
  } catch (error) { fail(error); }
};
