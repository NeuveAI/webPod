import type { RenderPose } from '../../device/src/device-render-protocol';
import { createStickerProjection } from '../../device/src/sticker-projection';
import { createStickerVisibility } from '../../device/src/sticker-visibility';
import type { RenderLayout } from '../../device/src/device-render-protocol';
import { Group, Mesh, MeshPhysicalMaterial, PerspectiveCamera } from 'three';
import { isStickerCarried, type DeviceStickerScene } from '../../device/src/sticker-contract';
import type { DeviceFormParams } from '../../device/src/form';
import type { createDeviceQueryView } from '../../device/src/device-query-view';
import type { DeviceRenderWorkerResponse } from '../../device/src/device-render-worker-protocol';
import type { NativeEquippedFrameMessage } from '../../device/src/sticker-render-frame';
import { stickerWrapSurface } from '../../device/src/sticker-wrap';
import { setStickerMaterialDamage } from '../../device/src/sticker-alpha';
import { markStickerAssemblyChanged } from '../../device/src/sticker-assembly-revision';
import { prepareNativeEquippedFrame } from './native-sticker-resources';

type Frame = Awaited<ReturnType<typeof prepareNativeEquippedFrame>>;
/** A single in-flight transaction and one replaceable intent. Submitted frames
 * keep their private leases until the worker confirms replacement or retires.
 * A source epoch cancels admission, never a GPU compile already in progress. */
