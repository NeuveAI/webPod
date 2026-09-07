import { Matrix4, Vector3, type Camera, type Object3D, type Vector2 } from 'three';
import { isStickerRearCenter } from '@webpod/stickers';
import type { StickerBendFootprint } from './sticker-corner-cage';
import { DEVICE_LAYOUT } from './layout';
import { stickerVisibleAspect, sampleStickerSurfaceGrid } from './sticker-surface';
import type { StickerWrapSurface } from './sticker-wrap';
import type { DeviceStickerPlacement, StickerArtwork, StickerSurfaceGrab } from './sticker-contract';

type Rect = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
/** Frozen actual material-UV inverse. Solves the shown bend's projected grab point,
 * never treats a side/front surface hit as a persisted rear center. */
export function captureStickerSurfaceGrab(
  placement: DeviceStickerPlacement, art: StickerArtwork, uv: Vector2,
  pointer: { readonly x: number; readonly y: number }, content: Object3D, camera: Camera,
  canvas: { getBoundingClientRect(): Rect }, wrap: { cornerCage(x: number, y: number, footprint: StickerBendFootprint): Pick<ReturnType<StickerWrapSurface['cornerCage']>, 'point'> }, current: () => boolean,
): StickerSurfaceGrab | null {
  content.updateWorldMatrix(true, false); camera.updateMatrixWorld();
  const r = canvas.getBoundingClientRect(), rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  if (!(rect.width > 0 && rect.height > 0)) return null;
  const contentMatrix = content.matrixWorld.clone(), cameraMatrix = camera.matrixWorld.clone(), projection = camera.projectionMatrix.clone();
  const matrix = new Matrix4().copy(projection).multiply(camera.matrixWorldInverse).multiply(contentMatrix);
  const { width: bodyWidth, height: bodyHeight } = DEVICE_LAYOUT.body;
  const width = placement.width * bodyWidth, height = width * stickerVisibleAspect(art);
  const [left, top, right, bottom] = art.visibleBounds;
  const u = (uv.x * art.width - left) / (right - left), v = ((1 - uv.y) * art.height - top) / (bottom - top);
  const angle = placement.rotationDeg * Math.PI / 180;
  const project = (x: number, y: number) => {
    if (!isStickerRearCenter(.5 - x / bodyWidth, .5 - y / bodyHeight)) return null;
    try {
      const cage = wrap.cornerCage(x, y, { width, height, angle });
      const point = sampleStickerSurfaceGrid(cage.point, width, height, angle, u, v).applyMatrix4(matrix);
      if (![point.x, point.y, point.z].every(Number.isFinite) || point.z < -1 || point.z > 1) return null;
      return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
    } catch { return null; }
  };
  let lastX = (.5 - placement.x) * bodyWidth, lastY = (.5 - placement.y) * bodyHeight;
  const initialX = lastX, initialY = lastY, inverseMatrix = matrix.clone().invert();
  const sourceCage = wrap.cornerCage(lastX, lastY, { width, height, angle });
  const sourcePoint = sampleStickerSurfaceGrid(sourceCage.point, width, height, angle, u, v);
  const start = project(lastX, lastY); if (start === null) return null;
  const offset = { x: pointer.x - start.x, y: pointer.y - start.y };
  const same = (a: Matrix4, b: Matrix4) => a.elements.every((value, i) => Math.abs(value - (b.elements[i] ?? Infinity)) < 1e-9);
  const isValid = () => {
    content.updateWorldMatrix(true, false); camera.updateMatrixWorld();
    const r = canvas.getBoundingClientRect();
    return current() && r.left === rect.left && r.top === rect.top && r.width === rect.width && r.height === rect.height && same(content.matrixWorld, contentMatrix) && same(camera.matrixWorld, cameraMatrix) && same(camera.projectionMatrix, projection);
  };
  return { placement, isValid, projectCenter(clientX, clientY) {
    if (!isValid() || ![clientX, clientY].every(Number.isFinite)) return null;
    const targetX = clientX - offset.x, targetY = clientY - offset.y;
    const solve = (seedX: number, seedY: number) => {
      let x = seedX, y = seedY;
      // At most six Newton steps, each with four admissible trial evaluations.
      // Only an accepted exact shown-UV residual publishes a new warm start.
      for (let iteration = 0; iteration < 6; iteration++) {
        const p = project(x, y); if (p === null) return null;
        const ex = targetX - p.x, ey = targetY - p.y, error = Math.hypot(ex, ey);
        if (error < .5) return { x, y };
        const e = .1;
        let qx = project(x + e, y), sx = e; if (qx === null) { qx = project(x - e, y); sx = -e; }
        let qy = project(x, y + e), sy = e; if (qy === null) { qy = project(x, y - e); sy = -e; }
        if (qx === null || qy === null) return null;
        const a = (qx.x - p.x) / sx, b = (qy.x - p.x) / sy, c = (qx.y - p.y) / sx, d = (qy.y - p.y) / sy, determinant = a * d - b * c;
        if (Math.abs(determinant) < 1e-8) return null;
        const stepX = (ex * d - ey * b) / determinant, stepY = (ey * a - ex * c) / determinant;
        let scale = Math.min(1, 24 / Math.max(24, Math.hypot(stepX, stepY))), accepted = false;
        for (let trial = 0; trial < 4; trial++, scale *= .5) {
          const nextX = x + stepX * scale, nextY = y + stepY * scale, next = project(nextX, nextY);
          if (next !== null && Math.hypot(targetX - next.x, targetY - next.y) < error) {
            x = nextX; y = nextY; accepted = true; break;
          }
        }
        if (!accepted) return null;
      }
      const final = project(x, y);
      return final !== null && Math.hypot(targetX - final.x, targetY - final.y) < .5 ? { x, y } : null;
    };
    let solved = solve(lastX, lastY);
    if (solved === null) {
      // Cold admission happens only after the 64px peel. A local Newton trial
      // can point outside the rounded center domain even when a target exists.
      // The frozen physical XY plane supplies one alternate seed, never an
      // accepted placement: it still must converge through the exact UV map.
      const ndcX = (targetX - rect.left) / rect.width * 2 - 1, ndcY = 1 - (targetY - rect.top) / rect.height * 2;
      const near = new Vector3(ndcX, ndcY, -1).applyMatrix4(inverseMatrix);
      const span = new Vector3(ndcX, ndcY, 1).applyMatrix4(inverseMatrix).sub(near);
      if (Math.abs(span.z) > 1e-9) {
        const plane = near.addScaledVector(span, (sourcePoint.z - near.z) / span.z);
        solved = solve(initialX + plane.x - sourcePoint.x, initialY + plane.y - sourcePoint.y);
      }
    }
    if (solved !== null) {
      lastX = solved.x; lastY = solved.y;
      return { x: .5 - lastX / bodyWidth, y: .5 - lastY / bodyHeight };
    }
    return null;
  } };
}
