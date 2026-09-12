import { createStickerContourQuery } from './sticker-contour-query';
import type { RenderPose } from './device-render-protocol';
import { preparedStickerContourDescriptor, getPreparedStickerContour } from './sticker-contour-preparation-data';
import { captureStickerQuadSamples } from './sticker-transform-projection';
import { Mesh, Raycaster, Vector2, Vector3, type Camera, type Object3D } from 'three';
import type { DeviceStickerScene, StickerRearProjection } from './sticker-contract';
import { isStickerCarried } from './sticker-contract';
import { createStickerPickCache } from './sticker-pick-cache';
import { fitStickerDropSteps } from './sticker-drop-fit';
import { yieldSteps } from './sticker-computation-steps';
import { resolveStickerDropTransaction, preparedStickerPlacement, preparedStickerSurfaceRevision } from './sticker-transaction-client';
import { createStickerVisibility, stickerVisibilityQuery } from './sticker-visibility';
import { projectStickerDrop } from './sticker-drop-projection';
import { captureStickerSurfaceGrab } from './sticker-surface-grab';
import { stickerWrapSurface } from './sticker-wrap';
import { projectedStickerContour } from './sticker-contour';
import { preparedStickerContourWear } from './sticker-contour-preparation-data';
import { stickerVisibleAspect } from './sticker-surface';
import { captureStickerTransformPlane, stickerProjectedQuad } from './sticker-transform-projection';
import { stickerProjectedBounds } from './sticker-projected-bounds';
import { intersectStickerPrint } from './sticker-hit';
import { DEVICE_LAYOUT } from './layout';
import { isDeviceOuterGrabPoint } from './orientation-grab';
const DEVICE_CONTENT_NAME = 'device-model-content';

/** Exact shared main-thread sticker interaction authority. Both presentation
 * backends supply their admitted query scene and stable DOM/media boundaries. */
