import { Matrix4, Vector3, Mesh, type Camera, type Object3D } from 'three';
import { isStickerRearCenter } from '@webpod/stickers';
import { DEVICE_LAYOUT } from './layout';
import { stickerVisibleAspect } from './sticker-surface';
import type { DeviceStickerPlacement, StickerArtwork, StickerSurfaceGrab } from './sticker-contract';

type Rect = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
export type StickerMaterialHit = {
  readonly object: Object3D;
  readonly uv?: { readonly x: number; readonly y: number };
  readonly point: Vector3;
  readonly face?: { readonly a: number; readonly b: number; readonly c: number } | null;
};

/** One frozen affine material frame from the actual visible printed triangle.
 * Detached pointer transport and the eventual seated geometry are independent.
 */
export function captureStickerSurfaceGrab(
  placement: DeviceStickerPlacement, art: StickerArtwork, hit: StickerMaterialHit,
  pointer: { readonly x: number; readonly y: number }, content: Object3D, camera: Camera,
  canvas: { getBoundingClientRect(): Rect }, current: () => boolean,
): StickerSurfaceGrab | null {
  if (!(hit.object instanceof Mesh) || hit.face == null || ![pointer.x, pointer.y].every(Number.isFinite)) return null;
  content.updateWorldMatrix(true, false); camera.updateMatrixWorld(); hit.object.updateWorldMatrix(true, false);
  const r = canvas.getBoundingClientRect(), rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
  const contentMatrix = content.matrixWorld.clone(), cameraMatrix = camera.matrixWorld.clone(), projection = camera.projectionMatrix.clone();
  const inverseContent = contentMatrix.clone().invert();
  const meshToContent = inverseContent.clone().multiply(hit.object.matrixWorld);
  const matrix = new Matrix4().copy(projection).multiply(camera.matrixWorldInverse).multiply(contentMatrix);
  const positions = hit.object.geometry.getAttribute('position'), uv = hit.object.geometry.getAttribute('uv');
  if (positions === undefined || uv === undefined) return null;
  const { width: bodyWidth, height: bodyHeight } = DEVICE_LAYOUT.body;
  const width = placement.width * bodyWidth, height = width * stickerVisibleAspect(art);
  const [left, top, right, bottom] = art.visibleBounds;
  const material = (i: number) => ({
    x: -((uv.getX(i) * art.width - left) / (right - left) - .5) * width,
    y: -(((1 - uv.getY(i)) * art.height - top) / (bottom - top) - .5) * height,
  });
  const { a, b, c } = hit.face;
  if ([a, b, c].some(i => i < 0 || i >= positions.count || i >= uv.count)) return null;
  const ma = material(a), mb = material(b), mc = material(c);
  const ux = mb.x - ma.x, uy = mb.y - ma.y, vx = mc.x - ma.x, vy = mc.y - ma.y;
  const determinant = ux * vy - uy * vx;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-10) return null;
  const pa = new Vector3().fromBufferAttribute(positions, a).applyMatrix4(meshToContent);
  const ab = new Vector3().fromBufferAttribute(positions, b).applyMatrix4(meshToContent).sub(pa);
  const ac = new Vector3().fromBufferAttribute(positions, c).applyMatrix4(meshToContent).sub(pa);
  const tangentU = ab.clone().multiplyScalar(vy).addScaledVector(ac, -uy).multiplyScalar(1 / determinant);
  const tangentV = ac.clone().multiplyScalar(ux).addScaledVector(ab, -vx).multiplyScalar(1 / determinant);
  if (tangentU.lengthSq() < 1e-12) return null;
  tangentU.normalize(); tangentV.addScaledVector(tangentU, -tangentU.dot(tangentV));
  if (tangentV.lengthSq() < 1e-12) return null;
  tangentV.normalize();
  const origin = hit.point.clone().applyMatrix4(inverseContent);
  const screen = (point: Vector3) => {
    const p = point.applyMatrix4(matrix);
    return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
  };
  const at = screen(origin.clone()), alongU = screen(origin.clone().add(tangentU)), alongV = screen(origin.clone().add(tangentV));
  const j00 = alongU.x - at.x, j10 = alongU.y - at.y, j01 = alongV.x - at.x, j11 = alongV.y - at.y;
  const det = j00 * j11 - j01 * j10, sum = j00 ** 2 + j01 ** 2 + j10 ** 2 + j11 ** 2;
  const largest = Math.sqrt((sum + Math.sqrt(Math.max(0, sum * sum - 4 * det * det))) / 2);
  const smallest = Math.abs(det) / largest;
  if (![det, largest, smallest].every(Number.isFinite) || largest <= 1e-12) return null;
  // Clamp the inverse's weak singular gain instead of refusing visible ink at
  // grazing angles. The carried sheet follows the pointer independently; this
  // bounded local destination frame need not undo extreme foreshortening.
  const axis = .5 * Math.atan2(2 * (j00 * j01 + j10 * j11), j00 ** 2 + j10 ** 2 - j01 ** 2 - j11 ** 2);
  const cs = Math.cos(axis), sn = Math.sin(axis);
  const w1x = (j00 * cs + j01 * sn) / largest, w1y = (j10 * cs + j11 * sn) / largest;
  const sign = det < 0 ? -1 : 1;
  const w2x = smallest > largest * 1e-12 ? (-j00 * sn + j01 * cs) / smallest : -w1y * sign;
  const w2y = smallest > largest * 1e-12 ? (-j10 * sn + j11 * cs) / smallest : w1x * sign;
  const weakGain = 1 / Math.max(smallest, largest * .05);
  const i00 = cs * w1x / largest - sn * w2x * weakGain;
  const i01 = cs * w1y / largest - sn * w2y * weakGain;
  const i10 = sn * w1x / largest + cs * w2x * weakGain;
  const i11 = sn * w1y / largest + cs * w2y * weakGain;
  const angle = placement.rotationDeg * Math.PI / 180, cosine = Math.cos(angle), sine = Math.sin(angle);
  const same = (a: Matrix4, b: Matrix4) => a.elements.every((value, i) => Math.abs(value - (b.elements[i] ?? Infinity)) < 1e-9);
  const isValid = () => {
    content.updateWorldMatrix(true, false); camera.updateMatrixWorld();
    const r = canvas.getBoundingClientRect();
    return current() && r.left === rect.left && r.top === rect.top && r.width === rect.width && r.height === rect.height && same(content.matrixWorld, contentMatrix) && same(camera.matrixWorld, cameraMatrix) && same(camera.projectionMatrix, projection);
  };
  const anchor = hit.uv ? { uv: [hit.uv.x, hit.uv.y] as const, point: [origin.x, origin.y, origin.z] as const, tangentU: [-tangentU.x, -tangentU.y, -tangentU.z] as const } : undefined;
  return { placement, anchor, isValid, projectCenter(clientX, clientY) {
    if (!isValid() || ![clientX, clientY].every(Number.isFinite)) return null;
    const dx = clientX - pointer.x, dy = clientY - pointer.y;
    const u = i00 * dx + i01 * dy, v = i10 * dx + i11 * dy;
    const x = placement.x - (u * cosine - v * sine) / bodyWidth;
    const y = placement.y - (u * sine + v * cosine) / bodyHeight;
    return isStickerRearCenter(x, y) ? { x, y } : null;
  } };
}
