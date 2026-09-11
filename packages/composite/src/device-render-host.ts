import {createNativeCarryController} from './native-carry-controller';
import {createNativeStickerWarmup} from './native-sticker-warmup';
import {createNativeWorkspaceReframe} from './native-workspace-reframe';
import {createNativePackController} from './native-pack-controller';
import { createNativeStickerController } from './native-sticker-controller';
import type { DeviceStickerScene } from '../../device/src/sticker-contract';
import { createDeviceQueryView } from '../../device/src/device-query-view';
import type { DeviceMotionAuthority, DeviceMotionBinding } from '../../device/src/device-motion-authority';
import type { DeviceRenderWorkerRequest, DeviceRenderWorkerResponse } from '../../device/src/device-render-worker-protocol';
import type { RenderControlResponse, RenderLayout, RenderPose, RenderProjection, NativePaintStamp } from '../../device/src/device-render-protocol';
import { acquirePreparedDeviceForRenderer } from '../../device/src/immutable-shell-preparation';
import { captureDeviceFontAssets, disposeDeviceFontAssets, type DeviceFontAssets } from '../../device/src/device-font-assets';
import { postNativeTransfer, supportsNativePaintCanvas } from '../../device/src/native-element-image';
import { createLatestRenderChannel } from '../../device/src/render-channels';
import { createNativeScreenTransport } from './native-screen-transport';
import { projectNativePanel } from './panel-projection';
import { fitPanelContentToFrame } from './html-in-canvas';
import { DEVICE_LAYOUT } from '../../device/src/layout';
import type { DeviceFormParams } from '../../device/src/form';
import type { DeviceMaterials } from '../../device/src/materials';
import type { LightRigParams } from '../../device/src/light-rig';

let nextEpoch = 0;
/** One associated presentation canvas generation. Stable DOM/store/input owners
 * stay outside this object and survive fallback; this owner never creates a
 * second Panel. The caller must provide a fresh canvas with no acquired context.
 */
