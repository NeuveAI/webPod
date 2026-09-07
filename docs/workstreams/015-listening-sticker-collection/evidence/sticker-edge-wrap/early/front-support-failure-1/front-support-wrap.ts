import type { Vector3, BufferGeometry } from '/Users/vinicius/code/webPod/packages/device/node_modules/three';
import { DEVICE_LAYOUT } from '/Users/vinicius/code/webPod/packages/device/src/layout';
import type { DeviceFormParams } from '/Users/vinicius/code/webPod/packages/device/src/form';
import { rearShellSections, productShellDepths } from '/Users/vinicius/code/webPod/packages/device/src/product-shell';
import { createStickerStripProfile } from '/Users/vinicius/code/webPod/packages/device/src/sticker-strip';
import { createStickerCornerCage } from '/tmp/front-support-cage';

export interface StickerWrapFace { readonly geometry: BufferGeometry; readonly offset?: readonly [number, number, number] }
export interface StickerWrapPoint { readonly point: Vector3; readonly normal: Vector3 }
type Vertex = readonly [number, number, number];
type Triangle = readonly [Vertex, Vertex, Vertex];
const BUCKET = 12;

/** Exact vertical intersections of borrowed front triangles, accelerated by bounded XY buckets. */
function frontEnvelope(faces: readonly StickerWrapFace[]) {
  const buckets = new Map<string, Triangle[]>();
  const all: Triangle[] = [];
  const horizontal = new Map<number, Triangle[]>();
  for (const face of faces) {
    const p = face.geometry.getAttribute('position'); const indices = face.geometry.index;
    const count = indices?.count ?? p.count; const offset = face.offset ?? [0, 0, 0];
    for (let i = 0; i < count; i += 3) {
      const vertex = (j: number): Vertex => { const k = indices ? indices.getX(i + j) : i + j; return [p.getX(k) + offset[0], p.getY(k) + offset[1], p.getZ(k) + offset[2]]; };
      const a = vertex(0), b = vertex(1), c = vertex(2);
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const triangle: Triangle = [a, b, c]; all.push(triangle);
      for (let bin = Math.floor(Math.min(a[1], b[1], c[1]) / BUCKET); bin <= Math.floor(Math.max(a[1], b[1], c[1]) / BUCKET); bin++) { const list = horizontal.get(bin); if (list) list.push(triangle); else horizontal.set(bin, [triangle]); }
      if (Math.abs(area) < 1e-10) continue;
      const x0 = Math.floor(Math.min(a[0], b[0], c[0]) / BUCKET), x1 = Math.floor(Math.max(a[0], b[0], c[0]) / BUCKET);
      const y0 = Math.floor(Math.min(a[1], b[1], c[1]) / BUCKET), y1 = Math.floor(Math.max(a[1], b[1], c[1]) / BUCKET);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const key = `${x},${y}`; const list = buckets.get(key); if (list) list.push(triangle); else buckets.set(key, [triangle]); }
    }
  }
  const height = (x: number, y: number): number | null => {
    let top = -Infinity;
    for (const [a, b, c] of buckets.get(`${Math.floor(x / BUCKET)},${Math.floor(y / BUCKET)}`) ?? []) {
      const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / denominator;
      const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / denominator;
      if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7) top = Math.max(top, u * a[2] + v * b[2] + (1 - u - v) * c[2]);
    }
    return Number.isFinite(top) ? top : null;
  };
  return { height, meridian(angle: number, minimumZ: number, offset = 0): readonly { r: number; z: number; bridge: boolean }[] {
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const segments: { a: { r: number; z: number }; b: { r: number; z: number } }[] = [];
    const radii = new Set<number>();
    for (const triangle of (angle === 0 ? horizontal.get(Math.floor(offset / BUCKET)) ?? [] : all)) {
      const intersections: { r: number; z: number }[] = [];
      for (let i = 0; i < 3; i++) {
        const a = triangle[i], b = triangle[(i + 1) % 3]; if (!a || !b) continue;
        const da = a[1] * cosine - a[0] * sine - offset, db = b[1] * cosine - b[0] * sine - offset;
        if (Math.abs(da) < 1e-9) intersections.push({ r: a[0] * cosine + a[1] * sine, z: a[2] });
        if (da * db < 0) { const t = da / (da - db); intersections.push({ r: (a[0] + (b[0] - a[0]) * t) * cosine + (a[1] + (b[1] - a[1]) * t) * sine, z: a[2] + (b[2] - a[2]) * t }); }
      }
      intersections.sort((a, b) => a.r - b.r);
      const a = intersections[0], b = intersections.at(-1);
      if (!a || !b || b.r < 0 || b.r - a.r < 1e-8) continue;
      const aa = a.r < 0 ? { r: 0, z: a.z + (b.z - a.z) * -a.r / (b.r - a.r) } : a;
      segments.push({ a: aa, b }); radii.add(aa.r); radii.add(b.r);
    }
    const sorted = [...radii].sort((a, b) => b - a); const result: { r: number; z: number; bridge: boolean }[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const outer = sorted[i - 1], inner = sorted[i]; if (outer === undefined || inner === undefined || outer - inner < 1e-8) continue;
      const middle = (outer + inner) / 2;
      let selected: typeof segments[number] | undefined; let highest = -Infinity;
      const value = (s: typeof segments[number], r: number) => s.a.z + (s.b.z - s.a.z) * (r - s.a.r) / (s.b.r - s.a.r);
      for (const segment of segments) if (middle >= segment.a.r - 1e-8 && middle <= segment.b.r + 1e-8) { const z = value(segment, middle); if (z > highest && z >= minimumZ - 1e-5) { highest = z; selected = segment; } }
      if (selected) { result.push({ r: outer, z: value(selected, outer), bridge: true }, { r: inner, z: value(selected, inner), bridge: false }); }
    }
    return result;
  } };
}
/** Actual borrowed front envelope and rear/side reference section for the unified
 * perimeter mapper. Failed radial atlases remain only in diagnostic evidence. */
