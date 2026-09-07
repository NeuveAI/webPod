export const buildProfile={copyMs:0,boundsMs:0,sortMs:0,totalMs:0,nodes:0};
import { Box3, Matrix4, Ray, Triangle, Vector3, type BufferGeometry } from '/Users/vinicius/code/webPod/packages/device/node_modules/three/build/three.module.js';

export interface StickerCollisionFace {
  readonly geometry: BufferGeometry;
  /** Transform into the same content coordinates used by sticker vertices. */
  readonly transform?: Matrix4;
  readonly source: string;
  readonly kind: 'surface' | 'bridge';
  /** Explicitly partitioned exterior only; never inferred from triangle proximity. */
  readonly adhesiveSupport?: boolean;
}
export interface StickerCollisionHit {
  readonly point: Vector3;
  readonly normal: Vector3;
  readonly distance: number;
  readonly source: string;
  readonly kind: 'surface' | 'bridge';
}
interface Node { readonly box: Box3; readonly left?: Node; readonly right?: Node; readonly triangles?: readonly number[] }
const EPSILON = 1e-7;
const LEAF_SIZE = 8;

function coplanarOverlap(a: Triangle, b: Triangle, normal: Vector3): boolean {
  const axis = Math.abs(normal.x) > Math.abs(normal.y) ? (Math.abs(normal.x) > Math.abs(normal.z) ? 'x' : 'z') : (Math.abs(normal.y) > Math.abs(normal.z) ? 'y' : 'z');
  const project = (p: Vector3): readonly [number, number] => axis === 'x' ? [p.y, p.z] : axis === 'y' ? [p.x, p.z] : [p.x, p.y];
  const aa = [a.a, a.b, a.c].map(project), bb = [b.a, b.b, b.c].map(project);
  const orient = (p: readonly number[], q: readonly number[], r: readonly number[]) => ((q[0] ?? 0) - (p[0] ?? 0)) * ((r[1] ?? 0) - (p[1] ?? 0)) - ((q[1] ?? 0) - (p[1] ?? 0)) * ((r[0] ?? 0) - (p[0] ?? 0));
  // Separating-axis test includes touching and coplanar containment.
  for (const polygon of [aa, bb]) for (let i = 0; i < 3; i++) {
    const p = polygon[i], q = polygon[(i + 1) % 3]; if (!p || !q) continue;
    const first = aa.map(v => orient(p, q, v)), second = bb.map(v => orient(p, q, v));
    if (Math.max(...first) < Math.min(...second) - EPSILON || Math.max(...second) < Math.min(...first) - EPSILON) return false;
  }
  return true;
}

/** Actual triangle contacts, not an exterior/inside classifier or a closest adhesive-support oracle.
 * A ray through an unbridged opening can first hit hidden hardware: provenance is preserved.
 * Final triangle tests also require an exterior-start/sweep or containment invariant in the caller.
 */
