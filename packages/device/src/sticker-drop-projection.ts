import { Mesh, Raycaster, Triangle, Vector2, Vector3, type Camera } from 'three';
import { DEVICE_LAYOUT } from './layout';

/** Nearest projected point on the actual steel triangles. Direct hits keep their
 * real depth; misses snap to the screen-nearest allowed surface, never a Z plane.
 */
export function projectStickerDrop(rear: Mesh, camera: Camera, canvas: { left: number; top: number; width: number; height: number }, x: number, y: number, seamZ: number) {
  if (![x, y, canvas.width, canvas.height].every(Number.isFinite) || canvas.width <= 0 || canvas.height <= 0) return null;
  rear.updateWorldMatrix(true, false); camera.updateMatrixWorld();
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2((x - canvas.left) / canvas.width * 2 - 1, 1 - (y - canvas.top) / canvas.height * 2), camera);
  const hits = ray.intersectObject(rear, false);
  let nearest: Vector3 | null = null, distance = Infinity;
  for (const hit of hits) {
    const local = rear.worldToLocal(hit.point.clone());
    if (local.z < seamZ - .01) { nearest = local; break; }
  }
  if (!nearest) {
    const positions = rear.geometry.getAttribute('position'), indices = rear.geometry.index;
    const vertices = Array.from({ length: positions.count }, (_, i) => {
      const local = new Vector3().fromBufferAttribute(positions, i);
      const projected = local.clone().applyMatrix4(rear.matrixWorld).project(camera);
      return { local, projected, screen: new Vector3(canvas.left + (projected.x + 1) * canvas.width / 2, canvas.top + (1 - projected.y) * canvas.height / 2, 0) };
    });
    const point = new Vector3(x, y, 0), closest = new Vector3(), bary = new Vector3();
    const count = indices?.count ?? positions.count;
    for (let i = 0; i < count; i += 3) {
      const a = vertices[indices?.getX(i) ?? i], b = vertices[indices?.getX(i + 1) ?? i + 1], c = vertices[indices?.getX(i + 2) ?? i + 2];
      if (!a || !b || !c || Math.min(a.local.z, b.local.z, c.local.z) >= seamZ - .01) continue;
      const signedArea = (b.screen.x - a.screen.x) * (c.screen.y - a.screen.y) - (b.screen.y - a.screen.y) * (c.screen.x - a.screen.x);
      if (signedArea >= -1e-8) continue; // Opposite steel is occluded by the body.
      const triangle = new Triangle(a.screen, b.screen, c.screen);
      if (triangle.getArea() < 1e-8) continue;
      triangle.closestPointToPoint(point, closest);
      const d = closest.distanceToSquared(point);
      if (d >= distance) continue;
      triangle.getBarycoord(closest, bary);
      // Perspective-correct interpolation of the winning triangle.
      const wa = new Vector3().copy(a.local).applyMatrix4(rear.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z;
      const wb = new Vector3().copy(b.local).applyMatrix4(rear.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z;
      const wc = new Vector3().copy(c.local).applyMatrix4(rear.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z;
      const sum = bary.x / wa + bary.y / wb + bary.z / wc;
      if (!Number.isFinite(sum) || Math.abs(sum) < 1e-12) continue;
      nearest = a.local.clone().multiplyScalar(bary.x / wa / sum).addScaledVector(b.local, bary.y / wb / sum).addScaledVector(c.local, bary.z / wc / sum);
      distance = d;
    }
  }
  if (nearest === null) return null;
  // Float32 shell vertices can sit microns outside the analytic silhouette.
  const { width, height, cornerR } = DEVICE_LAYOUT.body;
  const bx = Math.max(-width / 2 + cornerR, Math.min(width / 2 - cornerR, nearest.x));
  const by = Math.max(-height / 2 + cornerR, Math.min(height / 2 - cornerR, nearest.y));
  const dx = nearest.x - bx, dy = nearest.y - by, radius = Math.hypot(dx, dy);
  if (radius > cornerR - 1e-4) { nearest.x = bx + dx / radius * (cornerR - 1e-4); nearest.y = by + dy / radius * (cornerR - 1e-4); }
  return { x: .5 - nearest.x / width, y: .5 - nearest.y / height };
}
