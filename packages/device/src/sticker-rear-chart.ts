import { Vector3 } from 'three';
import type { DeviceFormParams } from './form';
import { DEVICE_LAYOUT } from './layout';
import { productShellDepths, rearShellSections } from './product-shell';
import { createStickerStripProfile } from './sticker-strip';
import type { StickerBendFootprint } from './sticker-corner-cage';

/** Unfolded steel only. Every material point chooses its own nearest edge,
 * allowing one print to cross two edges without a single outward-direction cage.
 * The front shell is never included in this chart.
 */
export function createStickerRearChart(form: DeviceFormParams) {
  const { width, height, cornerR, depth } = DEVICE_LAYOUT.body;
  const { seamZ } = productShellDepths(depth, form.frontThickness);
  const sections = rearShellSections(depth, seamZ, form.rearCrownInset);
  const profile = createStickerStripProfile(sections.map(s => ({ x: width / 2 - s.inset, z: s.z })), sections.length);
  const cx = width / 2 - cornerR, cy = height / 2 - cornerR;
  const radius = cornerR - form.rearCrownInset;
  // Keep the film's normal offset behind the material seam too.
  const allowedRadius = radius + profile.length - .5;
  const radial = (x: number, y: number) => {
    const bx = Math.max(-cx, Math.min(cx, x)), by = Math.max(-cy, Math.min(cy, y));
    const dx = x - bx, dy = y - by, r = Math.hypot(dx, dy);
    return { bx, by, dx, dy, r };
  };
  const project = (x: number, y: number, limit = allowedRadius) => {
    const q = radial(x, y);
    return q.r <= limit ? { x, y } : { x: q.bx + q.dx / q.r * limit, y: q.by + q.dy / q.r * limit };
  };
  const toMaterial = (x: number, y: number) => {
    const q = radial(x, y);
    if (q.r <= radius) return { x, y };
    const r = radius + profile.rearDistance(Math.min(width / 2, cx + q.r));
    return { x: q.bx + q.dx / q.r * r, y: q.by + q.dy / q.r * r };
  };
  const point = (x: number, y: number) => {
    const q = radial(x, y);
    if (q.r <= radius) return new Vector3(x, y, -depth / 2);
    const section = profile.sample(Math.min(profile.length, q.r - radius));
    const r = section.x - cx;
    return new Vector3(q.bx + q.dx / q.r * r, q.by + q.dy / q.r * r, section.z);
  };
  const corners = (footprint: StickerBendFootprint) => {
    const c = Math.cos(footprint.angle), s = Math.sin(footprint.angle);
    return [-1, 1].flatMap(x => [-1, 1].map(y => ({
      x: (x * footprint.width * c - y * footprint.height * s) / 2,
      y: (x * footprint.width * s + y * footprint.height * c) / 2,
    })));
  };
  function fit(centerX: number, centerY: number, footprint: StickerBendFootprint) {
    let scale = 1;
    const source = corners(footprint);
    const fitsAtOrigin = (factor: number) => source.every(p => radial(p.x * factor, p.y * factor).r <= allowedRadius);
    if (!fitsAtOrigin(1)) {
      let low = 0, high = 1;
      for (let i = 0; i < 32; i++) { const mid = (low + high) / 2; if (fitsAtOrigin(mid)) low = mid; else high = mid; }
      scale = low;
    }
    const offsets = source.map(p => ({ x: p.x * scale, y: p.y * scale }));
    let center = toMaterial(centerX, centerY);
    // Dykstra projection onto the intersection of four translated rounded
    // rectangles gives the nearest center whose entire print fits the steel.
    const corrections = offsets.map(() => ({ x: 0, y: 0 }));
    for (let iteration = 0; iteration < 128; iteration++) {
      const before = center;
      for (let i = 0; i < offsets.length; i++) {
        const offset = offsets[i], correction = corrections[i];
        if (!offset || !correction) continue;
        const x = center.x + correction.x, y = center.y + correction.y;
        const next = project(x + offset.x, y + offset.y);
        center = { x: next.x - offset.x, y: next.y - offset.y };
        corrections[i] = { x: x - center.x, y: y - center.y };
      }
      if (Math.hypot(center.x - before.x, center.y - before.y) < 1e-8) break;
    }
    // At a maximal footprint the intersection can be a singleton; retain a
    // safe converged solution instead of depending on asymptotic projection.
    if (!offsets.every(p => radial(center.x + p.x, center.y + p.y).r <= allowedRadius + 1e-6)) {
      let low = 0, high = 1;
      for (let i = 0; i < 32; i++) {
        const t = (low + high) / 2;
        if (offsets.every(p => radial(center.x * t + p.x, center.y * t + p.y).r <= allowedRadius)) low = t; else high = t;
      }
      center = { x: center.x * low, y: center.y * low };
    }
    const physical = point(center.x, center.y);
    return { center, scale, x: physical.x, y: physical.y };
  }
  return {
    seamZ,
    fit,
    /** Inverse at the actual steel hit, including its axial position. */
    materialAt(x: number, y: number, z: number) {
      const q = radial(x, y);
      if (q.r <= radius || z <= -depth / 2 + 1e-7) return { x, y };
      let low = 0, high = profile.length;
      for (let i = 0; i < 32; i++) { const mid = (low + high) / 2; if (profile.sample(mid).z < z) low = mid; else high = mid; }
      const r = radius + (low + high) / 2;
      return { x: q.bx + q.dx / q.r * r, y: q.by + q.dy / q.r * r };
    },
    cornerCage(centerX: number, centerY: number, footprint: StickerBendFootprint) {
      const fitted = fit(centerX, centerY, footprint);
      const position = (dx: number, dy: number) => point(fitted.center.x + dx * fitted.scale, fitted.center.y + dy * fitted.scale);
      return { point: position, sample(dx: number, dy: number, lift = .18) {
        const e = .005, p = position(dx, dy);
        const tx = position(dx + e, dy).sub(position(dx - e, dy)), ty = position(dx, dy + e).sub(position(dx, dy - e));
        const normal = ty.cross(tx).normalize();
        return { point: p.addScaledVector(normal, lift), normal };
      } };
    },
  };
}
