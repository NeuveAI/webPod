import { type Camera, type Matrix4 } from 'three';
import type { DeviceStickerPlacement, StickerArtwork } from './sticker-contract';
import type { StickerWrapSurface } from './sticker-wrap';
import { DEVICE_LAYOUT } from './layout';
import { DEVICE_DOCK_CONNECTOR, DEVICE_TOP_CONTROLS } from './top-controls';
import { sampleStickerSurfaceGrid, stickerVisibleAspect } from './sticker-surface';

/** Hardware footprints in the same unfolded steel chart as the sticker. */
function exclusions(wrap: StickerWrapSurface) {
  const { hold, jack } = DEVICE_TOP_CONTROLS, dock = DEVICE_DOCK_CONNECTOR;
  return [
    { x: hold.x, z: hold.z, width: hold.width, depth: hold.depth, side: 1 },
    { x: jack.x, z: jack.z, width: jack.outerRadius * 2, depth: jack.outerRadius * 2, side: 1 },
    { x: dock.x, z: dock.z, width: dock.width, depth: dock.depth, side: -1 },
  ].flatMap(p => {
    const lo = p.z - p.depth / 2, hi = Math.min(p.z + p.depth / 2, wrap.seamZ);
    if (lo >= hi) return [];
    const a = wrap.materialAt(p.x, p.side * DEVICE_LAYOUT.body.height / 2, lo), b = wrap.materialAt(p.x, p.side * DEVICE_LAYOUT.body.height / 2, hi);
    return [{ x: p.x, y: (a.y + b.y) / 2, width: p.width + .5, height: Math.abs(a.y - b.y) + .5 }];
  });
}

export function stickerDropHardwareClear(wrap: StickerWrapSurface, center: { x: number; y: number }, width: number, height: number, angle: number): boolean {
  const c = Math.cos(angle), s = Math.sin(angle);
  return exclusions(wrap).every(p => {
    const dx = p.x - center.x, dy = p.y - center.y;
    // Separating axes for the rotated print and hardware rectangle.
    return Math.abs(dx) > Math.abs(c) * width / 2 + Math.abs(s) * height / 2 + p.width / 2
      || Math.abs(dy) > Math.abs(s) * width / 2 + Math.abs(c) * height / 2 + p.height / 2
      || Math.abs(dx * c + dy * s) > width / 2 + Math.abs(c) * p.width / 2 + Math.abs(s) * p.height / 2
      || Math.abs(-dx * s + dy * c) > height / 2 + Math.abs(s) * p.width / 2 + Math.abs(c) * p.height / 2;
  });
}

/** Minimize released-grab screen error after legal edge wrapping, not distance
 * in flat device XY. The camera matrix includes current pitch, yaw and roll.
 * Preserve size/rotation; the chart shrinks only footprints too large to fit.
 */
export function fitStickerDrop(art: StickerArtwork, requested: DeviceStickerPlacement, grabbedUv: readonly [number, number], screen: { x: number; y: number }, canvas: { left: number; top: number; width: number; height: number }, world: Matrix4, camera: Camera, wrap: StickerWrapSurface): DeviceStickerPlacement {
  const width = requested.width * DEVICE_LAYOUT.body.width, height = width * stickerVisibleAspect(art), angle = requested.rotationDeg * Math.PI / 180;
  const [left, top, right, bottom] = art.visibleBounds;
  const u = (grabbedUv[0] * art.width - left) / (right - left), v = ((1 - grabbedUv[1]) * art.height - top) / (bottom - top);
  const footprint = { width, height, angle };
  const evaluate = (x: number, y: number) => {
    const fit = wrap.fit(x, y, footprint);
    const placement = { ...requested, x: .5 - fit.x / DEVICE_LAYOUT.body.width, y: .5 - fit.y / DEVICE_LAYOUT.body.height, width: requested.width * fit.scale };
    if (!stickerDropHardwareClear(wrap, fit.center, width * fit.scale, height * fit.scale, angle)) return { x, y, placement, score: Infinity };
    const cage = wrap.cornerCage(fit.x, fit.y, footprint);
    const point = sampleStickerSurfaceGrid(cage.point, width, height, angle, u, v).applyMatrix4(world).project(camera);
    const dx = canvas.left + (point.x + 1) * canvas.width / 2 - screen.x, dy = canvas.top + (1 - point.y) * canvas.height / 2 - screen.y;
    return { x: fit.x, y: fit.y, placement, score: dx * dx + dy * dy };
  };
  let best = evaluate((.5 - requested.x) * DEVICE_LAYOUT.body.width, (.5 - requested.y) * DEVICE_LAYOUT.body.height);
  // Multiple seeds avoid getting trapped on the wrong side of a hardware opening.
  for (const x of [-.4, 0, .4]) for (const y of [-.45, 0, .45]) {
    const candidate = evaluate(x * DEVICE_LAYOUT.body.width, y * DEVICE_LAYOUT.body.height);
    if (candidate.score < best.score) best = candidate;
  }
  for (let step = DEVICE_LAYOUT.body.width / 8; step > .002; step /= 2) {
    for (let iteration = 0; iteration < 12; iteration++) {
      const previous = best;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const candidate = evaluate(previous.x + (dx ?? 0) * step, previous.y + (dy ?? 0) * step);
        if (candidate.score < best.score) best = candidate;
      }
      if (best === previous || best.score < 1e-6) break;
    }
  }
  if (!Number.isFinite(best.score)) throw new Error('No legal sticker seat');
  return best.placement;
}