export function createDeviceRenderHost(input: {
  readonly canvas: HTMLCanvasElement; readonly panel: HTMLElement;
  readonly form: DeviceFormParams; readonly materials: DeviceMaterials; readonly lightRig: LightRigParams;
  readonly isBlack: boolean; readonly layout: RenderLayout; readonly pose: RenderPose;
  readonly rasterWidth: number; readonly rasterHeight: number;
  readonly studio: { readonly sigma: number; readonly intensity: number };
  readonly authority?: DeviceMotionAuthority;
  readonly stickerScene?: DeviceStickerScene;
  readonly onProjection: (projection: RenderProjection) => void;
  readonly onReady: (binding: DeviceMotionBinding, query: ReturnType<typeof createDeviceQueryView>) => (() => void) | void;
  readonly onFailure: (error: unknown) => void;
}) {
  const { canvas, panel } = input;
  if (!supportsNativePaintCanvas(canvas)) throw new Error('Native worker canvas is unsupported');
  const epoch = ++nextEpoch, abort = new AbortController(), worker = new Worker(new URL('../../device/src/device-render-worker.ts', import.meta.url), { type: 'module' });
  let disposed = false, initialized = false, ready = false, lastProjection = 0, commandSequence = input.pose.lastAcceptedCommand;
  let pose = input.pose, layout = input.layout;
  let detachAuthority: (() => void) | null = null;
  let lease: Awaited<ReturnType<typeof acquirePreparedDeviceForRenderer>> | null = null;
  let fonts: DeviceFontAssets | null = null;
  let pixels: ReturnType<typeof createNativeScreenTransport> | null = null;
  let visibilityRevision = 1;
  let query: ReturnType<typeof createDeviceQueryView> | null = null;
  let detachInput: (() => void) | void;
  let carry:ReturnType<typeof createNativeCarryController>|null=null;
  let warmup:ReturnType<typeof createNativeStickerWarmup>|null=null;
  let workspace:ReturnType<typeof createNativeWorkspaceReframe>|null=null;
  let pack:ReturnType<typeof createNativePackController>|null=null;
  let stickers: ReturnType<typeof createNativeStickerController> | null = null;
  let stickerScene = input.stickerScene;
  const listeners = new Set<(message: RenderControlResponse) => void>();
  const resources = new MessageChannel();
  const send = (message: DeviceRenderWorkerRequest) => { if (!disposed) worker.postMessage(message); };
  const envelope = { version: 1, epoch } as const;
  let stamp: NativePaintStamp = { epoch, captureId: 0, paintRevision: 0, rasterRevision: 1,
    layoutRevision: layout.revision, visibilityRevision: 1, width: input.rasterWidth, height: input.rasterHeight };
  const poseChannel = createLatestRenderChannel<RenderPose>((notificationSequence, next) => send({ ...envelope, type: 'pose-update', notificationSequence, pose: next }));
  const binding: DeviceMotionBinding = {
    read: () => pose, nextCommandSequence: () => ++commandSequence,
    sendPose(next) { if (!disposed) { pose = {...next,sequence:Math.max(next.sequence,pose.sequence+1)}; query?.applyPose(pose); poseChannel.offer(pose); } },
    sendCommand(command) { if (disposed) return; poseChannel.discardPending(); commandSequence = Math.max(commandSequence, command.commandSequence); pose = command.pose; query?.applyPose(command.pose); send({ ...envelope, type: 'command', command }); },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  const adoptPose = (next: RenderPose, projection?: RenderProjection): boolean => {
    if (next.sequence < pose.sequence || next.resourceRevision !== pose.resourceRevision || next.sceneRevision !== pose.sceneRevision || next.motionEpoch !== pose.motionEpoch || next.lastAcceptedCommand < pose.lastAcceptedCommand || next.layoutRevision !== layout.revision) return false;
    pose = next; query?.applyPose(next);
    const screenWorld = projection?.screenWorld ?? query?.nodes.get('screen')?.matrixWorld.toArray();
    if (screenWorld) {
      const matrix = projectNativePanel({cameraWorld: projection?.cameraWorld ?? layout.cameraWorld,
        cameraProjection: projection?.cameraProjection ?? layout.cameraProjection, screenWorld,
        cssWidth: layout.cssWidth, cssHeight: layout.cssHeight, elementWidth: panel.offsetWidth, elementHeight: panel.offsetHeight,
        screenWidth: DEVICE_LAYOUT.screen.width, screenHeight: DEVICE_LAYOUT.screen.height, screenMaxZ: 0});
      const transform = `matrix3d(${matrix.elements.join(',')})`;
      if (panel.style.transform !== transform) panel.style.transform = transform;
    }
    stickers?.project(); carry?.project();
    return true;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; clearTimeout(deadline); abort.abort();carry?.dispose(); warmup?.dispose();workspace?.dispose();pack?.dispose();stickers?.dispose(); detachInput?.(); detachAuthority?.(); query?.dispose(); query = null; pixels?.dispose(); poseChannel.dispose();
    document.removeEventListener('visibilitychange', synchronizeVisibility);
    listeners.clear(); resources.port1.close(); resources.port2.close(); if (fonts) disposeDeviceFontAssets(fonts); fonts = null;
    // Send an ordered terminal command before the bounded hard termination. No
    // new canvas can reuse this worker/epoch or its transferred snapshot handles.
    let terminated=false;
    const terminate = () => { if(terminated)return;terminated=true;worker.terminate();carry?.rendererRetired(); warmup?.rendererRetired();pack?.rendererRetired();stickers?.rendererRetired(); lease?.release(); lease = null; };
    const timer = setTimeout(terminate, 250);
    worker.onmessage = (event: MessageEvent<DeviceRenderWorkerResponse>) => { if (event.data.type === 'disposed' && event.data.epoch === epoch) { clearTimeout(timer); terminate(); } };
    worker.onerror = terminate; worker.onmessageerror = terminate;
    try{worker.postMessage({ ...envelope, type: 'dispose', command: { kind: 'motion-cancel', reason: 'unmount', commandSequence: ++commandSequence, motionEpoch: pose.motionEpoch, pose } } satisfies DeviceRenderWorkerRequest);}
    catch{clearTimeout(timer);terminate();}
  };
  const fail = (error: unknown) => { if (disposed) return; dispose(); input.onFailure(error); };
  const synchronizeVisibility = () => {
    if (disposed || !initialized) return;
    const visible = document.visibilityState !== 'hidden'; visibilityRevision++;
    pixels?.update({ ...stamp, layoutRevision: layout.revision, visibilityRevision }, visible);
    poseChannel.pause(!visible);
    send({ ...envelope, type: 'visibility', visible, revision: visibilityRevision,
      command: { kind: 'motion-cancel', reason: 'hidden', commandSequence: ++commandSequence, motionEpoch: pose.motionEpoch, pose } });
  };
  document.addEventListener('visibilitychange', synchronizeVisibility);
  const deadline = setTimeout(() => fail(new Error('Complete worker renderer readiness timed out')), 45000);
  worker.onerror = event => fail(new Error(event.message)); worker.onmessageerror = () => fail(new Error('Renderer message could not decode'));
  worker.onmessage = ({ data }: MessageEvent<DeviceRenderWorkerResponse>) => {
    if (disposed || data.epoch !== epoch || data.version !== 1) return;
    try {
      if (data.type === 'failed') { fail(new Error(data.message)); return; }
      if (data.type === 'initialized') {
        initialized = true;
        send({ ...envelope, type: 'layout-raster', layout, raster:stamp });
        pixels = createNativeScreenTransport({ canvas, panel, generation: stamp,
          send: (paint, image) => postNativeTransfer(worker, { ...envelope, type: 'paint', stamp: paint, image }, [image]), fail });
        synchronizeVisibility();
      } else if(data.type==='carry-frame-complete'){carry?.acknowledge(data.sequence,data.accepted);return;}else if(data.type==='carry-cleared'){carry?.cleared(data.carryEpoch);return;}else if(data.type==='warmup-complete'){warmup?.ack(data.sequence,data.accepted);return;} else if(data.type==='pack-frame-complete'||data.type==='pack-pose-consumed'){pack?.receive(data);return;} else if (data.type === 'equipped-frame-adopted' || data.type === 'equipped-frame-rejected') {
        if (data.type === 'equipped-frame-adopted') {pose = {...pose,resourceRevision:data.pose.resourceRevision,sceneRevision:data.pose.sceneRevision}; poseChannel.discardPending();}
        stickers?.receive(data);
        if (data.type === 'equipped-frame-adopted') {query?.applyPose(pose); binding.sendPose(pose);}
        return;
      } else if (data.type === 'pose-consumed') poseChannel.acknowledge(data.notificationSequence);
      else if (data.type === 'paint-consumed') pixels?.acknowledge(data.stamp);
      else if (data.type === 'projection') {
        const p = data.projection;
        if (p.notificationSequence <= lastProjection) return;
        lastProjection = p.notificationSequence;
        // Ack even a replaced pose so credit never prevents worker motion. The
        // old result is forbidden from overwriting newer main intent/query state.
        send({ ...envelope, type: 'projection-ack', notificationSequence: p.notificationSequence });
        if (p.layoutRevision !== layout.revision || !adoptPose(p.pose, p)) return;
        input.onProjection(p);
      } else if (data.type === 'command-settled' || data.type === 'motion-checkpoint') {
        // Reliable final samples are independent of projection credit. Adopt
        // query and native Panel geometry before public settlement listeners.
        const terminalPose = data.type === 'command-settled' ? data.pose : data.checkpoint.pose;
        if (data.type === 'command-settled' && data.motionEpoch !== terminalPose.motionEpoch) return;
        if (!adoptPose(terminalPose)) return;
      } else if (data.type === 'ready') {
        ready = true; clearTimeout(deadline); pose = data.pose;
        detachAuthority ??= input.authority?.attach(binding) ?? null;
        if (!query) throw new Error('Native query resources were not prepared');
        detachInput = input.onReady(binding, query);
        stickers = createNativeStickerController({canvas,layout:()=>layout,readPose:binding.read,form:input.form,query,sendEpoch:computationEpoch => send({...envelope,type:'sticker-epoch',computationEpoch}),
          sendFrame:(frame,transfer) => worker.postMessage({...envelope,type:'equipped-frame',frame} satisfies DeviceRenderWorkerRequest,transfer),fail});
        carry=createNativeCarryController({canvas,layout:()=>layout,query,visibility:stickers.visibility,sendState:state=>send({...envelope,type:'carry-state',state}),sendFrame:(frame,transfer)=>worker.postMessage({...envelope,type:'carry-frame',frame} satisfies DeviceRenderWorkerRequest,transfer),onProjection:()=>stickers?.project(),fail});
        warmup=createNativeStickerWarmup({send:(sequence,frame,transfer)=>worker.postMessage({...envelope,type:'warmup-frame',sequence,frame} satisfies DeviceRenderWorkerRequest,transfer),fail});
        workspace=createNativeWorkspaceReframe({binding,layout:()=>layout});
        pack=createNativePackController({query,onProjection:()=>stickers?.project(),layout:()=>layout,send:(request,transfer)=>worker.postMessage({...envelope,...request} satisfies DeviceRenderWorkerRequest,transfer??[]),fail});
        if (stickerScene) {warmup.update(stickerScene);workspace.update(stickerScene);carry.update(stickerScene);stickers.update(stickerScene);pack.update(stickerScene);}
      }
      if (data.type !== 'initialized' && data.type !== 'ready' && data.type !== 'pose-consumed') for (const listener of listeners) listener(data);
    } catch (error) { fail(error); }
  };
  const start = async () => {
    try {
      const acquired = await acquirePreparedDeviceForRenderer(input.form, resources.port1, abort.signal);
      if (disposed) { acquired.release(); return; } lease = acquired;
      query = createDeviceQueryView(acquired.query, input.form, input.materials,input.isBlack); query.applyPose(pose);
      fonts = await captureDeviceFontAssets(input.isBlack, input.materials, acquired.query.backplatePixels, abort.signal);
      if (disposed) { disposeDeviceFontAssets(fonts); fonts = null; return; }
      canvas.setAttribute('layoutsubtree', 'true'); panel.setAttribute('drawable', ''); canvas.appendChild(panel);
      Object.assign(panel.style, { position: 'absolute', left: '0', top: '0', transformOrigin: '0 0', display: 'block', overflow: 'hidden', width: `${DEVICE_LAYOUT.screen.width / DEVICE_LAYOUT.screen.scale}px`, height: `${DEVICE_LAYOUT.screen.height / DEVICE_LAYOUT.screen.scale}px` });
      fitPanelContentToFrame(panel, DEVICE_LAYOUT.screen.width / DEVICE_LAYOUT.screen.scale, DEVICE_LAYOUT.screen.height / DEVICE_LAYOUT.screen.scale);
      const offscreen = canvas.transferControlToOffscreen();
      const message: DeviceRenderWorkerRequest = { ...envelope, type: 'initialize', canvas: offscreen, resources: resources.port2,
        form: input.form, materials: input.materials, lightRig: input.lightRig, isBlack: input.isBlack, fonts, layout, pose,
        raster: stamp, studio: input.studio, sceneRevision: pose.sceneRevision, resourceRevision: pose.resourceRevision };
      worker.postMessage(message, [offscreen, resources.port2, ...Object.values(fonts).map(value => value.image)]); fonts = null;
    } catch (error) { fail(error); }
  };
  // React may synchronously retire a just-mounted host during effect replay.
  // Do not enqueue a private canonical copy until that commit turn survives.
  queueMicrotask(() => { if (!disposed) void start(); });
  return { binding, dispose, inspect: () => ({ epoch, initialized, ready, disposed }),
    updateStickerScene(next: DeviceStickerScene | undefined) {stickerScene = next;if (next) {warmup?.update(next);workspace?.update(next);carry?.update(next);stickers?.update(next);pack?.update(next);}},
    updateLayout(next: RenderLayout,raster?:{readonly width:number;readonly height:number}) {
      if(raster && (raster.width!==stamp.width||raster.height!==stamp.height))stamp={...stamp,rasterRevision:stamp.rasterRevision+1,width:raster.width,height:raster.height};
      layout = next;if(stickerScene)workspace?.update(stickerScene);carry?.project(); pack?.layoutChanged();pose = { ...pose, layoutRevision: layout.revision }; if (initialized) {
      send({ ...envelope, type: 'layout-raster', layout, raster:stamp }); pixels?.update({ ...stamp, layoutRevision: layout.revision, visibilityRevision }, document.visibilityState !== 'hidden');
    } },
  };
}
