import { Vector3 } from 'three';
import type { DeviceFormParams } from './form';
import { DEVICE_LAYOUT } from './layout';
import { DEVICE_SURFACE_LAYOUT } from './surface-layout';
import { frontShellOffsetAt } from './front-surface';
import { stickerInsertBridgeHeight } from './sticker-insert-bridge';
import type { createStickerStripProfile } from './sticker-strip';

export type StickerBendFootprint = { readonly width: number; readonly height: number; readonly angle: number };

type Profile = ReturnType<typeof createStickerStripProfile>;

/** One unwrapped perimeter chart for the whole body. The flat chart is inverted
 * per material point, so its rear-plane portion is exactly the original artwork.
 * Actual corner/edge bending replaces depth only; no quadrant pose selector.
 */
export function createStickerCornerCage(
  centerX: number, centerY: number, form: DeviceFormParams, reference: Profile,
  height: (x: number, y: number) => number | null, footprint: StickerBendFootprint,
) {
  const { width, height: bodyHeight, cornerR } = DEVICE_LAYOUT.body;
  if (![centerX, centerY, footprint.width, footprint.height, footprint.angle].every(Number.isFinite) || footprint.width <= 0 || footprint.height <= 0) throw new Error('Invalid bend footprint');
  const cx = width / 2 - cornerR, cy = bodyHeight / 2 - cornerR;
  const rearRadius = cornerR - form.rearCrownInset;
  const length = (r: number) => 4 * (cx + cy) + 2 * Math.PI * r;
  const modulo = (a: number, l: number) => ((a % l) + l) % l;
  const unwrap = (a: number, l: number) => modulo(a + l / 2, l) - l / 2;
  const perimeter = (r: number, arc: number) => {
    let t = modulo(arc, length(r));
    const q = Math.PI * r / 2;
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      const angle = quadrant * Math.PI / 2;
      const ox = quadrant === 0 || quadrant === 3 ? cx : -cx;
      const oy = quadrant < 2 ? cy : -cy;
      if (t <= q) { const phi = angle + t / r; return { x: ox + r * Math.cos(phi), y: oy + r * Math.sin(phi), nx: Math.cos(phi), ny: Math.sin(phi) }; }
      t -= q;
      const extent = quadrant % 2 === 0 ? 2 * cx : 2 * cy;
      const normalAngle = angle + Math.PI / 2;
      if (t <= extent) {
        const nx = Math.cos(normalAngle), ny = Math.sin(normalAngle);
        return { x: ox + r * nx - ny * t, y: oy + r * ny + nx * t, nx, ny };
      }
      t -= extent;
    }
    throw new Error('Invalid perimeter phase');
  };
  const arcOf = (x: number, y: number, r: number) => {
    const q = Math.PI * r / 2;
    if (x >= cx && y >= cy) return Math.atan2(y - cy, x - cx) * r;
    if (y >= cy && x >= -cx && x <= cx) return q + cx - x;
    if (x <= -cx && y >= cy) return q + 2 * cx + (Math.atan2(y - cy, x + cx) - Math.PI / 2) * r;
    if (x <= -cx && y >= -cy && y <= cy) return 2 * q + 2 * cx + cy - y;
    if (x <= -cx && y <= -cy) return 2 * q + 2 * cx + 2 * cy + (Math.atan2(y + cy, x + cx) + Math.PI) * r;
    if (y <= -cy && x >= -cx && x <= cx) return 3 * q + 2 * cx + 2 * cy + x + cx;
    if (x >= cx && y <= -cy) return 3 * q + 4 * cx + 2 * cy + (Math.atan2(y + cy, x - cx) + Math.PI / 2) * r;
    return 4 * q + 4 * cx + 2 * cy + y + cy;
  };
  const closest = (r: number) => {
    const x = Math.abs(centerX) - cx, y = Math.abs(centerY) - cy;
    if (x > 0 && y > 0) { const k = r / Math.hypot(x, y); return { x: Math.sign(centerX) * (cx + x * k), y: Math.sign(centerY) * (cy + y * k) }; }
    if (x >= y) return { x: (Math.sign(centerX) || 1) * (cx + r), y: centerY };
    return { x: centerX, y: (Math.sign(centerY) || 1) * (cy + r) };
  };
  const near = closest(rearRadius), nearArc = arcOf(near.x, near.y, rearRadius);
  const nearNormal = perimeter(rearRadius, nearArc), baseAngle = Math.atan2(nearNormal.ny, nearNormal.nx);
  let lowAngle = 0, highAngle = 0;
  for (const r of [rearRadius, cornerR, cornerR - form.seamWidth - form.frontBevel]) {
    const p = closest(r), a = arcOf(p.x, p.y, r);
    const normal = perimeter(r, a), cosine = Math.cos(footprint.angle), sine = Math.sin(footprint.angle);
    const extent = (footprint.width * Math.abs(-normal.ny * cosine + normal.nx * sine) + footprint.height * Math.abs(normal.ny * sine + normal.nx * cosine)) / 2;
    for (const offset of [-extent, 0, extent]) {
      const n = perimeter(r, a + offset), delta = unwrap(Math.atan2(n.ny, n.nx) - baseAngle, 2 * Math.PI);
      lowAngle = Math.min(lowAngle, delta); highAngle = Math.max(highAngle, delta);
    }
  }
  if (highAngle - lowAngle >= Math.PI - 1e-6) throw new Error('Bend footprint has no common outward direction');
  // A corner's physical radius is too short a transition for the whole print:
  // changing direction across that radius reverses distant front UV motion.
  // Spread direction change over the fixed material reach, without changing
  // the actual surface or adding a placement selector.
  const reach = Math.hypot(footprint.width, footprint.height) / 2;
  const softX = Math.max(0, Math.abs(centerX) - cx + reach);
  const softY = Math.max(0, Math.abs(centerY) - cy + reach);
  const softLength = Math.hypot(softX, softY);
  // The zero region contains the complete flat footprint; either chart gives
  // the same identity there. Components remain zero across the body axes.
  const nx = softLength > 0 ? Math.sign(centerX) * softX / softLength : Math.cos(baseAngle);
  const ny = softLength > 0 ? Math.sign(centerY) * softY / softLength : Math.sin(baseAngle);
  // Exit intersection of a line parallel to N with the convex unbent rear cap.
  const inverseFlat = (x: number, y: number) => {
    let answer: { depth: number; arc: number } | undefined;
    const accept = (depth: number, qx: number, qy: number, qnx: number, qny: number) => {
      if (qnx * nx + qny * ny <= 1e-9) return;
      answer = { depth, arc: arcOf(qx, qy, rearRadius) };
    };
    if (Math.abs(nx) > 1e-9) for (const sign of [-1, 1]) {
      const qx = sign * (cx + rearRadius), d = (x - qx) / nx, qy = y - d * ny;
      if (Math.abs(qy) <= cy + 1e-8) accept(d, qx, qy, sign, 0);
    }
    if (Math.abs(ny) > 1e-9) for (const sign of [-1, 1]) {
      const qy = sign * (cy + rearRadius), d = (y - qy) / ny, qx = x - d * nx;
      if (Math.abs(qx) <= cx + 1e-8) accept(d, qx, qy, 0, sign);
    }
    if (!answer) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const vx = x - sx * cx, vy = y - sy * cy, along = vx * nx + vy * ny;
      const discriminant = rearRadius ** 2 - (vx * ny - vy * nx) ** 2;
      if (discriminant < -1e-8) continue;
      const d = along - Math.sqrt(Math.max(0, discriminant)), qx = x - d * nx, qy = y - d * ny;
      if (sx * qx >= cx - 1e-8 && sy * qy >= cy - 1e-8) accept(d, qx, qy, (qx - sx * cx) / rearRadius, (qy - sy * cy) / rearRadius);
    }
    if (!answer) throw new Error('Material line misses rear perimeter');
    return answer;
  };
  const flatRoot = inverseFlat(centerX, centerY);
  const ax = Math.abs(centerX) - cx, ay = Math.abs(centerY) - cy;
  const radius = ax > 0 && ay > 0 ? Math.hypot(ax, ay) : Math.max(ax, ay);
  const origin = radius > rearRadius ? reference.rearDistance(cx + radius) : flatRoot.depth;
  const rootArc = radius > rearRadius ? arcOf(centerX, centerY, radius) : flatRoot.arc;
  const rootRadius = Math.max(rearRadius, radius);
  const rootPoint = perimeter(rootRadius, rootArc);
  const phaseAt = (r: number) => arcOf(rootPoint.x - rootPoint.nx * rootRadius + rootPoint.nx * r, rootPoint.y - rootPoint.ny * rootRadius + rootPoint.ny * r, r);
  const rearEnd = reference.rearDistance(width / 2), faceX = width / 2 - form.seamWidth - form.frontBevel;
  let frontEnd = rearEnd;
  for (; frontEnd < rearEnd + 24; frontEnd += .05) { const p = reference.sample(frontEnd); if (p.x <= faceX && p.z > DEVICE_LAYOUT.body.depth / 2 - form.frontThickness / 2) break; }
  if (frontEnd >= rearEnd + 24) throw new Error('Missing front-rim phase');
  const frontRadius = reference.sample(frontEnd).x - cx;
  const mapped = (depth: number, arc: number) => {
    if (depth > frontEnd) {
      const p = perimeter(frontRadius, phaseAt(frontRadius) + arc), travel = depth - frontEnd, band = 12, u = Math.min(1, travel / band);
      const common = travel <= band ? band * (u ** 3 - .5 * u ** 4) : travel - band / 2;
      const x = p.x - p.nx * (travel - common) - nx * common, y = p.y - p.ny * (travel - common) - ny * common;
      const z = stickerInsertBridgeHeight(x, y, DEVICE_SURFACE_LAYOUT.front.glass, height);
      if (z === null) throw new Error('Bend has no actual front support');
      return new Vector3(x, y, z);
    }
    const section = reference.sample(Math.max(0, depth)), p = perimeter(section.x - cx, phaseAt(section.x - cx) + arc);
    if (depth < 0) { p.x += depth * nx; p.y += depth * ny; }
    const fraction = Math.max(0, Math.min(1, (depth - rearEnd) / (frontEnd - rearEnd))), blend = fraction * fraction * (3 - 2 * fraction);
    const crown = frontShellOffsetAt(p.x, p.y, form) - frontShellOffsetAt(section.x, 0, form);
    return new Vector3(p.x, p.y, section.z + crown * blend);
  };
  // The exact planar inverse is nonlinear across a rounded corner. Carrying
  // that residual onto the front stretches a rectangular ticket into a ribbon.
  // Preserve it on the flat cap, then remove only its nonlinear part through
  // the bend. The root value and first derivative remain unchanged.
  const chartStep = .005;
  const chartDelta = (dx: number, dy: number) => {
    const q = inverseFlat(centerX + dx, centerY + dy);
    return { depth: q.depth - flatRoot.depth, arc: unwrap(q.arc - flatRoot.arc, length(rearRadius)) };
  };
  const qxp = chartDelta(chartStep, 0), qxm = chartDelta(-chartStep, 0);
  const qyp = chartDelta(0, chartStep), qym = chartDelta(0, -chartStep);
  const depthX = (qxp.depth - qxm.depth) / (2 * chartStep), depthY = (qyp.depth - qym.depth) / (2 * chartStep);
  const arcX = (qxp.arc - qxm.arc) / (2 * chartStep), arcY = (qyp.arc - qym.arc) / (2 * chartStep);
  const rawPosition = (dx: number, dy: number) => {
    const q = chartDelta(dx, dy), linearDepth = dx * depthX + dy * depthY, linearArc = dx * arcX + dy * arcY;
    const nonlinearDepth = q.depth - linearDepth;
    const flatDistance = origin + q.depth, frontDistance = origin + linearDepth;
    const outsideBend = flatDistance <= 0 || frontDistance >= frontEnd;
    let low = Math.max(0, Math.min(flatDistance, frontDistance));
    let high = Math.min(frontEnd, Math.max(flatDistance, frontDistance));
    let distance = flatDistance <= 0 ? flatDistance : frontDistance >= frontEnd ? frontDistance : (low + high) / 2;
    // Solve the phase at the resulting depth, rather than the uncorrected
    // depth. An explicit fade can reverse rows when the residual is large.
    for (let iteration = 0; !outsideBend && iteration < 12; iteration++) {
      const phase = Math.max(0, Math.min(1, distance / frontEnd));
      const weight = 1 - phase * phase * (3 - 2 * phase);
      const error = distance - origin - linearDepth - weight * nonlinearDepth;
      if (Math.abs(error) < 1e-9) break;
      if (error > 0) high = distance; else low = distance;
      const derivative = 1 + 6 * phase * (1 - phase) / frontEnd * nonlinearDepth;
      const next = distance - error / derivative;
      distance = next > low && next < high ? next : (low + high) / 2;
    }
    const phase = Math.max(0, Math.min(1, distance / frontEnd));
    const residual = 1 - phase * phase * (3 - 2 * phase);
    return mapped(distance, linearArc + residual * (q.arc - linearArc));
  };
  const e = .005, rootX = rawPosition(e, 0).sub(rawPosition(-e, 0)).multiplyScalar(1 / (2 * e));
  const rootY = rawPosition(0, e).sub(rawPosition(0, -e)).multiplyScalar(1 / (2 * e));
  const tangentD = rootX.clone().multiplyScalar(nx).addScaledVector(rootY, ny).normalize();
  const tangentT = rootX.clone().multiplyScalar(-ny).addScaledVector(rootY, nx);
  tangentT.addScaledVector(tangentD, -tangentT.dot(tangentD)).normalize();
  const xx = rootX.dot(rootX), xy = rootX.dot(rootY), yy = rootY.dot(rootY), determinant = xx * yy - xy * xy;
  if (determinant < 1e-12) throw new Error('Degenerate bend root frame');
  const position = (dx: number, dy: number) => {
    const direction = tangentD.clone().multiplyScalar(dx * nx + dy * ny).addScaledVector(tangentT, -dx * ny + dy * nx);
    const a = direction.dot(rootX), b = direction.dot(rootY);
    return rawPosition((a * yy - b * xy) / determinant, (b * xx - a * xy) / determinant);
  };
  return { point: position, sample(dx: number, dy: number, lift = .18) {
    if (![dx, dy, lift].every(Number.isFinite)) throw new Error('Nonfinite material coordinate');
    const point = position(dx, dy), tx = position(dx + e, dy).sub(position(dx - e, dy)), ty = position(dx, dy + e).sub(position(dx, dy - e));
    const normal = ty.cross(tx);
    if (normal.lengthSq() < 1e-14) throw new Error('Collapsed perimeter bend');
    normal.normalize(); return { point: point.addScaledVector(normal, lift), normal };
  } };
}