export function createStickerWrapSurface(form: DeviceFormParams, faces: readonly StickerWrapFace[]) {
  const { depth } = DEVICE_LAYOUT.body; const { seamZ } = productShellDepths(depth, form.frontThickness);
  const rear = rearShellSections(depth, seamZ, form.rearCrownInset); const front = frontEnvelope(faces);
  const rightProfiles = new Map<number, ReturnType<typeof createStickerStripProfile>>();
  const rightProfile = (y: number) => {
    if (Math.abs(y) > 90) throw new Error('Right strip exceeds verified front partition');
    const cached = rightProfiles.get(y); if (cached) return cached;
    const points = rear.map(section => ({ x: DEVICE_LAYOUT.body.width / 2 - section.inset, z: section.z }));
    for (const point of front.meridian(0, seamZ, y)) {
      const previous = points.at(-1); if (!previous) throw new Error("Missing rear strip");
      if (point.bridge && Math.hypot(point.r - previous.x, point.z - previous.z) > 12) throw new Error('Unsupported straight-strip front gap');
      if (Math.hypot(point.r - previous.x, point.z - previous.z) > 1e-8) points.push({ x: point.r, z: point.z });
    }
    const profile = createStickerStripProfile(points, rear.length);
    if (rightProfiles.size >= 256) { const oldest = rightProfiles.keys().next().value; if (oldest !== undefined) rightProfiles.delete(oldest); }
    rightProfiles.set(y, profile); return profile;
  };
  return {
    cornerCage(centerX: number, centerY: number, halfDiagonal: number) {
      return createStickerCornerCage(centerX, centerY, form, rightProfile(0), front.height, halfDiagonal);
    },
  };
}

export type StickerWrapSurface = ReturnType<typeof createStickerWrapSurface>;

const wrapSurfaces = new WeakMap<BufferGeometry, { readonly surface: StickerWrapSurface }>();
/** Share one actual-shell sampler between equipped prints and the packet's borrowed rear geometry. */
export function bindStickerWrapSurface(rear: BufferGeometry, surface: StickerWrapSurface): () => void {
  const binding = { surface };
  wrapSurfaces.set(rear, binding);
  return () => { if (wrapSurfaces.get(rear) === binding) wrapSurfaces.delete(rear); };
}
export function stickerWrapSurface(rear: BufferGeometry): StickerWrapSurface | undefined { return wrapSurfaces.get(rear)?.surface; }
