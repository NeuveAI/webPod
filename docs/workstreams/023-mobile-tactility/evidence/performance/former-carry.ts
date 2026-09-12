import type { CarryInput } from '../../../../../packages/device/src/sticker-carry-computation';
import type { BufferGeometry } from '../../../../../packages/device/node_modules/three/build/three.module.js';
import type { createStickerCollision } from '../../../../../packages/device/src/sticker-collision';
import { routeStickerReturn } from '../../../../../packages/device/src/sticker-return-path';
import { Box3, PerspectiveCamera, Vector3, Mesh, Group } from '../../../../../packages/device/node_modules/three/build/three.module.js';
import * as carry from '../../../../../packages/device/src/sticker-free-carry';
import * as surface from '../../../../../packages/device/src/sticker-surface';
import { conformStickerToPaper } from '../../../../../packages/device/src/sticker-paper';
import { DEVICE_LAYOUT } from '../../../../../packages/device/src/layout';
const {constrainStickerCarryExterior, constrainStickerFreeCarry, constrainStickerLanding, createStickerGrabPeelGeometry, createStickerFreeCarryGeometry, interpolateStickerCarryGeometry, stickerCarryPointerOffset, alignStickerCarryOrigin, createStickerLandingGeometry, anchorStickerToPointer, stickerGeometryUvPoint}=carry;
const {createStickerPeelGeometry, createRearStickerPeelGeometry, STICKER_SURFACE, stickerRearTransportWeight}=surface;
const PACK={depth:130,returnClearancePx:20,returnCurl:.35};
export function former(input:CarryInput,rearGeometry:BufferGeometry,sourceSurface:BufferGeometry|null,targetSurface:BufferGeometry|null,collider:ReturnType<typeof createStickerCollision>){
const {art,pack,width,paperWidth,pixel,seatX}=input;const [originX,originY,originZ]=input.origin;
const size={width:input.viewportWidth,height:input.viewportHeight};const viewport={getCurrentViewport:()=>({width:input.worldPixel*size.width})};
const content=new Group();content.matrixAutoUpdate=false;content.matrix.fromArray(input.world);content.updateMatrixWorld(true);
const camera=new PerspectiveCamera();camera.matrixAutoUpdate=false;camera.matrix.fromArray(input.cameraWorld);camera.matrixWorld.copy(camera.matrix);camera.matrixWorldInverse.copy(camera.matrix).invert();camera.matrix.decompose(camera.position,camera.quaternion,camera.scale);camera.projectionMatrix.fromArray(input.projection);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
const rearMesh=new Mesh(rearGeometry);const scene={getObjectByName:(name:string)=>name==='device-steel-back'?rearMesh:undefined};
const gl={domElement:{setAttribute(){},removeAttribute(){}}};const carryCollision={current:{update(){},castSegment:collider.castSegment}};
const geometry=conformStickerToPaper(createStickerPeelGeometry(art,width,0,STICKER_SURFACE.segments),paperWidth,pixel,seatX);
    const frameStarted = performance.now();
    const carryCurl = pack.returnToSheet ? Math.min(pack.peel, PACK.returnCurl) : pack.peel;
    // Paper geometry is only needed for a sheet pickup or an explicit return.
    const base = !sourceSurface || pack.returnToSheet ? conformStickerToPaper(createStickerPeelGeometry(art, width, carryCurl, STICKER_SURFACE.segments), paperWidth, pixel, seatX) : null;
    const positions = geometry.getAttribute('position');
    let source = (base ?? sourceSurface ?? geometry).getAttribute('position');
    const rear = scene.getObjectByName('device-steel-back');
    content?.updateWorldMatrix(true, true);
    let rearOrigin: ReturnType<typeof createRearStickerPeelGeometry> | null = null;
    const rearOffset = new Vector3();
    if (pack.sourcePlacement != null && rear instanceof Mesh && content !== undefined) {
      if (sourceSurface && pack.sourceAnchor) rearOrigin = createStickerGrabPeelGeometry(sourceSurface, art, pack.sourcePlacement, pack.sourceAnchor, content.matrixWorld, camera, pack.sourcePeelFront ?? pack.peel, pack.sourcePull ?? { x: 0, y: 0 }, size.width, size.height);
      else { rearOrigin = createRearStickerPeelGeometry(art, pack.sourcePlacement, rear.geometry, pack.peel, sourceSurface ?? undefined, pack.sourcePeelFront ?? pack.peel); rearOrigin.applyMatrix4(content.matrixWorld); }
      source = rearOrigin.getAttribute('position');
      const center = new Vector3((.5 - pack.sourcePlacement.x) * DEVICE_LAYOUT.body.width, (.5 - pack.sourcePlacement.y) * DEVICE_LAYOUT.body.height, -DEVICE_LAYOUT.body.depth / 2).applyMatrix4(content.matrixWorld);
      const worldPixel = viewport.getCurrentViewport(camera, center).width / size.width;
      if (pack.sourceAnchor) {
        const anchorPoint = new Vector3(...pack.sourceAnchor.point).applyMatrix4(content.matrixWorld);
        rearOffset.copy(stickerCarryPointerOffset(anchorPoint, camera, size.width, size.height, pack.dragOffset?.x ?? 0, pack.dragOffset?.y ?? 0));
      } else rearOffset.set(pack.dragOffset?.x ?? 0, -(pack.dragOffset?.y ?? 0), 0).multiplyScalar(worldPixel).applyQuaternion(camera.quaternion);
    }
    // Constrain the attached peel before blending into the free sheet. Applying
    // old edge planes after transport pins detached vertices to the old shell
    // and stretches the backing into a visible tail.
    if (sourceSurface && rearOrigin && content) {
      const started = performance.now();
      const report = constrainStickerCarryExterior(sourceSurface, rearOrigin, content.matrixWorld);
      gl.domElement.setAttribute('data-wp-sticker-peel-contacts', JSON.stringify({ ...report, elapsedMs: +(performance.now() - started).toFixed(2) }));
    }
    const rawTransport = (pack.sourcePeelFront ?? pack.peel) >= 1 ? Math.max(0, Math.min(1, pack.detachTransport ?? 0)) : 0;
    const transport = rawTransport * rawTransport * (3 - 2 * rawTransport);
    const free = sourceSurface && content && pack.sourcePlacement && transport > 0 ? createStickerFreeCarryGeometry(art, pack.sourcePlacement, sourceSurface, content.matrixWorld, camera, pack.sourceAnchor, carryCurl) : null;
    if (free && rearOrigin && pack.sourceAnchor && content) {
      alignStickerCarryOrigin(rearOrigin, free, pack.sourceAnchor.uv, rearOffset);
    }
    if (free && rearOrigin) {
      const sourceUv = rearOrigin.getAttribute('uv'), centerIndex = Math.floor(sourceUv.count / 2);
      interpolateStickerCarryGeometry(rearOrigin, free, pack.sourceAnchor?.uv[0] ?? sourceUv.getX(centerIndex), pack.sourceAnchor?.uv[1] ?? sourceUv.getY(centerIndex), transport);
    }
    let target: BufferGeometry | null = null;
    if (pack.landing > 0 && pack.placement !== null && rear instanceof Mesh) {
      try { target = targetSurface && content ? createStickerLandingGeometry(art, pack.placement, targetSurface, content.matrixWorld, camera, pack.sourceAnchor?.uv, pack.peel, size.width, size.height) : null; } catch { target = null; }
    }
    const targetPositions = target?.getAttribute('position');
    const amount = targetPositions === undefined && !pack.returnToSheet ? 0 : Math.max(0, Math.min(1, pack.landing));
    // A world-Z packet plane is not a camera-depth plane when the device turns.
    // Fully detached vinyl clears the entire projected body, including its sides.
    let carriedDepth = new Vector3(0, 0, PACK.depth + pixel * 20).project(camera).z;
    if (content !== undefined) {
      const clearance = new Vector3(0, 0, pixel * 20).applyQuaternion(camera.quaternion);
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
        const corner = new Vector3(x * DEVICE_LAYOUT.body.width / 2, y * DEVICE_LAYOUT.body.height / 2, z * DEVICE_LAYOUT.body.depth / 2).applyMatrix4(content.matrixWorld).add(clearance).project(camera);
        carriedDepth = Math.min(carriedDepth, corner.z);
      }
    }
    if (pack.returnToSheet) {
      const workspace = scene.getObjectByName('sticker-pack-wrapper');
      if (workspace) {
        workspace.updateWorldMatrix(true, true);
        const bounds = new Box3().setFromObject(workspace);
        if (!bounds.isEmpty()) {
          const clearance = new Vector3(0, 0, pixel * PACK.returnClearancePx).applyQuaternion(camera.quaternion);
          for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
            carriedDepth = Math.min(carriedDepth, new Vector3(x, y, z).add(clearance).project(camera).z);
          }
        }
      }
    }
    const detachedDistance = Math.hypot(pack.dragOffset?.x ?? 0, pack.dragOffset?.y ?? 0);
    const lift = pack.returnToSheet ? transport : Math.min(1, detachedDistance / 24);
    const point = new Vector3(); const destination = new Vector3(); const start = new Vector3(originX, originY, originZ);
    for (let index = 0; index < positions.count; index++) {
      const row = Math.floor(index / (STICKER_SURFACE.segments + 1)) / STICKER_SURFACE.segments;
      const detached = stickerRearTransportWeight(row, pack.sourcePeelFront ?? pack.peel, pack.detachTransport ?? 0);
      point.fromBufferAttribute(source, index);
      if (rearOrigin === null) point.add(start); else if (!pack.sourceAnchor) point.addScaledVector(rearOffset, detached);
      if (rearOrigin !== null && lift > 0 && detached > 0) {
        // Lift the detached vinyl above the packet without changing its screen-space
        // grab point or apparent size; attached contact stays on the physical rear.
        point.project(camera); point.z += (Math.min(carriedDepth, point.z) - point.z) * lift * detached; point.unproject(camera);
      }
      if (pack.returnToSheet && base) {
        destination.fromBufferAttribute(base.getAttribute('position'), index).add(start).add(new Vector3(-(pack.dragOffset?.x ?? 0) * pixel, (pack.dragOffset?.y ?? 0) * pixel, 0));
        routeStickerReturn(point, destination, camera, carriedDepth, amount);
      }
      positions.setXYZ(index, point.x, point.y, point.z);
    }
    if (pack.sourceAnchor && pack.sourcePlacement && content && !pack.returnToSheet) {
      anchorStickerToPointer(geometry, art, pack.sourcePlacement, pack.sourceAnchor, content.matrixWorld, camera, pack.sourcePull ?? { x: 0, y: 0 }, size.width, size.height, pack.sourcePeelFront ?? pack.peel, transport);
    }
    // Transport, depth lift and landing all happen after the attached-peel
    // constraint. Resolve the final displayed geometry as well.
    if (content && targetSurface && target && !pack.returnToSheet) {
      // Dock the material frames before relaxing the fold. Blending world-space
      // vertices and then pinning each to a different edge plane tears the sheet.
      interpolateStickerCarryGeometry(geometry, target, pack.sourceAnchor?.uv[0] ?? .5, pack.sourceAnchor?.uv[1] ?? .5, amount);
      if (amount < 1) {
        carryCollision.current ??= createStickerVisibility({ workerOnly: true }); carryCollision.current.update(content);
        constrainStickerLanding(geometry, target, content.matrixWorld, camera, carryCollision.current.castSegment);
      }
    // Full depth lift already clears the entire body; don't raycast every node
    // again. Transitional frames borrow the warmed picking collider.
    } else if (content && (rearOrigin === null || transport > 0 || pack.sourceAnchor != null) && !(rearOrigin !== null && lift === 1 && transport === 1 && !pack.returnToSheet)) {
      carryCollision.current ??= createStickerVisibility({ workerOnly: true });
      carryCollision.current.update(content);
      constrainStickerFreeCarry(geometry, content.matrixWorld, camera, carryCollision.current.castSegment, sourceSurface ?? undefined);
    }
    if (pack.sourceAnchor && content && amount === 0 && !pack.returnToSheet) {
      const shown = stickerGeometryUvPoint(geometry, ...pack.sourceAnchor.uv).project(camera);
      const origin = new Vector3(...pack.sourceAnchor.point).applyMatrix4(content.matrixWorld).project(camera);
      const error = Math.hypot((shown.x - origin.x) * size.width / 2 - (pack.sourcePull?.x ?? 0), (origin.y - shown.y) * size.height / 2 - (pack.sourcePull?.y ?? 0));
      gl.domElement.setAttribute('data-wp-sticker-pointer-error', error.toFixed(4));
    } else gl.domElement.removeAttribute('data-wp-sticker-pointer-error');
    positions.needsUpdate = true;
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    base?.dispose(); rearOrigin?.dispose(); free?.dispose(); target?.dispose();
    gl.domElement.setAttribute('data-wp-sticker-peel-frame-ms', (performance.now() - frameStarted).toFixed(2));

return geometry;
}