export function createNativeStickerController(input: {
  readonly canvas:HTMLCanvasElement;readonly layout:()=>RenderLayout;readonly readPose:()=>RenderPose;
  readonly form: DeviceFormParams; readonly query: ReturnType<typeof createDeviceQueryView>;
  readonly sendEpoch: (epoch: number) => void;
  readonly sendFrame: (frame: NativeEquippedFrameMessage, transfer: Transferable[]) => void;
  readonly fail: (error: unknown) => void;
}) {
  let disposed = false, sequence = 0, epoch = 0, sourceEpoch = 0;
  let pending: DeviceStickerScene | null = null, latest:DeviceStickerScene|null=null;
  const camera = new PerspectiveCamera(), visibility = createStickerVisibility({workerOnly:true});
  let projection:ReturnType<typeof createStickerProjection>|null=null;
  let latestKey='',currentKey:string|null=null,candidateKey='';
  const resourceKey=(scene:DeviceStickerScene)=>JSON.stringify([scene.finishEnabled!==false,scene.placements.map(placement=>[placement,scene.assets.find(art=>art.id===placement.stickerId)??null,isStickerCarried(scene.pack,placement.stickerId)])]);
  const synchronizeProjection = () => {
    const layout = input.layout();camera.matrixAutoUpdate=false;camera.matrix.fromArray(layout.cameraWorld);camera.matrixWorld.fromArray(layout.cameraWorld);camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    camera.projectionMatrix.fromArray(layout.cameraProjection);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    if (!projection && latest) projection=createStickerProjection({scene:input.query.scene,camera,canvas:input.canvas,readPose:input.readPose,readScene:()=>{if (!latest) throw new Error('Sticker scene retired');return latest;},visibility});
    if (projection) latest?.onProjectionReady?.(projection.handle);
  };
  const unsubscribeVisibility = visibility.subscribe(synchronizeProjection);
  let current: Frame | null = null, candidate: Frame | null = null;
  let acknowledgement:ReturnType<typeof setTimeout>|null=null;
  let preparing = false, waiting = false, preparation: AbortController | null = null;
  let queryRoot: Group | null = null;
  const retireQueries = () => {
    if (!queryRoot) return;
    queryRoot.removeFromParent();
    for (const child of queryRoot.children) if (child instanceof Mesh && child.material instanceof MeshPhysicalMaterial) child.material.dispose();
    queryRoot.clear(); queryRoot = null;
  };
  const adoptQueries = (frame: Frame) => {
    retireQueries(); const root = new Group(); root.name = 'device-equipped-stickers';
    for (const item of frame.queries) {
      const material = new MeshPhysicalMaterial({map:item.print.texture,transparent:true,depthWrite:false});
      setStickerMaterialDamage(material,item.print.damage);
      const mesh = new Mesh(item.print.geometry,material); mesh.name = `sticker-${item.placement.stickerId}`;
      mesh.visible = item.visible; mesh.renderOrder = item.renderOrder; mesh.raycast = () => {};
      root.add(mesh);
    }
    queryRoot = root; input.query.content.add(root); root.updateWorldMatrix(true,true);
    markStickerAssemblyChanged(input.query.content);
    void visibility.prepare(input.query.content);synchronizeProjection();
  };
  const pump = async () => {
    if (disposed || preparing || waiting || !pending) return;
    const scene = pending; pending = null;const key=resourceKey(scene);if(key===currentKey)return;preparing = true;
    const jobEpoch = epoch, controller = new AbortController(); preparation = controller;
    const deadline = setTimeout(() => controller.abort(new Error('Native sticker preparation timed out')),45000);
    try {
      const wrap = stickerWrapSurface(input.query.rear.geometry); if (!wrap) throw new Error('Native sticker wrap query unavailable');
      const frame = await prepareNativeEquippedFrame({scene,form:input.form,rear:input.query.rear.geometry,wrap},controller.signal);
      if (disposed || jobEpoch !== epoch || key!==latestKey) {frame.release();return;}
      candidate = frame;candidateKey=key; waiting = true; sequence++;
      const message: NativeEquippedFrameMessage = {sequence,computationEpoch:jobEpoch,prints:frame.prints,resources:frame.ports,artworks:frame.artworks};
      input.sendFrame(message,[...frame.ports.map(resource => resource.port),...frame.artworks.map(art => art.bitmap.image)]);
      frame.transferred();
      acknowledgement=setTimeout(()=>input.fail(new Error('Native sticker adoption acknowledgement timed out')),45000);
    } catch (error) {
      if (!disposed && jobEpoch === epoch) input.fail(error);
    } finally {
      clearTimeout(deadline); preparing = false; preparation = null;
      if (!disposed) void pump();
    }
  };
  return {
    update(scene: DeviceStickerScene) {
      if (disposed) return;
      if (latest?.onProjectionReady !== scene.onProjectionReady) latest?.onProjectionReady?.(null);
      const changedCallback=latest?.onProjectionReady !== scene.onProjectionReady; latest=scene;if (changedCallback) synchronizeProjection();
      const key=resourceKey(scene),nextEpoch=scene.pack?.computationEpoch??0;
      if(nextEpoch!==sourceEpoch||key!==latestKey){sourceEpoch=nextEpoch;latestKey=key;epoch++;input.sendEpoch(epoch);if(!waiting)preparation?.abort();}
      pending=key===currentKey?null:scene;
      void pump();
    },
    receive(message: Extract<DeviceRenderWorkerResponse,{type:'equipped-frame-adopted'|'equipped-frame-rejected'}>) {
      if (disposed || !waiting || message.sequence !== sequence || !candidate) return;
      waiting = false;if(acknowledgement!==null)clearTimeout(acknowledgement);acknowledgement=null;
      const frame = candidate; candidate = null;
      if (message.type === 'equipped-frame-adopted') {const previous=current;current=frame;currentKey=candidateKey;try{adoptQueries(frame);}finally{previous?.release();}for(const print of frame.prints)latest?.onArtworkReady?.(print.id);latest?.onSurfaceReady?.();}
      else frame.release();
      if(latest)pending=latestKey===currentKey?null:latest;
      void pump();
    },
    visibility,
    project:synchronizeProjection,
    dispose() { if (disposed) return; disposed = true;if(acknowledgement!==null)clearTimeout(acknowledgement);acknowledgement=null; pending = null; preparation?.abort(); projection?.dispose();latest?.onProjectionReady?.(null);unsubscribeVisibility();visibility.dispose();retireQueries(); },
    /** Must run only after the renderer has acknowledged disposal or its worker
     * has terminated, so no private buffers remain in GPU use. */
    rendererRetired() {candidate?.release();candidate = null;current?.release();current = null;},
  };
}
