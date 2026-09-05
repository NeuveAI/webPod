import { BufferGeometry, Float32BufferAttribute, type Vector2 } from "three";
import { DEVICE_LAYOUT } from "./layout";
import { roundedRectShape } from "./shapes";
import { DEVICE_DOCK_CONNECTOR, DEVICE_TOP_CONTROLS } from "./top-controls";

export type HardwareAperture = {
  readonly side: 1 | -1;
  /** Convex CCW polygon in the body-local X/Z plane. */
  readonly outline: readonly { readonly x: number; readonly y: number }[];
};

function rectangle(x: number, z: number, width: number, depth: number, radius: number): readonly Vector2[] {
  const points = roundedRectShape(width, depth, radius, 8).getPoints();
  points.pop();
  return points.map((p) => p.add({ x, y: z }));
}
/** Fixed X/Z openings are independent of crown depth; they stay inside the
 * default steel seam. The visible rim/walls conform to the injected shell form. */
export function deviceHardwareApertures(): readonly HardwareAperture[] {
  const { hold, jack } = DEVICE_TOP_CONTROLS;
  const dock = DEVICE_DOCK_CONNECTOR;
  return [
    { side: 1, outline: rectangle(hold.x, hold.z, hold.width - 1, hold.depth - 1, hold.radius - 0.5) },
    { side: 1, outline: Array.from({ length: 64 }, (_, i) => ({
      x: jack.x + jack.boreRadius * Math.cos(i * Math.PI / 32),
      y: jack.z + jack.boreRadius * Math.sin(i * Math.PI / 32),
    })) },
    { side: -1, outline: rectangle(dock.x, dock.z, dock.innerWidth + 1, dock.innerDepth + 1, dock.innerRadius + 0.5) },
  ];
}

type Vertex = { p: number[]; n: number[]; uv: number[] };
const EPS = 1e-7;
function mix(a: Vertex, b: Vertex, t: number): Vertex {
  const interpolate = (u: number[], v: number[]) => u.map((n, i) => n + ((v[i] ?? n) - n) * t);
  return { p: interpolate(a.p, b.p), n: interpolate(a.n, b.n), uv: interpolate(a.uv, b.uv) };
}
/** Split one polygon against a vertical plane, preserving its smooth normals. */
function split(polygon: Vertex[], a: { x: number; y: number }, b: { x: number; y: number }) {
  const inside: Vertex[] = [];
  const outside: Vertex[] = [];
  const distance = (v: Vertex) => (b.x - a.x) * ((v.p[2] ?? 0) - a.y) - (b.y - a.y) * ((v.p[0] ?? 0) - a.x);
  let previous = polygon.at(-1);
  if (previous === undefined) return { inside, outside };
  let previousD = distance(previous);
  for (const current of polygon) {
    const currentD = distance(current);
    if ((previousD >= 0) !== (currentD >= 0)) {
      const intersection = mix(previous, current, previousD / (previousD - currentD));
      inside.push(intersection); outside.push(intersection);
    }
    if (currentD >= 0) inside.push(current);
    else outside.push(current);
    previous = current; previousD = currentD;
  }
  return { inside, outside };
}

/** Cut real openings into the top/bottom steel triangles. No depth-test masks,
 * overlapping black stickers, runtime CSG dependency or new render passes. */
export function cutHardwareApertures(source: BufferGeometry): BufferGeometry {
  const straightEdgeStart = DEVICE_LAYOUT.body.height / 2 - DEVICE_LAYOUT.body.cornerR;
  const raw = source.index === null ? source.clone() : source.toNonIndexed();
  const position = raw.getAttribute("position");
  const normal = raw.getAttribute("normal");
  const uv = raw.getAttribute("uv");
  let triangles: Vertex[][] = [];
  for (let i = 0; i < position.count; i += 3) {
    triangles.push(Array.from({ length: 3 }, (_, k) => ({
      p: [position.getX(i + k), position.getY(i + k), position.getZ(i + k)],
      n: [normal.getX(i + k), normal.getY(i + k), normal.getZ(i + k)],
      uv: [uv.getX(i + k), uv.getY(i + k)],
    })));
  }
  for (const aperture of deviceHardwareApertures()) {
    const next: Vertex[][] = [];
    const xs = aperture.outline.map((p) => p.x);
    const zs = aperture.outline.map((p) => p.y);
    for (const polygon of triangles) {
      // Openings all lie on straight top/bottom bands, well away from corners.
      if (polygon.some((v) => aperture.side * (v.p[1] ?? 0) < straightEdgeStart) ||
        Math.max(...polygon.map((v) => v.p[0] ?? 0)) < Math.min(...xs) ||
        Math.min(...polygon.map((v) => v.p[0] ?? 0)) > Math.max(...xs) ||
        Math.max(...polygon.map((v) => v.p[2] ?? 0)) < Math.min(...zs) ||
        Math.min(...polygon.map((v) => v.p[2] ?? 0)) > Math.max(...zs)) {
        next.push(polygon); continue;
      }
      let remainder = polygon;
      for (let i = 0; i < aperture.outline.length && remainder.length >= 3; i++) {
        const a = aperture.outline[i];
        const b = aperture.outline[(i + 1) % aperture.outline.length];
        if (a === undefined || b === undefined) continue;
        const pieces = split(remainder, a, b);
        if (pieces.outside.length >= 3) next.push(pieces.outside);
        remainder = pieces.inside;
      }
      // The final inside polygon is the missing piece of steel.
    }
    triangles = next;
  }
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [];
  for (const polygon of triangles) {
    for (let i = 1; i < polygon.length - 1; i++) {
      const a = polygon[0], b = polygon[i], c = polygon[i + 1];
      if (a === undefined || b === undefined || c === undefined) continue;
      const ab = b.p.map((v, k) => v - (a.p[k] ?? 0));
      const ac = c.p.map((v, k) => v - (a.p[k] ?? 0));
      if (Math.hypot((ab[1] ?? 0) * (ac[2] ?? 0) - (ab[2] ?? 0) * (ac[1] ?? 0),
        (ab[2] ?? 0) * (ac[0] ?? 0) - (ab[0] ?? 0) * (ac[2] ?? 0),
        (ab[0] ?? 0) * (ac[1] ?? 0) - (ab[1] ?? 0) * (ac[0] ?? 0)) < EPS) continue;
      for (const v of [a, b, c]) {
        positions.push(...v.p); uvs.push(...v.uv);
        const length = Math.hypot(...v.n);
        normals.push(...v.n.map((n) => n / length));
      }
    }
  }
  raw.dispose();
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
