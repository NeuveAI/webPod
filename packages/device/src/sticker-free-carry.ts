import { Matrix4, Quaternion, Vector3, type BufferGeometry, type Camera } from 'three';
import type { DeviceStickerPlacement, StickerArtwork, StickerCarryAnchor } from './sticker-contract';
import { createStickerPeelGeometry, STICKER_SURFACE } from './sticker-surface';
import { DEVICE_LAYOUT } from './layout';
import type { StickerCollisionHit } from './sticker-collision';

type StickerContactCast = (start: Vector3, end: Vector3) => StickerCollisionHit | null;

/** Bounded first-contact sliding. Coordinates and film distance are content-local.
 * The caller supplies an independently exterior seated source. This constrains
 * nodes only; it does not certify triangle interiors or a complete swept sheet.
 */
export function constrainStickerCarryContacts(source: BufferGeometry, shownWorld: BufferGeometry, contentWorld: Matrix4, cast: StickerContactCast) {
  const original = source.getAttribute('position'), shown = shownWorld.getAttribute('position'), inverse = contentWorld.clone().invert();
  const start = new Vector3(), current = new Vector3(), goal = new Vector3(), direction = new Vector3(), normal = new Vector3(), remainder = new Vector3();
  let moved = 0, contacts = 0, unresolved = 0, queries = 0;
  for (let i = 0; i < shown.count; i++) {
    start.fromBufferAttribute(original, i); goal.fromBufferAttribute(shown, i).applyMatrix4(inverse);
    if (start.distanceToSquared(goal) < 1e-12) continue;
    moved++; current.copy(start); let touched = false, finished = false;
    for (let step = 0; step < 3; step++) {
      queries++; const hit = cast(current, goal);
      if (!hit) { current.copy(goal); finished = true; break; }
      touched = true; contacts++; direction.copy(goal).sub(current); normal.copy(hit.normal);
      if (normal.dot(remainder.copy(current).sub(hit.point)) < 0) normal.negate();
      const separation = Math.max(0, normal.dot(remainder.copy(current).sub(hit.point))), inward = -normal.dot(direction);
      if (inward <= 1e-12) break;
      // Never push the existing source away merely to manufacture clearance.
      const film = Math.min(STICKER_SURFACE.lift, separation);
      current.addScaledVector(direction, Math.max(0, Math.min(1, (separation - film) / inward)));
      remainder.copy(goal).sub(current); remainder.addScaledVector(normal, -Math.min(0, remainder.dot(normal))); goal.copy(current).add(remainder);
      if (remainder.lengthSq() < 1e-12) { finished = true; break; }
    }
    if (!finished) unresolved++;
    if (touched) { current.applyMatrix4(contentWorld); shown.setXYZ(i, current.x, current.y, current.z); }
  }
  return { moved, contacts, unresolved, queries };
}

/** A seated point's outward supporting plane excludes the convex rear shell.
 * Project only inward displacement onto that plane. Linear in vertex count,
 * without scene traversal, BVH construction or thousands of contact raycasts.
 */
export function constrainStickerCarryExterior(source: BufferGeometry, shownWorld: BufferGeometry, contentWorld: Matrix4) {
  const original = source.getAttribute('position'), normals = source.getAttribute('normal'), shown = shownWorld.getAttribute('position');
  const inverse = contentWorld.clone().invert(), start = new Vector3(), goal = new Vector3(), normal = new Vector3(), delta = new Vector3();
  let contacts = 0;
  for (let i = 0; i < shown.count; i++) {
    start.fromBufferAttribute(original, i); goal.fromBufferAttribute(shown, i).applyMatrix4(inverse);
    normal.fromBufferAttribute(normals, i).normalize();
    const inward = delta.copy(goal).sub(start).dot(normal);
    if (inward >= -1e-4) continue;
    goal.addScaledVector(normal, -inward).applyMatrix4(contentWorld);
    shown.setXYZ(i, goal.x, goal.y, goal.z); contacts++;
  }
  return { contacts, vertices: shown.count, queries: 0 };
}

