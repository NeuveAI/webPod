import { Matrix4, Vector3, type Camera, type Mesh, type Object3D } from 'three';
import { DEVICE_LAYOUT } from './layout';
import type { StickerProjectedQuad, StickerTransformPlane } from './sticker-contract';

type CanvasRect = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
const validCanvas = (r: CanvasRect) => [r.left, r.top, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0;

/** Samples the actual visible-art UV boundary, preserving artwork order under model rotation. */
export function stickerProjectedQuad(print: Mesh, camera: Camera, canvas: CanvasRect): StickerProjectedQuad | null {
  const positions = print.geometry.getAttribute('position');
  const uv = print.geometry.getAttribute('uv');
  if (!validCanvas(canvas) || !positions || !uv || positions.count !== uv.count || uv.count === 0) return null;
  let minU = Infinity; let maxU = -Infinity; let minV = Infinity; let maxV = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i); const v = uv.getY(i);
    if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
    minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  if (minU === maxU || minV === maxV) return null;
  print.updateWorldMatrix(true, false); camera.updateMatrixWorld();
  const sample = (u: number, v: number) => {
    let best = Infinity; let index = 0;
    for (let i = 0; i < uv.count; i++) {
      const distance = (uv.getX(i) - u) ** 2 + (uv.getY(i) - v) ** 2;
      if (distance < best) { best = distance; index = i; }
    }
    // The production grid includes exact corners, edge midpoints and center.
    if (best > 1e-10) return null;
    const point = new Vector3().fromBufferAttribute(positions, index).applyMatrix4(print.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    if (!Number.isFinite(point.z) || point.z >= 0) return null;
    point.applyMatrix4(camera.projectionMatrix);
    if (![point.x, point.y, point.z].every(Number.isFinite) || point.z < -1 || point.z > 1) return null;
    return { x: canvas.left + (point.x + 1) * canvas.width / 2, y: canvas.top + (1 - point.y) * canvas.height / 2 };
  };
  const midU = (minU + maxU) / 2; const midV = (minV + maxV) / 2;
  const tl = sample(minU, maxV); const tr = sample(maxU, maxV); const br = sample(maxU, minV); const bl = sample(minU, minV);
  const top = sample(midU, maxV); const right = sample(maxU, midV); const bottom = sample(midU, minV); const left = sample(minU, midV); const center = sample(midU, midV);
  if (!tl || !tr || !br || !bl || !top || !right || !bottom || !left || !center) return null;
  const corners = [tl, tr, br, bl] as const;
  const area = corners.reduce((sum, p, i) => { const q = corners[(i + 1) % 4] ?? tl; return sum + p.x * q.y - q.x * p.y; }, 0);
  if (Math.abs(area) < 1e-4) return null;
  return { corners, edges: [top, right, bottom, left], center };
}

/** Capture an unbounded editing plane at the selected center's content-local depth.
 * This is a planar editing coordinate system, not an inverse of the curved shoulder.
 * Preserve the initial pointer offset; cancel on viewport or device-pose changes.
 */
export function captureStickerTransformPlane(content: Object3D, camera: Camera, canvas: CanvasRect, localDepth: number): StickerTransformPlane | null {
  if (!validCanvas(canvas) || !Number.isFinite(localDepth)) return null;
  content.updateWorldMatrix(true, false); camera.updateMatrixWorld();
  if (Math.abs(content.matrixWorld.determinant()) < 1e-12) return null;
  const matrix = new Matrix4().copy(content.matrixWorld).invert().multiply(camera.matrixWorld).multiply(camera.projectionMatrixInverse);
  if (!matrix.elements.every(Number.isFinite)) return null;
  const rect = { left: canvas.left, top: canvas.top, width: canvas.width, height: canvas.height };
  return { project(clientX, clientY) {
    if (![clientX, clientY].every(Number.isFinite)) return null;
    const x = (clientX - rect.left) / rect.width * 2 - 1; const y = 1 - (clientY - rect.top) / rect.height * 2;
    const near = new Vector3(x, y, -1).applyMatrix4(matrix); const far = new Vector3(x, y, 1).applyMatrix4(matrix);
    const direction = far.sub(near);
    if (Math.abs(direction.z) <= direction.length() * 1e-8) return null;
    const t = (localDepth - near.z) / direction.z;
    if (!Number.isFinite(t) || t < 0) return null;
    near.addScaledVector(direction, t);
    const point = { x: .5 - near.x / DEVICE_LAYOUT.body.width, y: .5 - near.y / DEVICE_LAYOUT.body.height };
    return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
  } };
}
