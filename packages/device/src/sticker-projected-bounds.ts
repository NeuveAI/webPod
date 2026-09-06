import { Vector3, type Camera, type Mesh } from 'three';

/** Project the real conformed artwork geometry, including current rotation and scale. */
export function stickerProjectedBounds(print: Mesh, camera: Camera, canvas: { readonly left: number; readonly top: number; readonly width: number; readonly height: number }) {
  const positions = print.geometry.getAttribute('position');
  if (positions === undefined || positions.count === 0 || canvas.width <= 0 || canvas.height <= 0) return null;
  print.updateWorldMatrix(true, false);
  camera.updateMatrixWorld();
  const point = new Vector3();
  let left = Infinity; let right = -Infinity; let top = Infinity; let bottom = -Infinity;
  for (let index = 0; index < positions.count; index++) {
    point.fromBufferAttribute(positions, index).applyMatrix4(print.matrixWorld).project(camera);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.z < -1 || point.z > 1) return null;
    const x = canvas.left + (point.x + 1) * canvas.width / 2;
    const y = canvas.top + (1 - point.y) * canvas.height / 2;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { left, top, right, bottom };
}