/** Sample the same two indexed material triangles used for shown sticker geometry. */
export function stickerGeometryUvPoint(geometry: BufferGeometry, u: number, v: number): Vector3 {
  const uv = geometry.getAttribute('uv'), positions = geometry.getAttribute('position'), n = STICKER_SURFACE.segments;
  const gx = Math.max(0, Math.min(n, (u - uv.getX(0)) / (uv.getX(n) - uv.getX(0)) * n));
  const gy = Math.max(0, Math.min(n, (uv.getY(0) - v) / (uv.getY(0) - uv.getY(n * (n + 1))) * n));
  const x = Math.min(n - 1, Math.floor(gx)), y = Math.min(n - 1, Math.floor(gy)), fx = gx - x, fy = gy - y, a = y * (n + 1) + x, b = a + 1, c = a + n + 1;
  const result = new Vector3(), vertex = new Vector3();
  for (const [index, weight] of fx + fy <= 1 ? [[a, 1 - fx - fy], [b, fx], [c, fy]] : [[b, 1 - fy], [c, 1 - fx], [c + 1, fx + fy - 1]]) {
    if (index !== undefined && weight !== undefined) result.addScaledVector(vertex.fromBufferAttribute(positions, index), weight);
  }
  return result;
}

/** One original-UV cylindrical sheet, anchored at the captured material point.
 * No wrapped per-column origins or tangent fields survive full detachment.
 */