export function createStickerCollision(faces: readonly StickerCollisionFace[]) {
  const started=performance.now(); const raw: number[] = [], owners: number[] = [];
  const metadata = faces.map(face => ({ source: face.source, kind: face.kind, adhesiveSupport: face.adhesiveSupport === true }));
  const vertex = new Vector3();
  for (const [owner, face] of faces.entries()) {
    const position = face.geometry.getAttribute('position'), index = face.geometry.index;
    const count = index?.count ?? position.count;
    if (count % 3 !== 0) throw new Error('Sticker collider requires triangle geometry');
    for (let i = 0; i < count; i += 3) {
      for (let k = 0; k < 3; k++) {
        const j = index ? index.getX(i + k) : i + k;
        vertex.set(position.getX(j), position.getY(j), position.getZ(j));
        if (face.transform) vertex.applyMatrix4(face.transform);
        if (![vertex.x, vertex.y, vertex.z].every(Number.isFinite)) throw new Error('Nonfinite sticker collision geometry');
        raw.push(vertex.x, vertex.y, vertex.z);
      }
      owners.push(owner);
    }
  }
  let coordinates = new Float64Array(raw), provenance = new Uint32Array(owners);
  buildProfile.copyMs=performance.now()-started; const working = new Triangle();
  // Calls are synchronous and invoke no external callbacks. Returned hits own
  // their vectors; this bounded scratch never escapes the collider.
  const segmentRay = new Ray(), segmentDirection = new Vector3(), segmentHitPoint = new Vector3(), segmentBoxPoint = new Vector3(), segmentNormal = new Vector3(), segmentBestPoint = new Vector3(), segmentStack: Node[] = [];

  const read = (id: number, target: Triangle) => {
    target.a.fromArray(coordinates, id * 9); target.b.fromArray(coordinates, id * 9 + 3); target.c.fromArray(coordinates, id * 9 + 6); return target;
  };
  let nodeCount = 0;
  const build = (ids: number[]): Node => {
    nodeCount++;
    const bboxStart=performance.now(); const box = new Box3();
    for (const id of ids) { read(id, working); box.expandByPoint(working.a); box.expandByPoint(working.b); box.expandByPoint(working.c); }
    buildProfile.boundsMs+=performance.now()-bboxStart; buildProfile.nodes++; if (ids.length <= LEAF_SIZE) return { box, triangles: ids };
    const extent = box.getSize(new Vector3());
    const axis = extent.x >= extent.y && extent.x >= extent.z ? 0 : extent.y >= extent.z ? 1 : 2;
    const center = (id: number) => (coordinates[id * 9 + axis] ?? 0) + (coordinates[id * 9 + 3 + axis] ?? 0) + (coordinates[id * 9 + 6 + axis] ?? 0);
    const sortStart=performance.now();ids.sort((a, b) => center(a) - center(b));buildProfile.sortMs+=performance.now()-sortStart; const half = ids.length >> 1;
    return { box, left: build(ids.slice(0, half)), right: build(ids.slice(half)) };
  };
  let root: Node | null = build(Array.from({ length: owners.length }, (_, i) => i));
  buildProfile.totalMs=performance.now()-started; const ensure = () => { if (!root) throw new Error('Sticker collider was disposed'); return root; };
  const stats = { triangleCount: owners.length, nodeCount, typedBytes: coordinates.byteLength + provenance.byteLength };
  raw.length = 0; owners.length = 0;
  const supportStats = { queries: 0, nodes: 0, triangles: 0 };
  const closestSupport = (point: Vector3, maximumDistance: number, initialFacet = -1): (StickerCollisionHit & { readonly signedDistance: number; readonly facetIndex: number }) | null => {
      const tree = ensure();
      if (![point.x, point.y, point.z, maximumDistance].every(Number.isFinite) || maximumDistance < 0) throw new Error('Invalid support query');
      let best: (StickerCollisionHit & { readonly signedDistance: number; readonly facetIndex: number }) | null = null;
      supportStats.queries++;
      const closest = new Vector3();
      const consider = (id: number) => {
        const owner = metadata[provenance[id] ?? -1]; if (!owner?.adhesiveSupport) return;
        supportStats.triangles++;
        read(id, working).closestPointToPoint(point, closest);
        const distance = closest.distanceTo(point);
        if (distance > (best?.distance ?? maximumDistance) || (best && distance === best.distance && id >= best.facetIndex)) return;
        const normal = working.getNormal(new Vector3());
        best = { point: closest.clone(), normal, distance, signedDistance: point.clone().sub(closest).dot(normal), source: owner.source, kind: owner.kind, facetIndex: id };
      };
      if (initialFacet >= 0 && initialFacet < provenance.length) consider(initialFacet);
      const visit = (node: Node) => {
        supportStats.nodes++;
        if (node.box.distanceToPoint(point) > (best?.distance ?? maximumDistance)) return;
        for (const id of node.triangles ?? []) if (id !== initialFacet) consider(id);
        const left = node.left, right = node.right;
        if (left && right) {
          if (left.box.distanceToPoint(point) < right.box.distanceToPoint(point)) { visit(left); visit(right); } else { visit(right); visit(left); }
        } else { if (left) visit(left); if (right) visit(right); }
      };
      visit(tree); return best;
  };
  return {
    stats,
    /** Earliest transverse facet contact on a finite segment. Coplanar sliding is handled by the triangle-overlap gate. */
    castSegment(start: Vector3, end: Vector3): StickerCollisionHit | null {
      const tree = ensure();
      if (!Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(start.z) || !Number.isFinite(end.x) || !Number.isFinite(end.y) || !Number.isFinite(end.z)) throw new Error('Nonfinite collision segment');
      segmentDirection.copy(end).sub(start); const length = segmentDirection.length(); if (length < EPSILON) return null;
      segmentDirection.multiplyScalar(1 / length); segmentRay.set(start, segmentDirection);
      const startLength = start.length(); let bestDistance = Infinity, bestId = -1;
      segmentStack.length = 0; segmentStack.push(tree);
      while (segmentStack.length) {
        const node = segmentStack.pop(); if (!node) break;
        if (!segmentRay.intersectBox(node.box, segmentBoxPoint)) continue;
        const limit = Math.min(bestDistance, length) + EPSILON;
        // For an outside origin, intersectBox returns the entry point. Its ray
        // distance is a tighter bound than the nearest Euclidean box distance.
        // An inside origin must retain the node even when its exit is beyond end.
        if (!node.box.containsPoint(start) && segmentBoxPoint.distanceToSquared(start) > limit * limit) continue;
        if (node.triangles) for (const id of node.triangles) {
          read(id, working); let point = segmentRay.intersectTriangle(working.a, working.b, working.c, false, segmentHitPoint);
          if (!point) {
            // Preserve the exact shared-edge roundoff fallback without allocating
            // vectors and arrays for ordinary triangle misses in every ray.
            const normal = working.getNormal(segmentNormal), denominator = normal.dot(segmentDirection);
            if (Math.abs(denominator) > Number.EPSILON * 128) {
              const along = (normal.x * (working.a.x - start.x) + normal.y * (working.a.y - start.y) + normal.z * (working.a.z - start.z)) / denominator;
              if (along >= 0 && along <= length) {
                segmentRay.at(along, segmentHitPoint);
                const scale = Math.max(1, length, startLength, working.a.length(), working.b.length(), working.c.length());
                const tolerance = Number.EPSILON * 128 * scale;
                for (let edgeIndex = 0; edgeIndex < 3; edgeIndex++) {
                  const a = edgeIndex === 0 ? working.a : edgeIndex === 1 ? working.b : working.c;
                  const b = edgeIndex === 0 ? working.b : edgeIndex === 1 ? working.c : working.a;
                  const ex = b.x - a.x, ey = b.y - a.y, ez = b.z - a.z, squared = ex * ex + ey * ey + ez * ez;
                  if (squared === 0) continue;
                  const fraction = Math.max(0, Math.min(1, ((segmentHitPoint.x - a.x) * ex + (segmentHitPoint.y - a.y) * ey + (segmentHitPoint.z - a.z) * ez) / squared));
                  const dx = a.x + ex * fraction - segmentHitPoint.x, dy = a.y + ey * fraction - segmentHitPoint.y, dz = a.z + ez * fraction - segmentHitPoint.z;
                  if (dx * dx + dy * dy + dz * dz <= tolerance * tolerance) { point = segmentHitPoint; break; }
                }
              }
            }
          }
          if (!point) continue;
          const distance = point.distanceTo(start); if (distance > length + EPSILON || distance >= bestDistance) continue;
          bestDistance = distance; bestId = id; segmentBestPoint.copy(point);
        }
        // Match the old left-then-right traversal and tie behavior.
        if (node.right) segmentStack.push(node.right); if (node.left) segmentStack.push(node.left);
      }
      if (bestId < 0) return null;
      const owner = metadata[provenance[bestId] ?? -1]; if (!owner) throw new Error('Missing collision provenance');
      read(bestId, working);
      return { point: segmentBestPoint.clone(), normal: working.getNormal(new Vector3()), distance: bestDistance, ...owner };
    },
    /** Nearest explicitly approved support facet. Caller owns exposure/bridge classification.
     * This cannot authorize an attraction step through the solid; sweep/contact gates still apply.
     */
    closestApprovedSupport(point: Vector3, maximumDistance: number) { return closestSupport(point, maximumDistance); },
    getSupportStats() { return { ...supportStats }; },
    /** One bounded warm facet hint. Every query still proves the exact minimum via BVH lower bounds.
     * A hint is never reused across collider identity, and query disposal drops it immediately.
     */
    createSupportQuery() {
      ensure(); let facet = -1, disposed = false;
      return {
        sample(point: Vector3, maximumDistance: number) {
          if (disposed) throw new Error('Sticker support query was disposed');
          const result = closestSupport(point, maximumDistance, facet);
          facet = result?.facetIndex ?? -1; return result;
        },
        dispose() { disposed = true; facet = -1; },
      };
    },
    /** Tests complete triangle overlap, including collider edges crossing its interior.
     * Does not detect a triangle wholly contained inside a closed solid without surface overlap.
     */
    intersectsTriangle(a: Vector3, b: Vector3, c: Vector3): boolean {
      const tree = ensure(), query = new Triangle(a, b, c), queryNormal = query.getNormal(new Vector3());
      if (![a, b, c].every(p => [p.x, p.y, p.z].every(Number.isFinite)) || queryNormal.lengthSq() < .5) throw new Error('Invalid collision triangle');
      const hit = new Vector3(), ray = new Ray();
      const edgesCross = (from: Triangle, to: Triangle) => {
        const vertices = [from.a, from.b, from.c];
        for (let i = 0; i < 3; i++) {
          const first = vertices[i], second = vertices[(i + 1) % 3]; if (!first || !second) continue;
          const delta = second.clone().sub(first), length = delta.length(); if (length < EPSILON) continue;
          ray.set(first, delta.multiplyScalar(1 / length));
          if (ray.intersectTriangle(to.a, to.b, to.c, false, hit) && first.distanceTo(hit) <= length + EPSILON) return true;
        }
        return false;
      };
      const visit = (node: Node): boolean => {
        if (!node.box.intersectsTriangle(query)) return false;
        for (const id of node.triangles ?? []) {
          read(id, working);
          const coplanar = [working.a, working.b, working.c].every(p => Math.abs(p.clone().sub(a).dot(queryNormal)) < EPSILON);
          if (coplanar ? coplanarOverlap(query, working, queryNormal) : edgesCross(query, working) || edgesCross(working, query)) return true;
        }
        return (node.left ? visit(node.left) : false) || (node.right ? visit(node.right) : false);
      };
      return visit(tree);
    },
    dispose() { segmentStack.length = 0; root = null; coordinates = new Float64Array(); provenance = new Uint32Array(); metadata.length = 0; },
  };
}
