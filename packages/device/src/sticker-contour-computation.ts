import { stickerAlphaContoursSteps } from './sticker-contour';
import { STICKER_SURFACE } from './sticker-surface';
import type { StickerDamageField } from './sticker-alpha';
import type { PreparedStickerContour } from './sticker-contour-preparation-data';
type Point = { readonly x: number; readonly y: number };
/** Exact former query interpolation, prepared against the same immutable print
 * geometry and damage revision. No camera/DOM/renderer or collision state enters. */
export function* prepareStickerContourSteps(field: StickerDamageField, wear: number, positions: Float32Array, uv: Float32Array): Generator<void, PreparedStickerContour, void> {
  const n = STICKER_SURFACE.segments;
  if (positions.length !== (n + 1) ** 2 * 3 || uv.length !== (n + 1) ** 2 * 2) return { paths: [], anchors: new Float64Array() };
  const minU = uv[0] ?? NaN, maxU = uv[n * 2] ?? NaN, maxV = uv[1] ?? NaN, minV = uv[n * (n + 1) * 2 + 1] ?? NaN;
  const local = (p: Point, target: number[]) => {
    const gx = Math.max(0, Math.min(n, (p.x - minU) / (maxU - minU) * n));
    const gy = Math.max(0, Math.min(n, (maxV - (1 - p.y)) / (maxV - minV) * n));
    const col = Math.min(n - 1, Math.floor(gx)), row = Math.min(n - 1, Math.floor(gy)), x = gx - col, y = gy - row;
    const a = row * (n + 1) + col, b = a + 1, c = a + n + 1, d = c + 1;
    const weights = x + y <= 1 ? [[a, 1 - x - y], [b, x], [c, y]] : [[b, 1 - y], [c, 1 - x], [d, x + y - 1]];
    let px = 0, py = 0, pz = 0;
    for (const [index, weight] of weights) { if (index === undefined || weight === undefined) throw new Error('Invalid contour interpolation'); px += (positions[index * 3] ?? NaN) * weight; py += (positions[index * 3 + 1] ?? NaN) * weight; pz += (positions[index * 3 + 2] ?? NaN) * weight; }
    target.push(px, py, pz);
  };
  const contours = yield* stickerAlphaContoursSteps(field, wear), paths: { points: Float64Array; visiblePoints: Float64Array }[] = [], outer: Point[] = [];
  let work = 0;
  for (const path of contours) {
    const points: number[] = [], visiblePoints: number[] = []; let area = 0;
    for (let i = 0; i < path.length; i++) {
      const p = path[i], q = path[(i + 1) % path.length]; if (!p || !q) throw new Error('Invalid contour path');
      local({ x: p.x + (q.x - p.x) * 0, y: p.y + (q.y - p.y) * 0 }, points);
      const divisions = Math.max(2, Math.ceil(Math.max(Math.abs(q.x - p.x) / (maxU - minU), Math.abs(q.y - p.y) / (maxV - minV)) * n * 2));
      for (let step = 0; step < divisions; step++) { if (++work % 128 === 0) yield; const t = step / divisions; local({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }, visiblePoints); }
      area += p.x * q.y - q.x * p.y;
    }
    paths.push({ points: Float64Array.from(points), visiblePoints: Float64Array.from(visiblePoints) });
    if (area > 0) for (const p of path) { if (++work % 128 === 0) yield; outer.push(p); }
  }
  const anchors: number[] = [];
  for (const [x, y] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
    let best = outer[0], distance = Infinity;
    for (const p of outer) { if (++work % 128 === 0) yield; const dx = (p.x - minU) / (maxU - minU) - x, dy = (p.y - (1 - maxV)) / (maxV - minV) - y, score = dx * dx + dy * dy; if (score < distance) { distance = score; best = p; } }
    if (best) local(best, anchors);
  }
  return { paths, anchors: Float64Array.from(anchors) };
}