export function createStickerProjection(input: {readonly scene:Object3D;readonly camera:Camera;readonly canvas:HTMLCanvasElement;readonly readScene:()=>DeviceStickerScene;readonly visibility:ReturnType<typeof createStickerVisibility>;readonly readPose?:()=>RenderPose}) {
  const {scene,camera,canvas,readScene,visibility} = input;
    const lifetime = new AbortController();
    const content = scene.getObjectByName(DEVICE_CONTENT_NAME);
    const beginVisibility = () => {
      if (content === undefined) return () => false;
      return stickerVisibilityQuery(visibility, content, camera);
    };
    const pickUncached = (clientX: number, clientY: number) => {
      const placements = readScene().placements;
      if (placements.length === 0) return null;
      const bounds = canvas.getBoundingClientRect(), equipped = scene.getObjectByName('device-equipped-stickers');
      if (equipped === undefined || bounds.width <= 0 || bounds.height <= 0) return null;
      const ray = new Raycaster(); ray.setFromCamera(new Vector2((clientX - bounds.left) / bounds.width * 2 - 1, 1 - (clientY - bounds.top) / bounds.height * 2), camera);
      let visible: ReturnType<typeof beginVisibility> | undefined;
      // Do not inspect the collider or raycast both shells for empty space. Only
      // an actual ink hit needs occlusion/perimeter arbitration.
      for (let index = placements.length - 1; index >= 0; index--) {
        const placement = placements[index];
        if (placement === undefined || placement.stickerId === readScene().pack?.sourcePlacement?.stickerId) continue;
        const print = equipped.getObjectByName(`sticker-${placement.stickerId}`);
        if (!(print instanceof Mesh) || !print.visible) continue;
        const adoptedPlacement = preparedStickerPlacement(print.geometry) ?? placement;
        const hit = intersectStickerPrint(ray, print, adoptedPlacement);
        if (hit === null) continue;
        visible ??= beginVisibility();
        if (!visible(hit.point)) continue;
        const shellHits = ['device-body', 'device-steel-back'].flatMap(name => {
          const shell = scene.getObjectByName(name);
          if (!(shell instanceof Mesh)) return [];
          shell.updateWorldMatrix(true, false);
          return ray.intersectObject(shell, false);
        }).sort((a, b) => a.distance - b.distance);
        const shellHit = shellHits[0];
        if (shellHit !== undefined) {
          const local = shellHit.object.worldToLocal(shellHit.point.clone());
          if (isDeviceOuterGrabPoint(local.x, local.y)) return null;
        }
        return { placement: adoptedPlacement, hit };
      }
      return null;
    };
    const cachedPick = createStickerPickCache<ReturnType<typeof pickUncached>>();
    const pick = (clientX: number, clientY: number) => {
      if (readScene().placements.length === 0) return null;
      content?.updateWorldMatrix(true, false);
      camera.updateWorldMatrix(true, false);
      const bounds = canvas.getBoundingClientRect();
      return cachedPick([
        clientX, clientY, readScene(), preparedStickerSurfaceRevision(), visibility?.getSnapshot(),
        bounds.left, bounds.top, bounds.width, bounds.height,
        ...(content?.matrixWorld.elements ?? []), ...camera.matrixWorld.elements,
        ...camera.projectionMatrix.elements,
      ], () => pickUncached(clientX, clientY));
    };
    // Read the visible carried mesh while a tool edits it, including collection
    // stickers that do not yet have an equipped mesh. Saved picking stays separate.
    const projectedPrint = (placement: import('./sticker-contract').DeviceStickerPlacement) => {
      const pack = readScene().pack;
      const owner = pack && isStickerCarried(pack, placement.stickerId)
        ? scene.getObjectByName('device-carried-sticker')
        : scene.getObjectByName('device-equipped-stickers');
      return owner?.getObjectByName(`sticker-${placement.stickerId}`);
    };
    const contourOwner = createStickerContourQuery();
    let contourDemand: {placement: import('./sticker-contract').DeviceStickerPlacement; session: number} | null = null;
    let captureSequence = 0, layoutRevision = 0, layoutKey = '';
    const printIds = new WeakMap<object, number>(); let printSequence = 0;
    /** Capture only adopted private-resource provenance and one coherent live pose.
     * GL revisions describe query captures, never invented renderer frame IDs. */
    const refreshContour = () => {
      if (!contourDemand || lifetime.signal.aborted || document.hidden || !content) return;
      const {placement, session} = contourDemand;
      visibility.update(content);
      const print = projectedPrint(placement);
      if (!visibility.ready || !(print instanceof Mesh) || !print.visible) { contourOwner.clear(); return; }
      const descriptor = preparedStickerContourDescriptor(print.geometry);
      const prepared = descriptor && getPreparedStickerContour(print.geometry, descriptor.input.field, descriptor.input.wear);
      const quad = descriptor && captureStickerQuadSamples(print.geometry);
      if (!descriptor || !prepared || !quad) { contourOwner.clear(); return; }
      print.updateWorldMatrix(true, false); content.updateWorldMatrix(true, false); camera.updateMatrixWorld();
      const rect = canvas.getBoundingClientRect();
      const bounds = {left:rect.left, top:rect.top, width:rect.width, height:rect.height};
      if (![bounds.left,bounds.top,bounds.width,bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) { contourOwner.clear(); return; }
      const cameraProjection = camera.projectionMatrix.toArray();
      const nextLayout = JSON.stringify([bounds,cameraProjection]);
      if (nextLayout !== layoutKey) { layoutKey = nextLayout; layoutRevision++; }
      let printRevision = printIds.get(print.geometry);
      if (printRevision === undefined) { printRevision = ++printSequence; printIds.set(print.geometry, printRevision); }
      const admitted = input.readPose?.();
      const pose = admitted ? {backend:'native' as const, sequence:admitted.sequence, motionEpoch:admitted.motionEpoch, lastAcceptedCommand:admitted.lastAcceptedCommand, layoutRevision:admitted.layoutRevision, sceneRevision:admitted.sceneRevision, resourceRevision:admitted.resourceRevision}
        : {backend:'gl' as const, sequence:++captureSequence, layoutRevision, sceneRevision:visibility.revision, resourceRevision:printRevision};
      const pack = readScene().pack;
      contourOwner.request({lineage:{session,stickerId:placement.stickerId,source:pack && isStickerCarried(pack,placement.stickerId)?'carry':'equipped'},pose,
        visibilityRevision:visibility.revision, collider:{snapshot:visibility.snapshot(),revision:visibility.revision},
        print:{identity:print.geometry,revision:printRevision,descriptor,contour:prepared.value,quad},
        projection:{world:print.matrixWorld.toArray(),cameraInverse:camera.matrixWorldInverse.toArray(),cameraProjection,canvas:bounds},
        contentWorld:content.matrixWorld.toArray(),cameraWorld:camera.matrixWorld.toArray()});
    };
    const contourQuery = {
      request(placement: import('./sticker-contract').DeviceStickerPlacement, session: number) { contourDemand = {placement,session}; refreshContour(); },
      clear() { contourDemand = null; contourOwner.clear(); },
      subscribe:contourOwner.subscribe, getSnapshot:contourOwner.getSnapshot,
    };
    const detachContourVisibility = visibility.subscribe(refreshContour);
    const onVisibility = () => { if (document.hidden) contourOwner.clear(); else refreshContour(); };
    document.addEventListener('visibilitychange',onVisibility,{signal:lifetime.signal});
    window.addEventListener('resize',refreshContour,{signal:lifetime.signal});
    window.addEventListener('scroll',refreshContour,{signal:lifetime.signal,capture:true});
    const handle = { contourQuery, grab(clientX: number, clientY: number) {
      const picked = pick(clientX, clientY), rear = scene.getObjectByName('device-steel-back');
      if (picked === null || picked.hit.uv === undefined || content === undefined || !(rear instanceof Mesh)) return null;
      const wrap = stickerWrapSurface(rear.geometry), art = readScene().assets.find(asset => asset.id === picked.placement.stickerId);
      if (wrap === undefined || art === undefined) return null;
      const source = picked.placement;
      return captureStickerSurfaceGrab(source, art, picked.hit, { x: clientX, y: clientY }, content, camera, canvas, () => {
        const next = readScene().placements.find(item => item.stickerId === source.stickerId);
        return next !== undefined && next.x === source.x && next.y === source.y && next.width === source.width && next.rotationDeg === source.rotationDeg && next.wear === source.wear && readScene().assets.includes(art) && stickerWrapSurface(rear.geometry) === wrap;
      });
    }, project(clientX: number, clientY: number) {
      const rear = scene.getObjectByName('device-steel-back');
      if (!(rear instanceof Mesh)) return null;
      const wrap = stickerWrapSurface(rear.geometry);
      return wrap === undefined ? null : projectStickerDrop(rear, camera, canvas.getBoundingClientRect(), clientX, clientY, wrap.seamZ);
    }, async resolveDrop(placement: import('./sticker-contract').DeviceStickerPlacement, clientX: number, clientY: number, signal = new AbortController().signal) {
      signal = AbortSignal.any([signal, lifetime.signal]);
      signal.throwIfAborted();
      const rear = scene.getObjectByName('device-steel-back'), content = scene.getObjectByName(DEVICE_CONTENT_NAME);
      const art = readScene().assets.find(item => item.id === placement.stickerId);
      const wrap = rear instanceof Mesh ? stickerWrapSurface(rear.geometry) : undefined;
      if (!wrap || !art || !content) return placement;
      content.updateWorldMatrix(true, false);
      const anchor = readScene().pack?.sourceAnchor;
      const bounds = canvas.getBoundingClientRect();
      if (!wrap.form) return yieldSteps(fitStickerDropSteps(art, placement, anchor?.uv ?? [.5, .5], { x: clientX, y: clientY }, bounds, content.matrixWorld.clone(), camera.clone(), wrap), signal);
      return resolveStickerDropTransaction({ kind: 'fit', art, placement, form: wrap.form, grabbedUv: anchor?.uv ?? [.5, .5], screen: { x: clientX, y: clientY }, canvas: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }, world: content.matrixWorld.toArray(), cameraWorld: camera.matrixWorld.toArray(), cameraProjection: camera.projectionMatrix.toArray() }, signal);
    }, fit(placement: import('./sticker-contract').DeviceStickerPlacement) {
      const rear = scene.getObjectByName('device-steel-back');
      const art = readScene().assets.find(item => item.id === placement.stickerId);
      const wrap = rear instanceof Mesh ? stickerWrapSurface(rear.geometry) : undefined;
      if (!wrap || !art) return placement;
      const fitted = wrap.fit((.5 - placement.x) * DEVICE_LAYOUT.body.width, (.5 - placement.y) * DEVICE_LAYOUT.body.height,
        { width: placement.width * DEVICE_LAYOUT.body.width, height: placement.width * DEVICE_LAYOUT.body.width * stickerVisibleAspect(art), angle: placement.rotationDeg * Math.PI / 180 });
      return { ...placement, x: .5 - fitted.x / DEVICE_LAYOUT.body.width, y: .5 - fitted.y / DEVICE_LAYOUT.body.height, width: placement.width * fitted.scale };
    }, hit(clientX: number, clientY: number) { return pick(clientX, clientY)?.placement ?? null;
    }, quad(placement: import('./sticker-contract').DeviceStickerPlacement) {
      const print = projectedPrint(placement);
      return print instanceof Mesh ? stickerProjectedQuad(print, camera, canvas.getBoundingClientRect()) : null;
    }, contour(placement: import('./sticker-contract').DeviceStickerPlacement) {
      const visible = beginVisibility();
      const print = projectedPrint(placement);
      return print instanceof Mesh ? projectedStickerContour(print, camera, canvas.getBoundingClientRect(), preparedStickerContourWear(print.geometry) ?? placement.wear ?? 0, visible, visibility && content ? { identity: visibility, revision: visibility.revision, contentMatrix: content.matrixWorld.elements } : undefined) : null;
    }, beginTransform(placement: import('./sticker-contract').DeviceStickerPlacement) {
      const print = scene.getObjectByName('device-equipped-stickers')?.getObjectByName(`sticker-${placement.stickerId}`);
      const content = scene.getObjectByName(DEVICE_CONTENT_NAME);
      if (!(print instanceof Mesh) || content === undefined) return null;
      const positions = print.geometry.getAttribute('position');
      const center = new Vector3().fromBufferAttribute(positions, Math.floor(positions.count / 2));
      print.updateWorldMatrix(true, false); content.updateWorldMatrix(true, false);
      content.worldToLocal(center.applyMatrix4(print.matrixWorld));
      return captureStickerTransformPlane(content, camera, canvas.getBoundingClientRect(), center.z);
    }, bounds(placement: import('./sticker-contract').DeviceStickerPlacement) {
      const print = scene.getObjectByName('device-equipped-stickers')?.getObjectByName(`sticker-${placement.stickerId}`);
      return print instanceof Mesh ? stickerProjectedBounds(print, camera, canvas.getBoundingClientRect()) : null;
    }, screen(placement: import('./sticker-contract').DeviceStickerPlacement) {
      const content = scene.getObjectByName(DEVICE_CONTENT_NAME);
      if (content === undefined) return null;
      const print = scene.getObjectByName('device-equipped-stickers')?.getObjectByName(`sticker-${placement.stickerId}`);
      if (print instanceof Mesh) {
        const projected = stickerProjectedQuad(print, camera, canvas.getBoundingClientRect());
        if (projected !== null) return projected.center;
      }
      content.updateWorldMatrix(true, false);
      const point = new Vector3((.5 - placement.x) * DEVICE_LAYOUT.body.width, (.5 - placement.y) * DEVICE_LAYOUT.body.height, -DEVICE_LAYOUT.body.depth / 2).applyMatrix4(content.matrixWorld).project(camera);
      const bounds = canvas.getBoundingClientRect();
      return { x: bounds.left + (point.x + 1) * bounds.width / 2, y: bounds.top + (1 - point.y) * bounds.height / 2 };
    } };
  return {handle:handle satisfies StickerRearProjection,refreshContour,dispose:()=>{lifetime.abort();detachContourVisibility();contourDemand=null;contourOwner.dispose();}};
}
