import { Vector3, type Camera, type Mesh } from 'three';
import { getStickerBoundsIndex } from './sticker-bounds-index';
type Bounds = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
const cache = new WeakMap<Mesh, { readonly key: readonly unknown[]; readonly result: Bounds | null }>();
/** Project exact authored vertices. Prepared AABBs only reject subtrees strictly
 * inside already measured extrema; they never supply an output corner. Clip or
 * denominator uncertainty descends to the original vertex test. One latest pose
 * is cached, and mutable/unprepared external geometry keeps the exact scan. */
export function stickerProjectedBounds(print: Mesh, camera: Camera, canvas: { readonly left: number; readonly top: number; readonly width: number; readonly height: number }): Bounds | null {
  const positions = print.geometry.getAttribute('position');
  if (positions === undefined || positions.count === 0 || canvas.width <= 0 || canvas.height <= 0) return null;
  print.updateWorldMatrix(true, false); camera.updateMatrixWorld();
  const key = [positions, positions.array, positions.count, 'version' in positions ? positions.version : positions.data.version, canvas.left, canvas.top, canvas.width, canvas.height, ...print.matrixWorld.elements, ...camera.matrixWorldInverse.elements, ...camera.projectionMatrix.elements];
  const index = getStickerBoundsIndex(print.geometry);
  const previous = index ? cache.get(print) : undefined;
  if (previous?.key.length === key.length && previous.key.every((value, i) => value === key[i])) return previous.result;
  const point = new Vector3(); let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  const visit = (index: number) => {
    point.fromBufferAttribute(positions, index).applyMatrix4(print.matrixWorld).project(camera);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.z < -1 || point.z > 1) return false;
    const x = canvas.left + (point.x + 1) * canvas.width / 2, y = canvas.top + (1 - point.y) * canvas.height / 2;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); return true;
  };
  const world = print.matrixWorld.elements;
  let valid = true;
  if (index && world[3] === 0 && world[7] === 0 && world[11] === 0 && world[15] === 1) {
    for (const seed of index.seeds) if (!visit(seed)) { valid = false; break; }
    const stack = [0];
    while (valid && stack.length) {
      const node = stack.pop(); if (node === undefined) break;
      const base = node * 6; let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, safe = true;
      for (let corner = 0; corner < 8; corner++) {
        point.set(index.bounds[base + (corner & 1 ? 3 : 0)] ?? NaN, index.bounds[base + (corner & 2 ? 4 : 1)] ?? NaN, index.bounds[base + (corner & 4 ? 5 : 2)] ?? NaN).applyMatrix4(print.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
        const projection = camera.projectionMatrix.elements;
        const w = (projection[3] ?? 0) * point.x + (projection[7] ?? 0) * point.y + (projection[11] ?? 0) * point.z + (projection[15] ?? 0);
        point.applyMatrix4(camera.projectionMatrix);
        if (!(w > 1e-6) || ![point.x, point.y, point.z].every(Number.isFinite) || point.z <= -1 + 1e-6 || point.z >= 1 - 1e-6) { safe = false; break; }
        const x = canvas.left + (point.x + 1) * canvas.width / 2, y = canvas.top + (1 - point.y) * canvas.height / 2;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      // Expand rejection bounds; numerical uncertainty may cost traversal, never
      // substitute an approximate visible extremum or hide a clipped vertex.
      const slack = 1e-6 * (1 + Math.max(Math.abs(minX), Math.abs(maxX), Math.abs(minY), Math.abs(maxY)));
      if (safe && minX - slack > left && maxX + slack < right && minY - slack > top && maxY + slack < bottom) continue;
      const offset = node * 4, child = index.nodes[offset + 2];
      if (child) { stack.push(child, index.nodes[offset + 3] ?? child); }
      else { const first = index.nodes[offset] ?? 0, count = index.nodes[offset + 1] ?? 0; for (let i = first; i < first + count; i++) if (!visit(i)) { valid = false; break; } }
    }
  } else for (let i = 0; i < positions.count; i++) if (!visit(i)) { valid = false; break; }
  const result = valid ? { left, top, right, bottom } : null;
  if (index) cache.set(print, { key, result }); return result;
}
