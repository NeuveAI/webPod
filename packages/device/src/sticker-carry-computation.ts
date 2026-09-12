import { createStickerBoundsIndex } from './sticker-bounds-index';
import { drainSteps } from './sticker-computation-steps';
import { Box3, Matrix4, PerspectiveCamera, Vector3, type BufferGeometry } from 'three';
import { routeStickerReturn } from './sticker-return-path';
import { constrainStickerCarryExteriorSteps, constrainStickerFreeCarrySteps, constrainStickerLandingSteps, createStickerGrabPeelGeometrySteps, createStickerFreeCarryGeometrySteps, interpolateStickerCarryGeometrySteps, createStickerLandingGeometrySteps, anchorStickerToPointerSteps,  constrainStickerCarryExterior, stickerCarryPointerOffset, alignStickerCarryOrigin, stickerGeometryUvPoint } from './sticker-free-carry';
import { createStickerPeelGeometrySteps, createRearStickerPeelGeometrySteps,  createStickerSurfaceGeometry, createRearStickerPeelGeometry, STICKER_SURFACE, stickerRearTransportWeight } from './sticker-surface';
import { conformStickerToPaper } from './sticker-paper';
import { DEVICE_LAYOUT } from './layout';
import type { StickerArtwork, StickerPackVisual } from './sticker-contract';
import type { createStickerCollision } from './sticker-collision';
const PACK = { depth: 130, returnClearancePx: 20, returnCurl: .35 };
export interface CarryInput {
  readonly art: StickerArtwork; readonly pack: StickerPackVisual;
  readonly width: number; readonly paperWidth: number; readonly pixel: number; readonly seatX: number;
  readonly origin: readonly [number, number, number]; readonly world: readonly number[];
  readonly cameraWorld: readonly number[]; readonly projection: readonly number[];
  readonly viewportWidth: number; readonly viewportHeight: number; readonly worldPixel: number;
  readonly workspaceBounds: { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] } | null;
}
/** Atomic deformation in world coordinates. All geometry and collider inputs are worker-owned. */
export function computeStickerCarry(input: CarryInput, rearGeometry: BufferGeometry, sourceSurface: BufferGeometry | null, targetSurface: BufferGeometry | null, collider: ReturnType<typeof createStickerCollision>) { return drainSteps(computeStickerCarrySteps(input, rearGeometry, sourceSurface, targetSurface, collider)); }
export function* computeStickerCarrySteps(input: CarryInput, rearGeometry: BufferGeometry, sourceSurface: BufferGeometry | null, targetSurface: BufferGeometry | null, collider: ReturnType<typeof createStickerCollision>) {
  let stepCount = 0;
  const { art, pack, width, paperWidth, pixel, seatX } = input;
  const [originX, originY, originZ] = input.origin;
  const size = { width: input.viewportWidth, height: input.viewportHeight };
  const content = { matrixWorld: new Matrix4().fromArray(input.world) }, rear = { geometry: rearGeometry };
  const camera = new PerspectiveCamera(); camera.matrixAutoUpdate = false;
  camera.matrix.fromArray(input.cameraWorld); camera.matrixWorld.copy(camera.matrix); camera.matrixWorldInverse.copy(camera.matrix).invert();
  camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
  camera.projectionMatrix.fromArray(input.projection); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  const geometry = conformStickerToPaper((yield* createStickerPeelGeometrySteps(art, width, 0, STICKER_SURFACE.segments)), paperWidth, pixel, seatX);
  let contacts: (ReturnType<typeof constrainStickerCarryExterior> & { elapsedMs: number }) | null = null, pointerError: number | null = null;
    const carryCurl = pack.returnToSheet ? Math.min(pack.peel, PACK.returnCurl) : pack.peel;
    // Paper geometry is only needed for a sheet pickup or an explicit return.
    const base = !sourceSurface || pack.returnToSheet ? conformStickerToPaper((yield* createStickerPeelGeometrySteps(art, width, carryCurl, STICKER_SURFACE.segments)), paperWidth, pixel, seatX) : null;
    const positions = geometry.getAttribute('position');
    let source = (base ?? sourceSurface ?? geometry).getAttribute('position');
    let rearOrigin: ReturnType<typeof createRearStickerPeelGeometry> | null = null;
    const rearOffset = new Vector3();
    if (pack.sourcePlacement != null && rear !== null && content !== undefined) {
      if (sourceSurface && pack.sourceAnchor) rearOrigin = (yield* createStickerGrabPeelGeometrySteps(sourceSurface, art, pack.sourcePlacement, pack.sourceAnchor, content.matrixWorld, camera, pack.sourcePeelFront ?? pack.peel, pack.sourcePull ?? { x: 0, y: 0 }, size.width, size.height));
      else { rearOrigin = (yield* createRearStickerPeelGeometrySteps(art, pack.sourcePlacement, rear.geometry, pack.peel, sourceSurface ?? undefined, pack.sourcePeelFront ?? pack.peel)); rearOrigin.applyMatrix4(content.matrixWorld); }
      source = rearOrigin.getAttribute('position');
      const worldPixel = input.worldPixel;
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
      const report = (yield* constrainStickerCarryExteriorSteps(sourceSurface, rearOrigin, content.matrixWorld));
      contacts = { ...report, elapsedMs: +(performance.now() - started).toFixed(2) };
    }
    const rawTransport = (pack.sourcePeelFront ?? pack.peel) >= 1 ? Math.max(0, Math.min(1, pack.detachTransport ?? 0)) : 0;
    const transport = rawTransport * rawTransport * (3 - 2 * rawTransport);
    const free = sourceSurface && content && pack.sourcePlacement && transport > 0 ? (yield* createStickerFreeCarryGeometrySteps(art, pack.sourcePlacement, sourceSurface, content.matrixWorld, camera, pack.sourceAnchor, carryCurl)) : null;
    if (free && rearOrigin && pack.sourceAnchor && content) {
      alignStickerCarryOrigin(rearOrigin, free, pack.sourceAnchor.uv, rearOffset);
    }
    if (free && rearOrigin) {
      const sourceUv = rearOrigin.getAttribute('uv'), centerIndex = Math.floor(sourceUv.count / 2);
      (yield* interpolateStickerCarryGeometrySteps(rearOrigin, free, pack.sourceAnchor?.uv[0] ?? sourceUv.getX(centerIndex), pack.sourceAnchor?.uv[1] ?? sourceUv.getY(centerIndex), transport));
    }
    let target: ReturnType<typeof createStickerSurfaceGeometry> | null = null;
    if (pack.landing > 0 && pack.placement !== null && rear !== null) {
      try { target = targetSurface && content ? (yield* createStickerLandingGeometrySteps(art, pack.placement, targetSurface, content.matrixWorld, camera, pack.sourceAnchor?.uv, pack.peel, size.width, size.height)) : null; } catch { target = null; }
    }
    const targetPositions = target?.getAttribute('position');
    const amount = targetPositions === undefined && !pack.returnToSheet ? 0 : Math.max(0, Math.min(1, pack.landing));
    // A world-Z packet plane is not a camera-depth plane when the device turns.
    // Fully detached vinyl clears the entire projected body, including its sides.
    let carriedDepth = new Vector3(0, 0, PACK.depth + pixel * 20).project(camera).z;
    if (content !== undefined) {
      const clearance = new Vector3(0, 0, pixel * 20).applyQuaternion(camera.quaternion);
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    if (++stepCount % 128 === 0) yield;
        const corner = new Vector3(x * DEVICE_LAYOUT.body.width / 2, y * DEVICE_LAYOUT.body.height / 2, z * DEVICE_LAYOUT.body.depth / 2).applyMatrix4(content.matrixWorld).add(clearance).project(camera);
        carriedDepth = Math.min(carriedDepth, corner.z);
      }
    }
    if (pack.returnToSheet) {
      if (input.workspaceBounds) {
        const bounds = new Box3(new Vector3(...input.workspaceBounds.min), new Vector3(...input.workspaceBounds.max));
        if (!bounds.isEmpty()) {
          const clearance = new Vector3(0, 0, pixel * PACK.returnClearancePx).applyQuaternion(camera.quaternion);
          for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    if (++stepCount % 128 === 0) yield;
            carriedDepth = Math.min(carriedDepth, new Vector3(x, y, z).add(clearance).project(camera).z);
          }
        }
      }
    }
    const detachedDistance = Math.hypot(pack.dragOffset?.x ?? 0, pack.dragOffset?.y ?? 0);
    const lift = pack.returnToSheet ? transport : Math.min(1, detachedDistance / 24);
    const point = new Vector3(); const destination = new Vector3(); const start = new Vector3(originX, originY, originZ);
    for (let index = 0; index < positions.count; index++) {
    if (++stepCount % 128 === 0) yield;
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
      (yield* anchorStickerToPointerSteps(geometry, art, pack.sourcePlacement, pack.sourceAnchor, content.matrixWorld, camera, pack.sourcePull ?? { x: 0, y: 0 }, size.width, size.height, pack.sourcePeelFront ?? pack.peel, transport));
    }
    // Transport, depth lift and landing all happen after the attached-peel
    // constraint. Resolve the final displayed geometry as well.
    if (content && targetSurface && target && !pack.returnToSheet) {
      // Dock the material frames before relaxing the fold. Blending world-space
      // vertices and then pinning each to a different edge plane tears the sheet.
      (yield* interpolateStickerCarryGeometrySteps(geometry, target, pack.sourceAnchor?.uv[0] ?? .5, pack.sourceAnchor?.uv[1] ?? .5, amount));
      if (amount < 1) {
        (yield* constrainStickerLandingSteps(geometry, target, content.matrixWorld, camera, collider.castSegment));
      }
    // Full depth lift already clears the entire body; don't raycast every node
    // again. Transitional frames borrow the warmed picking collider.
    } else if (content && (rearOrigin === null || transport > 0 || pack.sourceAnchor != null) && !(rearOrigin !== null && lift === 1 && transport === 1 && !pack.returnToSheet)) {
      (yield* constrainStickerFreeCarrySteps(geometry, content.matrixWorld, camera, collider.castSegment, sourceSurface ?? undefined));
    }
    if (pack.sourceAnchor && content && amount === 0 && !pack.returnToSheet) {
      const shown = stickerGeometryUvPoint(geometry, ...pack.sourceAnchor.uv).project(camera);
      const origin = new Vector3(...pack.sourceAnchor.point).applyMatrix4(content.matrixWorld).project(camera);
      const error = Math.hypot((shown.x - origin.x) * size.width / 2 - (pack.sourcePull?.x ?? 0), (origin.y - shown.y) * size.height / 2 - (pack.sourcePull?.y ?? 0));
      pointerError = error;
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    base?.dispose(); rearOrigin?.dispose(); free?.dispose(); target?.dispose();


  const bounds = yield* createStickerBoundsIndex(geometry.getAttribute('position').array);
  return { geometry, contacts, pointerError, bounds };
}