export function createStickerFreeCarryGeometry(art: StickerArtwork, placement: DeviceStickerPlacement, source: BufferGeometry, contentWorld: Matrix4, camera: Camera, anchor: StickerCarryAnchor | null | undefined, curl: number): BufferGeometry {
  const n = STICKER_SURFACE.segments, centerIndex = n / 2 * (n + 1) + n / 2;
  const positions = source.getAttribute('position'), uv = source.getAttribute('uv');
  const localPoint = anchor ? new Vector3(...anchor.point) : new Vector3().fromBufferAttribute(positions, centerIndex);
  const tangent = anchor ? new Vector3(...anchor.tangentU) : new Vector3().fromBufferAttribute(positions, centerIndex + 1).sub(new Vector3().fromBufferAttribute(positions, centerIndex - 1)).normalize();
  const worldPoint = localPoint.applyMatrix4(contentWorld), worldTangent = tangent.transformDirection(contentWorld);
  const a = worldPoint.clone().project(camera), b = worldPoint.clone().add(worldTangent).project(camera);
  const quaternion = camera.getWorldQuaternion(new Quaternion()), right = new Vector3(1, 0, 0).applyQuaternion(quaternion), up = new Vector3(0, 1, 0).applyQuaternion(quaternion), normal = new Vector3(0, 0, 1).applyQuaternion(quaternion);
  const axisX = right.clone().multiplyScalar((b.x - a.x) * (camera.projectionMatrix.elements[5] ?? 1) / (camera.projectionMatrix.elements[0] ?? 1)).addScaledVector(up, b.y - a.y);
  if (axisX.lengthSq() < 1e-20) axisX.copy(right); else axisX.normalize();
  const axisY = normal.clone().cross(axisX).normalize();
  const geometry = createStickerPeelGeometry(art, placement.width * DEVICE_LAYOUT.body.width * contentWorld.getMaxScaleOnAxis(), curl, n);
  const at = stickerGeometryUvPoint(geometry, anchor?.uv[0] ?? uv.getX(centerIndex), anchor?.uv[1] ?? uv.getY(centerIndex));
  const output = geometry.getAttribute('position'), point = new Vector3();
  for (let i = 0; i < output.count; i++) {
    point.fromBufferAttribute(output, i).sub(at);
    const x = point.x, y = point.y, z = point.z;
    point.copy(worldPoint).addScaledVector(axisX, x).addScaledVector(axisY, y).addScaledVector(normal, z);
    output.setXYZ(i, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

/** Factor proper material-frame rotation before blending residual shape, so a
 * half-turn between shell and camera frames cannot flatten the entire sheet. */
export function interpolateStickerCarryGeometry(source: BufferGeometry, canonical: BufferGeometry, u: number, v: number, transport: number): void {
  const t = Math.max(0, Math.min(1, transport)); if (t === 0) return;
  const output = source.getAttribute('position'), destination = canonical.getAttribute('position');
  if (output.count !== destination.count) throw new Error('Carry topology mismatch');
  if (t === 1) { for (let i = 0; i < output.count; i++) output.setXYZ(i, destination.getX(i), destination.getY(i), destination.getZ(i)); return; }
  const frame = (geometry: BufferGeometry) => {
    const uv = geometry.getAttribute('uv'), n = STICKER_SURFACE.segments, du = Math.abs(uv.getX(n) - uv.getX(0)) / n / 4, dv = Math.abs(uv.getY(0) - uv.getY(n * (n + 1))) / n / 4;
    const origin = stickerGeometryUvPoint(geometry, u, v);
    const x = stickerGeometryUvPoint(geometry, u + du, v).sub(stickerGeometryUvPoint(geometry, u - du, v)).normalize();
    const y = stickerGeometryUvPoint(geometry, u, v + dv).sub(stickerGeometryUvPoint(geometry, u, v - dv)); y.addScaledVector(x, -x.dot(y)).normalize();
    const z = x.clone().cross(y).normalize();
    if (Math.min(x.lengthSq(), y.lengthSq(), z.lengthSq()) < .99) throw new Error('Degenerate carry material frame');
    return { origin, rotation: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z)) };
  };
  const a = frame(source), b = frame(canonical), inverseA = a.rotation.clone().invert(), inverseB = b.rotation.clone().invert(), rotation = a.rotation.clone().slerp(b.rotation, t), origin = a.origin.clone().lerp(b.origin, t);
  const point = new Vector3(), target = new Vector3();
  for (let i = 0; i < output.count; i++) {
    point.fromBufferAttribute(output, i).sub(a.origin).applyQuaternion(inverseA);
    target.fromBufferAttribute(destination, i).sub(b.origin).applyQuaternion(inverseB);
    point.lerp(target, t).applyQuaternion(rotation).add(origin); output.setXYZ(i, point.x, point.y, point.z);
  }
}

/** Exact captured-depth camera-plane translation; center-depth viewport scaling
 * drifts when a picked piece of artwork lies on the wrapped front or side. */
export function stickerCarryPointerOffset(point: Vector3, camera: Camera, width: number, height: number, dx: number, dy: number): Vector3 {
  const projected = point.clone().project(camera);
  projected.x += 2 * dx / width; projected.y -= 2 * dy / height;
  return projected.unproject(camera).sub(point);
}

/** Frozen nearest physical rectangle edge; ties follow top/right/bottom/left. */
export function stickerGrabPeelRegion(art: StickerArtwork, placement: DeviceStickerPlacement, anchor: StickerCarryAnchor) {
  const [left, top, right, bottom] = art.visibleBounds;
  const u = Math.max(0, Math.min(1, (anchor.uv[0] * art.width - left) / (right - left))), v = Math.max(0, Math.min(1, ((1 - anchor.uv[1]) * art.height - top) / (bottom - top)));
  const width = placement.width * DEVICE_LAYOUT.body.width, height = width * (bottom - top) / (right - left);
  const distances = [v * height, (1 - u) * width, (1 - v) * height, u * width];
  let edge = 0; for (let i = 1; i < distances.length; i++) if ((distances[i] ?? Infinity) < (distances[edge] ?? Infinity)) edge = i;
  const coordinate = (x: number, y: number) => edge === 0 ? y : edge === 1 ? 1 - x : edge === 2 ? 1 - y : x;
  return { edge, coordinate, start: coordinate(u, v) };
}

/** Local peel displacement starts at the captured material point. Original
 * wrapped positions outside the advancing half-plane remain untouched.
 */
export function createStickerGrabPeelGeometry(source: BufferGeometry, art: StickerArtwork, placement: DeviceStickerPlacement, anchor: StickerCarryAnchor, contentWorld: Matrix4, camera: Camera, frontier: number, pull: { readonly x: number; readonly y: number }, width: number, height: number): BufferGeometry {
  const geometry = source.clone(); geometry.applyMatrix4(contentWorld);
  const q = Math.max(0, Math.min(1, frontier)); if (q === 0 || pull.x === 0 && pull.y === 0) return geometry;
  const region = stickerGrabPeelRegion(art, placement, anchor), advance = q * (1 - region.start), crease = region.start + advance;
  if (advance <= 1e-12) return geometry;
  const point = new Vector3(...anchor.point).applyMatrix4(contentWorld), delta = stickerCarryPointerOffset(point, camera, width, height, pull.x, pull.y), normal = new Vector3(0, 0, 1).applyQuaternion(camera.getWorldQuaternion(new Quaternion()));
  const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv'), [left, top, right, bottom] = art.visibleBounds;
  const vertex = new Vector3();
  for (let i = 0; i < positions.count; i++) {
    const u = (uv.getX(i) * art.width - left) / (right - left), v = ((1 - uv.getY(i)) * art.height - top) / (bottom - top), a = region.coordinate(u, v);
    if (a >= crease) continue;
    const t = Math.max(0, Math.min(1, (crease - a) / advance)), weight = t * t * (3 - 2 * t);
    vertex.fromBufferAttribute(positions, i).addScaledVector(delta, weight).addScaledVector(normal, Math.sin(Math.PI * weight) * delta.length() * .15);
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
