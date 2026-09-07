import { MeshPhysicalMaterial, Vector3, type Camera, type Mesh } from 'three';
import { prepareStickerDamage, stickerPixelSurvives, type StickerDamageField } from './sticker-alpha';
import type { StickerProjectedContour, StickerScreenPoint } from './sticker-contract';
import { STICKER_SURFACE } from './sticker-surface';
import { stickerProjectedQuad } from './sticker-transform-projection';
type Point = { readonly x: number; readonly y: number };
const cache = new WeakMap<StickerDamageField, Map<number, readonly (readonly Point[])[]>>();
interface ContourOcclusionRevision { readonly identity: object; readonly revision: number; readonly contentMatrix: readonly number[] }
// One latest result per live mesh; discarded with the mesh and replaced on any
// source, transform, alpha or assembly revision change. No history of poses.
const projectedCache = new WeakMap<Mesh, { readonly key: readonly unknown[]; readonly result: StickerProjectedContour | null }>();

/** Trace occupied texel edges, preserving disconnected components and inner cutouts.
 * Coordinates are image-normalized. Only collinear vertices are removed (zero added error).
 * A four-entry LRU bounds alternating sheet/rear wear previews without rebuilding textures.
 */
export function stickerAlphaContours(field: StickerDamageField, wear: number): readonly (readonly Point[])[] {
  const normalized = Number.isFinite(wear) ? Math.max(0, Math.min(1, wear)) : 0;
  // Only byte thresholds can change topology; range input between them reuses the same boundary.
  const key = Math.floor(normalized * 255);
  let entries = cache.get(field); if (!entries) { entries = new Map(); cache.set(field, entries); }
  const cached = entries.get(key); if (cached) { entries.delete(key); entries.set(key, cached); return cached; }
  const stride = field.width + 1; const edges = new Map<number, number[]>();
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < field.width && y < field.height && stickerPixelSurvives(field, x, y, normalized);
  const add = (x: number, y: number, xx: number, yy: number) => { const start = y * stride + x; const end = yy * stride + xx; const list = edges.get(start); if (list) list.push(end); else edges.set(start, [end]); };
  for (const index of field.boundaryCandidates) {
    const x = index % field.width; const y = Math.floor(index / field.width);
    if (!solid(x, y)) continue;
    if (!solid(x, y - 1)) add(x, y, x + 1, y);
    if (!solid(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!solid(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!solid(x - 1, y)) add(x, y + 1, x, y);
  }
  const paths: Point[][] = [];
  while (edges.size) {
    const start = edges.keys().next().value; if (start === undefined) break;
    const path: Point[] = []; let current = start;
    do {
      path.push({ x: current % stride, y: Math.floor(current / stride) });
      const outgoing = edges.get(current); const next = outgoing?.pop();
      if (!outgoing?.length) edges.delete(current);
      if (next === undefined) break; current = next;
    } while (current !== start);
    if (path.length < 4) continue;
    const reduced = path.filter((p, i) => { const prev = path[(i + path.length - 1) % path.length]; const next = path[(i + 1) % path.length]; return prev && next && (p.x - prev.x) * (next.y - p.y) !== (p.y - prev.y) * (next.x - p.x); });
    paths.push(reduced.map((p) => ({ x: p.x / field.width, y: p.y / field.height })));
  }
  entries.set(key, paths); if (entries.size > 4) { const oldest = entries.keys().next().value; if (oldest !== undefined) entries.delete(oldest); }
  return paths;
}

/** Project alpha boundary points through the exact triangles of the production conformed grid. */
export function projectedStickerContour(print: Mesh, camera: Camera, canvas: { readonly left: number; readonly top: number; readonly width: number; readonly height: number }, wear = 0, visible?: (world: Vector3) => boolean, occlusion?: ContourOcclusionRevision): StickerProjectedContour | null {
  const material = print.material;
  if (!(material instanceof MeshPhysicalMaterial) || !material.map) return null;
  const id = print.name.startsWith('sticker-') ? print.name.slice(8) : '';
  if (!id) return null;
  const resource = prepareStickerDamage(material.map, id); if (!resource) return null;
  return projectStickerContourField(print, camera, canvas, resource.field, wear, visible, occlusion);
}

/** Pure projection boundary for a prepared alpha field; borrows all geometry and camera resources. */
export function projectStickerContourField(print: Mesh, camera: Camera, canvas: { readonly left: number; readonly top: number; readonly width: number; readonly height: number }, field: StickerDamageField, wear = 0, visible?: (world: Vector3) => boolean, occlusion?: ContourOcclusionRevision): StickerProjectedContour | null {
  // Arbitrary visibility callbacks without an explicit identity/revision cannot
  // be cached: their behavior may change independently of the camera or mesh.
  if (!occlusion) return projectContourUncached(print, camera, canvas, field, wear, visible);
  print.updateWorldMatrix(true, false); camera.updateMatrixWorld();
  const attributes = [print.geometry.getAttribute('position'), print.geometry.getAttribute('uv'), print.geometry.index];
  const key: unknown[] = [print.geometry, field, Math.floor((Number.isFinite(wear) ? Math.max(0, Math.min(1, wear)) : 0) * 255), occlusion.identity, occlusion.revision, ...occlusion.contentMatrix, visible !== undefined, canvas.left, canvas.top, canvas.width, canvas.height, ...print.matrixWorld.elements, ...camera.matrixWorldInverse.elements, ...camera.projectionMatrix.elements];
  for (const attribute of attributes) {
    key.push(attribute);
    if (attribute) key.push(attribute.array, attribute.count, 'version' in attribute ? attribute.version : attribute.data.version, 'data' in attribute ? attribute.data : null);
  }
  const cached = projectedCache.get(print);
  if (cached && cached.key.length === key.length && cached.key.every((value, index) => value === key[index])) return cached.result;
  const result = projectContourUncached(print, camera, canvas, field, wear, visible);
  projectedCache.set(print, { key, result });
  return result;
}

function projectContourUncached(print: Mesh, camera: Camera, canvas: { readonly left: number; readonly top: number; readonly width: number; readonly height: number }, field: StickerDamageField, wear: number, visible?: (world: Vector3) => boolean): StickerProjectedContour | null {
  const quad = stickerProjectedQuad(print, camera, canvas); if (!quad) return null;
  const positions = print.geometry.getAttribute('position'); const uv = print.geometry.getAttribute('uv'); const n = STICKER_SURFACE.segments;
  if (!positions || !uv || positions.count !== (n + 1) ** 2) return null;
  const minU = uv.getX(0); const maxU = uv.getX(n); const maxV = uv.getY(0); const minV = uv.getY(n * (n + 1));
  const point = new Vector3(); const vertex = new Vector3();
  const project = (p: Point, checkVisibility = true): StickerScreenPoint | null => {
    const gx = Math.max(0, Math.min(n, (p.x - minU) / (maxU - minU) * n));
    const gy = Math.max(0, Math.min(n, (maxV - (1 - p.y)) / (maxV - minV) * n));
    const col = Math.min(n - 1, Math.floor(gx)); const row = Math.min(n - 1, Math.floor(gy)); const x = gx - col; const y = gy - row;
    const a = row * (n + 1) + col; const b = a + 1; const c = a + n + 1; const d = c + 1;
    const weights = x + y <= 1 ? [[a, 1 - x - y], [b, x], [c, y]] : [[b, 1 - y], [c, 1 - x], [d, x + y - 1]];
    point.set(0, 0, 0);
    for (const [index, weight] of weights) { if (index === undefined || weight === undefined) return null; point.addScaledVector(vertex.fromBufferAttribute(positions, index), weight); }
    point.applyMatrix4(print.matrixWorld);
    if (checkVisibility && visible && !visible(point)) return null;
    point.applyMatrix4(camera.matrixWorldInverse); if (point.z >= 0) return null;
    point.applyMatrix4(camera.projectionMatrix); if (![point.x, point.y, point.z].every(Number.isFinite) || point.z < -1 || point.z > 1) return null;
    return { x: canvas.left + (point.x + 1) * canvas.width / 2, y: canvas.top + (1 - point.y) * canvas.height / 2 };
  };
  const contours = stickerAlphaContours(field, wear); const paths: StickerScreenPoint[][] = []; const closed: boolean[] = [];
  // Positive image-space area identifies external boundaries; holes must never host grips.
  const outer: Point[] = [];
  for (const path of contours) {
    const projected: (StickerScreenPoint | null)[] = []; let area = 0;
    for (let i = 0; i < path.length; i++) {
      const p = path[i]; const q = path[(i + 1) % path.length]; if (!p || !q) return null;
      // Collinear alpha reduction does not imply constant 3D visibility. Sample
      // the actual shown grid along every span, including its midpoint.
      const divisions = visible ? Math.max(2, Math.ceil(Math.max(Math.abs(q.x - p.x) / (maxU - minU), Math.abs(q.y - p.y) / (maxV - minV)) * n * 2)) : 1;
      for (let step = 0; step < divisions; step++) { const t = step / divisions; projected.push(project({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })); }
      area += p.x * q.y - q.x * p.y;
    }
    const hidden = projected.indexOf(null);
    if (hidden < 0) { paths.push(projected.filter((p): p is StickerScreenPoint => p !== null)); closed.push(true); }
    else {
      let span: StickerScreenPoint[] = [];
      for (let i = 1; i <= projected.length; i++) {
        const p = projected[(hidden + i) % projected.length];
        if (p) span.push(p); else { if (span.length > 1) { paths.push(span); closed.push(false); } span = []; }
      }
    }
    if (area > 0) outer.push(...path);
  }
  if (!outer.length) return null;
  const anchor = (x: number, y: number) => { let best = outer[0]; let distance = Infinity; for (const p of outer) { const dx = (p.x - minU) / (maxU - minU) - x; const dy = (p.y - (1 - maxV)) / (maxV - minV) - y; const score = dx * dx + dy * dy; if (score < distance) { distance = score; best = p; } } return best ? { point: project(best, false), visible: project(best) !== null } : null; };
  const tl = anchor(0, 0); const tr = anchor(1, 0); const br = anchor(1, 1); const bl = anchor(0, 1);
  return paths.length && tl?.point && tr?.point && br?.point && bl?.point ? { paths, closed, anchors: [tl.point, tr.point, br.point, bl.point], anchorVisible: [tl.visible, tr.visible, br.visible, bl.visible], center: quad.center } : null;
}
